import { NextRequest, NextResponse } from 'next/server';
import { tenantRead, tenantTransaction } from '../../../../../lib/tenant-db';
import { getContext } from '../../../../../lib/auth';
import { hasPermission } from '../../../../../lib/rbac';
import { writeMandatoryAudit } from '../../../../../lib/audit';
import { lifecycleErrorResponse, verifyLifecycleIntegrity } from '../../../../../lib/document-lifecycle';
import { reportServerError } from '../../../../../lib/server-errors';
import { clientIp, recordSignature, SignatureError, signatureFailedResponse, verifySignerOrRecordFailure } from '../../../../../lib/signatures';

// POST /api/trainings/[id]/sign - the trainee signs that they have read and
// understood the effective version they were assigned (DEC-075). The signature,
// the completed assignment and the audit row are written in one transaction.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'training.complete_own')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Training-completion permission is required' } }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    const assignment = await tenantRead(user.tenantId, (tx) => tx.trainingAssignment.findFirst({
      where: { id, tenantId: user.tenantId, userId: user.id },
      select: { id: true, status: true, documentVersion: true },
    }));
    if (!assignment) return NextResponse.json({ error: { code: 'NotFound', message: 'Training assignment not found' } }, { status: 404 });
    const version = assignment.documentVersion;
    if (assignment.status !== 'ASSIGNED' || !version || version.status !== 'EFFECTIVE') {
      return NextResponse.json({ error: { code: 'InvalidTransition', message: 'Only an open assignment on the effective version can be signed' } }, { status: 409 });
    }

    await verifySignerOrRecordFailure(user, body.password, version.id, req);
    await verifyLifecycleIntegrity(version);

    const completedAt = new Date();
    await tenantTransaction(user.tenantId, async (tx) => {
      const completed = await tx.trainingAssignment.updateMany({
        where: { id, tenantId: user.tenantId, userId: user.id, status: 'ASSIGNED', documentVersionId: version.id },
        data: { status: 'COMPLETED', completedAt },
      });
      if (completed.count !== 1) throw new Error('STALE_TRAINING');
      const stillEffective = await tx.documentVersion.count({ where: { id: version.id, status: 'EFFECTIVE' } });
      if (stillEffective !== 1) throw new Error('STALE_TRAINING');
      const signature = await recordSignature(tx, { context: user, version, meaning: 'READ_AND_UNDERSTOOD', comment, sourceIp: clientIp(req.headers), requestUrl: req.nextUrl.pathname });
      await writeMandatoryAudit(tx, {
        context: user, action: 'TRAINING_COMPLETED', objectType: 'TrainingAssignment', objectId: id,
        payload: { documentId: version.documentId, version: version.versionNumber, before: 'ASSIGNED', after: 'COMPLETED', signatureId: signature.id, completedAt: completedAt.toISOString() },
        requestUrl: req.nextUrl.pathname,
      });
    });
    return NextResponse.json({ status: 'COMPLETED', completedAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SignatureError) return signatureFailedResponse(error);
    const lifecycle = lifecycleErrorResponse(error);
    if (lifecycle) return NextResponse.json({ error: { code: lifecycle.code, message: lifecycle.message } }, { status: lifecycle.status });
    if ((error as Error).message === 'STALE_TRAINING') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'This training changed; refresh and try again' } }, { status: 409 });
    reportServerError('training.sign');
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to record the training signature' } }, { status: 500 });
  }
}
