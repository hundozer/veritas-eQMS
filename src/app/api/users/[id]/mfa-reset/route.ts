import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '../../../../../lib/auth';
import { hasPermission } from '../../../../../lib/rbac';
import { MfaResetError, resetMfa } from '../../../../../lib/iam/mfa';
import { unexpectedErrorResponse } from '../../../../../lib/server-errors';

// POST /api/users/[id]/mfa-reset - reset a member's two-step verification (DEC-080)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    if (!hasPermission(user, 'users.update')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    await resetMfa(user, id, { reason: body?.reason, requestUrl: req.nextUrl.pathname });
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MfaResetError) {
      const refusal = error;
      return NextResponse.json({ error: { code: refusal.code, message: refusal.publicMessage } }, { status: refusal.status });
    }
    return unexpectedErrorResponse('user.mfaReset');
  }
}
