// EXAMPLE (type-checked, not shipped): a workflow action that moves a
// record to its next state, as src/app/api/<module>/[id]/submit/route.ts.
// The transition is checked by the lifecycle guard, then written with a
// status-guarded updateMany whose count must be 1 (someone else may have
// moved it meanwhile), and audited in the same transaction.
import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { tenantRead, tenantTransaction } from '@/lib/tenant-db';
import { writeMandatoryAudit } from '@/lib/audit';
import { reportServerError } from '@/lib/server-errors';
import { assertChangeTransition, ChangeLifecycleError } from './change-control-lifecycle.example';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'change.create')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Change-control permission is required' } }, { status: 403 });

    const change = await tenantRead(user.tenantId, (tx) => tx.changeRequest.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, status: true } }));
    if (!change) return NextResponse.json({ error: { code: 'NotFound', message: 'Change control not found' } }, { status: 404 });
    assertChangeTransition(change.status, 'UNDER_REVIEW');

    await tenantTransaction(user.tenantId, async (tx) => {
      const moved = await tx.changeRequest.updateMany({
        where: { id, tenantId: user.tenantId, status: change.status },
        data: { status: 'UNDER_REVIEW' },
      });
      if (moved.count !== 1) throw new Error('STALE_CHANGE');
      await writeMandatoryAudit(tx, {
        context: user, action: 'CHANGE_SUBMITTED', objectType: 'ChangeRequest', objectId: id,
        payload: { before: change.status, after: 'UNDER_REVIEW' },
        requestUrl: req.nextUrl.pathname,
      });
    });
    return NextResponse.json({ success: true, status: 'UNDER_REVIEW' });
  } catch (error) {
    if (error instanceof ChangeLifecycleError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409 });
    if ((error as Error).message === 'STALE_CHANGE') return NextResponse.json({ error: { code: 'StaleWorkflowAction', message: 'Change control state changed; refresh and try again' } }, { status: 409 });
    reportServerError('document.update');
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to submit change control' } }, { status: 500 });
  }
}
