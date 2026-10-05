import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import { assertTransition, lifecycleErrorResponse } from '@/lib/document-lifecycle';
import { reportServerError } from '../../../../../lib/server-errors';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'documents.review')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Document-review permission is required' } }, { status: 403 });
    const body = await req.json();
    const action = body.action === 'RETURN' ? 'RETURN' : body.action === 'COMPLETE' ? 'COMPLETE' : null;
    if (!action) return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Review action must be COMPLETE or RETURN' } }, { status: 400 });
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (action === 'RETURN' && !comment) return NextResponse.json({ error: { code: 'ValidationFailed', message: 'A reason is required when returning a document for changes' } }, { status: 400 });

    const document = await prisma.document.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!document) return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    const version = await prisma.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId: id, versionNumber: document.currentVersionNumber } } });
    if (!version || version.status !== 'IN_REVIEW') return NextResponse.json({ error: { code: 'InvalidTransition', message: 'Only an in-review version can be reviewed' } }, { status: 409 });
    const route = await prisma.approvalRoute.findFirst({
      where: { documentVersionId: version.id, status: { in: ['PENDING', 'REVIEWED'] } },
      orderBy: { createdAt: 'desc' }, include: { steps: true },
    });
    const step = route?.steps.find((item) => item.stepType === 'REVIEW');
    if (!route || !step || step.approverId !== user.id) return NextResponse.json({ error: { code: 'NotAssignedReviewer', message: 'Only the assigned reviewer may complete this action' } }, { status: 403 });
    if (step.status !== 'PENDING') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'This review action has already been completed' } }, { status: 409 });

    if (action === 'RETURN') assertTransition(version.status, 'DRAFT');
    await prisma.$transaction(async (tx) => {
      const completed = await tx.approvalRouteStep.updateMany({
        where: { id: step.id, status: 'PENDING' },
        data: { status: action === 'RETURN' ? 'RETURNED' : 'COMPLETED', completedAt: new Date(), comment: comment || null },
      });
      if (completed.count !== 1) throw new Error('STALE_REVIEW');
      await tx.approvalRoute.update({ where: { id: route.id }, data: { status: action === 'RETURN' ? 'RETURNED' : 'REVIEWED' } });
      if (action === 'RETURN') {
        const versionUpdate = await tx.documentVersion.updateMany({ where: { id: version.id, status: 'IN_REVIEW' }, data: { status: 'DRAFT' } });
        const documentUpdate = await tx.document.updateMany({ where: { id, tenantId: user.tenantId, status: 'IN_REVIEW', currentVersionNumber: version.versionNumber }, data: { status: 'DRAFT' } });
        if (versionUpdate.count !== 1 || documentUpdate.count !== 1) throw new Error('STALE_REVIEW');
      }
      await writeMandatoryAudit(tx, {
        context: user,
        action: action === 'RETURN' ? 'DOCUMENT_RETURNED_FOR_CHANGES' : 'DOCUMENT_REVIEW_COMPLETED',
        objectType: 'DocumentVersion', objectId: version.id,
        payload: { documentId: id, version: version.versionNumber, before: 'IN_REVIEW', after: action === 'RETURN' ? 'DRAFT' : 'IN_REVIEW', comment: comment || undefined },
        requestUrl: req.nextUrl.pathname,
      });
    });
    return NextResponse.json({ status: action === 'RETURN' ? 'DRAFT' : 'IN_REVIEW', review: action });
  } catch (error) {
    const lifecycle = lifecycleErrorResponse(error);
    if (lifecycle) return NextResponse.json({ error: { code: lifecycle.code, message: lifecycle.message } }, { status: lifecycle.status });
    if ((error as Error).message === 'STALE_REVIEW') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'Document state changed; refresh and try again' } }, { status: 409 });
    reportServerError('document.review');
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to complete document review' } }, { status: 500 });
  }
}
