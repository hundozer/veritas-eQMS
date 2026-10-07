import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { tenantRead, tenantTransaction } from '@/lib/tenant-db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import { assertTransition, lifecycleErrorResponse, verifyLifecycleIntegrity } from '@/lib/document-lifecycle';
import { reportServerError } from '../../../../../lib/server-errors';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'documents.submit_review')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Submit-for-review permission is required' } }, { status: 403 });

    const { reviewerId, approverId } = await req.json();
    if (!reviewerId || !approverId || reviewerId === approverId) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Distinct reviewer and approver assignments are required' } }, { status: 400 });
    }

    const document = await tenantRead(user.tenantId, (tx) => tx.document.findFirst({
      where: { id, tenantId: user.tenantId },
    }));
    if (!document) return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    const version = await tenantRead(user.tenantId, (tx) => tx.documentVersion.findUnique({
      where: { documentId_versionNumber: { documentId: id, versionNumber: document.currentVersionNumber } },
    }));
    if (!version) return NextResponse.json({ error: { code: 'Conflict', message: 'Current document version is missing' } }, { status: 409 });
    assertTransition(version.status, 'IN_REVIEW');
    await verifyLifecycleIntegrity(version);

    const assignees = await prisma.user.findMany({
      where: { id: { in: [reviewerId, approverId] }, tenantId: user.tenantId, accountStatus: 'ACTIVE' },
      select: { id: true },
    });
    if (assignees.length !== 2) return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Reviewer and approver must be active users in this tenant' } }, { status: 400 });
    if (approverId === (version.authoredById || document.ownerId)) {
      return NextResponse.json({ error: { code: 'SegregationOfDuties', message: 'The document author cannot be assigned as its approver' } }, { status: 409 });
    }

    const route = await tenantTransaction(user.tenantId, async (tx) => {
      const transitioned = await tx.documentVersion.updateMany({ where: { id: version.id, status: 'DRAFT' }, data: { status: 'IN_REVIEW' } });
      if (transitioned.count !== 1) throw new Error('STALE_DOCUMENT_VERSION');
      const updated = await tx.document.updateMany({ where: { id, tenantId: user.tenantId, currentVersionNumber: version.versionNumber, status: 'DRAFT' }, data: { status: 'IN_REVIEW' } });
      if (updated.count !== 1) throw new Error('STALE_DOCUMENT');
      const approvalRoute = await tx.approvalRoute.create({
        data: {
          documentVersionId: version.id, tenantId: user.tenantId, status: 'PENDING',
          steps: { create: [
            { approverId: reviewerId, sequence: 1, stepType: 'REVIEW', status: 'PENDING' },
            { approverId, sequence: 2, stepType: 'APPROVAL', status: 'PENDING' },
          ] },
        },
        include: { steps: { include: { approver: true }, orderBy: { sequence: 'asc' } } },
      });
      await writeMandatoryAudit(tx, {
        context: user, action: 'DOCUMENT_SUBMITTED_FOR_REVIEW', objectType: 'DocumentVersion', objectId: version.id,
        payload: { documentId: id, version: version.versionNumber, before: 'DRAFT', after: 'IN_REVIEW', reviewerId, approverId },
        requestUrl: req.nextUrl.pathname,
      });
      return approvalRoute;
    });
    return NextResponse.json({ approvalRoute: route, status: 'IN_REVIEW' });
  } catch (error) {
    const lifecycle = lifecycleErrorResponse(error);
    if (lifecycle) return NextResponse.json({ error: { code: lifecycle.code, message: lifecycle.message } }, { status: lifecycle.status });
    if ((error as Error).message.startsWith('STALE_')) return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'Document state changed; refresh and try again' } }, { status: 409 });
    reportServerError('document.submitReview');
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to submit document for review' } }, { status: 500 });
  }
}
