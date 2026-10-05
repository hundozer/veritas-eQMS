import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '../../../lib/rbac';
import { userAdministrationMutationDisabled } from '../../../lib/recovery-disabled';
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

    const users = await prisma.user.findMany({
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
    });

    return NextResponse.json({ users }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return unexpectedErrorResponse('user.list');
  }
}

// Provisioning remains unavailable until IAM identity, credential activation,
// membership, operational user, role assignment, and audit are one workflow.
export const POST = userAdministrationMutationDisabled;
