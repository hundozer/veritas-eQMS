import { NextRequest, NextResponse } from 'next/server';
import { tenantRead } from '@/lib/tenant-db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '../../../lib/rbac';
import { inviteMember, pendingInvitationUserIds, ProvisioningError, type InviteInput } from '@/lib/iam/provisioning';
import { unexpectedErrorResponse } from '../../../lib/server-errors';

// GET /api/users - List users (tenant-scoped if authenticated, or all system demo users for persona login)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'users.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    const users = await tenantRead(user.tenantId, (tx) => tx.user.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        fullName: true,
        email: true,
        accountStatus: true,
        role: true,
        department: true,
        site: true,
        employmentType: true,
        clearance: true,
        expiresAt: true,
      },
      orderBy: { fullName: 'asc' },
    }));
    const pending = await pendingInvitationUserIds(user.tenantId);

    return NextResponse.json(
      { users: users.map((member) => ({ ...member, invitationPending: pending.has(member.id) })) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    return unexpectedErrorResponse('user.list');
  }
}

// POST /api/users - invite a person into the caller's organisation (DEC-063)
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'users.create')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }
    const body: unknown = await req.json().catch(() => null);
    const invited = await inviteMember(user, (body && typeof body === "object" ? body : {}) as InviteInput, req.nextUrl.pathname);
    return NextResponse.json({ user: invited }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ProvisioningError) {
      const failure = error;
      return NextResponse.json(
        { error: { code: failure.failure, message: failure.publicMessage, userId: failure.operationalUserId } },
        { status: failure.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return unexpectedErrorResponse('user.invite');
  }
}
