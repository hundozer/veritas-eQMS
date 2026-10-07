import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { ProvisioningError, resendInvitation } from '@/lib/iam/provisioning';
import { unexpectedErrorResponse } from '../../../../../lib/server-errors';

// POST /api/users/[id]/invitation - send a fresh password-setup link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    if (!hasPermission(user, 'users.create')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    await resendInvitation(user, id, req.nextUrl.pathname);
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ProvisioningError) {
      const failure = error;
      return NextResponse.json({ error: { code: failure.failure, message: failure.publicMessage } }, { status: failure.status });
    }
    return unexpectedErrorResponse('user.resendInvitation');
  }
}
