import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '../../../../../lib/auth';
import { hasPermission } from '../../../../../lib/rbac';
import { changeMemberRole, RoleChangeError } from '../../../../../lib/iam/role-change';
import { unexpectedErrorResponse } from '../../../../../lib/server-errors';

// POST /api/users/[id]/role - change a member's organisation role (VER-00.3)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    if (!hasPermission(user, 'users.update')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const role = await changeMemberRole(user, id, { roleId: body?.roleId, reason: body?.reason, requestUrl: req.nextUrl.pathname });
    return NextResponse.json({ success: true, role }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof RoleChangeError) {
      const refusal = error;
      return NextResponse.json({ error: { code: refusal.code, message: refusal.publicMessage } }, { status: refusal.status });
    }
    return unexpectedErrorResponse('user.roleChange');
  }
}
