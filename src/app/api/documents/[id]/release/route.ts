import { NextRequest, NextResponse } from 'next/server';
import { tenantRead, tenantTransaction } from '@/lib/tenant-db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import { assertTransition, lifecycleErrorResponse, verifyLifecycleIntegrity } from '@/lib/document-lifecycle';
import { reportServerError } from '../../../../../lib/server-errors';
import { clientIp, recordSignature, SignatureError, signatureFailedResponse, verifySignerOrRecordFailure } from '@/lib/signatures';

// POST /api/documents/[id]/release - make the approved version effective (DEC-064).
// The release is signed; a previously effective version is superseded in the
// same transaction.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'documents.release')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Document-release permission is required' } }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    const document = await tenantRead(user.tenantId, (tx) => tx.document.findFirst({ where: { id, tenantId: user.tenantId } }));
    if (!document) return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    const version = await tenantRead(user.tenantId, (tx) => tx.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId: id, versionNumber: document.currentVersionNumber } } }));
    if (!version || document.status !== 'APPROVED') {
      return NextResponse.json({ error: { code: 'InvalidTransition', message: 'Only an approved current version can be released' } }, { status: 409 });
    }
    assertTransition(version.status, 'EFFECTIVE');
    if (user.id === (version.authoredById || document.ownerId)) {
      return NextResponse.json({ error: { code: 'SegregationOfDuties', message: 'The document author cannot release their own version' } }, { status: 409 });
    }
    const previous = await tenantRead(user.tenantId, (tx) => tx.documentVersion.findMany({
      where: { documentId: id, status: 'EFFECTIVE', id: { not: version.id } },
      select: { id: true, versionNumber: true },
    }));
    await verifySignerOrRecordFailure(user, body.password, version.id, req);
    await verifyLifecycleIntegrity(version);

    const effectiveDate = new Date();
    await tenantTransaction(user.tenantId, async (tx) => {
      const superseded = await tx.documentVersion.updateMany({
        where: { id: { in: previous.map((item) => item.id) }, status: 'EFFECTIVE' },
        data: { status: 'SUPERSEDED' },
      });
      const released = await tx.documentVersion.updateMany({ where: { id: version.id, status: 'APPROVED' }, data: { status: 'EFFECTIVE', effectiveDate } });
      const documentUpdate = await tx.document.updateMany({
        where: { id, tenantId: user.tenantId, currentVersionNumber: version.versionNumber, status: 'APPROVED' },
        data: { status: 'EFFECTIVE' },
      });
      if (superseded.count !== previous.length || released.count !== 1 || documentUpdate.count !== 1) throw new Error('STALE_RELEASE');
      await recordSignature(tx, { context: user, version, meaning: 'RELEASED', comment, sourceIp: clientIp(req.headers), requestUrl: req.nextUrl.pathname });
      await writeMandatoryAudit(tx, {
        context: user, action: 'DOCUMENT_RELEASED', objectType: 'DocumentVersion', objectId: version.id,
        payload: { documentId: id, version: version.versionNumber, before: 'APPROVED', after: 'EFFECTIVE', effectiveDate: effectiveDate.toISOString(), supersedes: previous.map((item) => item.versionNumber) },
        requestUrl: req.nextUrl.pathname,
      });
      for (const item of previous) {
        await writeMandatoryAudit(tx, {
          context: user, action: 'DOCUMENT_SUPERSEDED', objectType: 'DocumentVersion', objectId: item.id,
          payload: { documentId: id, version: item.versionNumber, before: 'EFFECTIVE', after: 'SUPERSEDED', supersededBy: version.versionNumber },
          requestUrl: req.nextUrl.pathname,
        });
      }
    });
    return NextResponse.json({ success: true, status: 'EFFECTIVE', version: version.versionNumber, effectiveDate });
  } catch (error) {
    if (error instanceof SignatureError) return signatureFailedResponse(error);
    const lifecycle = lifecycleErrorResponse(error);
    if (lifecycle) return NextResponse.json({ error: { code: lifecycle.code, message: lifecycle.message } }, { status: lifecycle.status });
    if ((error as Error).message === 'STALE_RELEASE') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'Document state changed; refresh and try again' } }, { status: 409 });
    reportServerError('document.release');
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to release document' } }, { status: 500 });
  }
}
