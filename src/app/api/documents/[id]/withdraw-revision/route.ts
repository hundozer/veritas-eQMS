import { NextRequest, NextResponse } from 'next/server';
import { tenantRead, tenantTransaction } from '@/lib/tenant-db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';
import { assertTransition, lifecycleErrorResponse } from '@/lib/document-lifecycle';
import { reportServerError } from '../../../../../lib/server-errors';

// POST /api/documents/[id]/withdraw-revision - abandon an open revision (DEC-065).
// The revision becomes WITHDRAWN, its open review route is cancelled, and the
// document returns to its effective version, which never stopped being in force.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'documents.update_draft')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Document-revision permission is required' } }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) return NextResponse.json({ error: { code: 'ValidationFailed', message: 'A reason for withdrawing the revision is required' } }, { status: 400 });

    const document = await tenantRead(user.tenantId, (tx) => tx.document.findFirst({ where: { id, tenantId: user.tenantId } }));
    if (!document) return NextResponse.json({ error: { code: 'NotFound', message: 'Document not found' } }, { status: 404 });
    const [revision, effective] = await tenantRead(user.tenantId, (tx) => Promise.all([
      tx.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId: id, versionNumber: document.currentVersionNumber } } }),
      tx.documentVersion.findFirst({ where: { documentId: id, status: 'EFFECTIVE' } }),
    ]));
    if (!revision || !effective || revision.id === effective.id) {
      return NextResponse.json({ error: { code: 'InvalidTransition', message: 'Only an open revision of an effective document can be withdrawn' } }, { status: 409 });
    }
    assertTransition(revision.status, 'WITHDRAWN');

    await tenantTransaction(user.tenantId, async (tx) => {
      const withdrawn = await tx.documentVersion.updateMany({ where: { id: revision.id, status: revision.status }, data: { status: 'WITHDRAWN' } });
      const documentUpdate = await tx.document.updateMany({
        where: { id, tenantId: user.tenantId, status: document.status, currentVersionNumber: revision.versionNumber },
        data: { status: 'EFFECTIVE', currentVersionNumber: effective.versionNumber },
      });
      if (withdrawn.count !== 1 || documentUpdate.count !== 1) throw new Error('STALE_WITHDRAWAL');
      const openRoutes = await tx.approvalRoute.findMany({ where: { documentVersionId: revision.id, status: { in: ['PENDING', 'REVIEWED'] } }, select: { id: true } });
      await tx.approvalRouteStep.updateMany({ where: { approvalRouteId: { in: openRoutes.map((route) => route.id) }, status: 'PENDING' }, data: { status: 'CANCELLED', completedAt: new Date() } });
      await tx.approvalRoute.updateMany({ where: { id: { in: openRoutes.map((route) => route.id) } }, data: { status: 'CANCELLED' } });
      await writeMandatoryAudit(tx, {
        context: user, action: 'DOCUMENT_REVISION_WITHDRAWN', objectType: 'DocumentVersion', objectId: revision.id,
        payload: { documentId: id, version: revision.versionNumber, before: revision.status, after: 'WITHDRAWN', effectiveVersion: effective.versionNumber, reason, cancelledRoutes: openRoutes.length },
        requestUrl: req.nextUrl.pathname,
      });
    });
    return NextResponse.json({ success: true, status: 'EFFECTIVE', currentVersion: effective.versionNumber, withdrawnVersion: revision.versionNumber });
  } catch (error) {
    const lifecycle = lifecycleErrorResponse(error);
    if (lifecycle) return NextResponse.json({ error: { code: lifecycle.code, message: lifecycle.message } }, { status: lifecycle.status });
    if ((error as Error).message === 'STALE_WITHDRAWAL') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'Document state changed; refresh and try again' } }, { status: 409 });
    reportServerError('document.withdrawRevision');
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to withdraw the revision' } }, { status: 500 });
  }
}
