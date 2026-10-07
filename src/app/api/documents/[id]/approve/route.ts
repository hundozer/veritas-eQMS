import { NextRequest, NextResponse } from 'next/server';
import { tenantRead, tenantTransaction } from '@/lib/tenant-db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import { assertTransition, lifecycleErrorResponse, verifyLifecycleIntegrity } from '@/lib/document-lifecycle';
import { reportServerError } from '../../../../../lib/server-errors';
import { clientIp, recordSignature, SignatureError, signatureFailedResponse, verifySignerOrRecordFailure } from '@/lib/signatures';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'documents.approve')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Document-approval permission is required' } }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    const document = await tenantRead(user.tenantId, (tx) => tx.document.findFirst({ where: { id, tenantId: user.tenantId } }));
    if (!document) return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    const version = await tenantRead(user.tenantId, (tx) => tx.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId: id, versionNumber: document.currentVersionNumber } } }));
    if (!version) return NextResponse.json({ error: { code: 'Conflict', message: 'Current document version is missing' } }, { status: 409 });
    assertTransition(version.status, 'APPROVED');
    if (user.id === (version.authoredById || document.ownerId)) {
      return NextResponse.json({ error: { code: 'SegregationOfDuties', message: 'The document author cannot approve their own version' } }, { status: 409 });
    }
    const route = await tenantRead(user.tenantId, (tx) => tx.approvalRoute.findFirst({
      where: { documentVersionId: version.id, status: 'REVIEWED' }, orderBy: { createdAt: 'desc' }, include: { steps: true },
    }));
    const reviewStep = route?.steps.find((step) => step.stepType === 'REVIEW');
    const approvalStep = route?.steps.find((step) => step.stepType === 'APPROVAL');
    if (!route || !reviewStep || reviewStep.status !== 'COMPLETED') return NextResponse.json({ error: { code: 'ReviewIncomplete', message: 'Assigned review must be completed before approval' } }, { status: 409 });
    if (!approvalStep || approvalStep.approverId !== user.id) return NextResponse.json({ error: { code: 'NotAssignedApprover', message: 'Only the assigned approver may approve this version' } }, { status: 403 });
    if (approvalStep.status !== 'PENDING') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'This approval has already been completed' } }, { status: 409 });
    await verifySignerOrRecordFailure(user, body.password, version.id, req);
    await verifyLifecycleIntegrity(version);

    await tenantTransaction(user.tenantId, async (tx) => {
      const stepUpdate = await tx.approvalRouteStep.updateMany({ where: { id: approvalStep.id, status: 'PENDING' }, data: { status: 'COMPLETED', completedAt: new Date(), comment: comment || null } });
      const versionUpdate = await tx.documentVersion.updateMany({ where: { id: version.id, status: 'IN_REVIEW' }, data: { status: 'APPROVED' } });
      const documentUpdate = await tx.document.updateMany({ where: { id, tenantId: user.tenantId, currentVersionNumber: version.versionNumber, status: 'IN_REVIEW' }, data: { status: 'APPROVED' } });
      if (stepUpdate.count !== 1 || versionUpdate.count !== 1 || documentUpdate.count !== 1) throw new Error('STALE_APPROVAL');
      await tx.approvalRoute.update({ where: { id: route.id }, data: { status: 'APPROVED' } });
      await recordSignature(tx, { context: user, version, meaning: 'APPROVED', comment, sourceIp: clientIp(req.headers), requestUrl: req.nextUrl.pathname });
      await writeMandatoryAudit(tx, {
        context: user, action: 'DOCUMENT_APPROVED', objectType: 'DocumentVersion', objectId: version.id,
        payload: { documentId: id, version: version.versionNumber, before: 'IN_REVIEW', after: 'APPROVED', comment: comment || undefined },
        requestUrl: req.nextUrl.pathname,
      });
    });
    return NextResponse.json({ success: true, status: 'APPROVED', version: version.versionNumber });
  } catch (error) {
    if (error instanceof SignatureError) return signatureFailedResponse(error);
    const lifecycle = lifecycleErrorResponse(error);
    if (lifecycle) return NextResponse.json({ error: { code: lifecycle.code, message: lifecycle.message } }, { status: lifecycle.status });
    if ((error as Error).message === 'STALE_APPROVAL') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'Document state changed; refresh and try again' } }, { status: 409 });
    reportServerError('document.approve');
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to approve document' } }, { status: 500 });
  }
}
