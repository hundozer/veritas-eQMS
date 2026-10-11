import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '../../../../../lib/auth';
import { hasPermission } from '../../../../../lib/rbac';
import { DeactivationError, deactivateMember } from '../../../../../lib/iam/deactivation';
import { unexpectedErrorResponse } from '../../../../../lib/server-errors';

// POST /api/users/[id]/deactivate - deactivate a member who has left (VER-00.4)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    if (!hasPermission(user, 'users.deactivate')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const result = await deactivateMember(user, id, { reason: body?.reason, requestUrl: req.nextUrl.pathname });
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof DeactivationError) {
      const refusal = error;
      return NextResponse.json({ error: { code: refusal.code, message: refusal.publicMessage } }, { status: refusal.status });
    }
    return unexpectedErrorResponse('user.deactivate');
  }
}
