import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';
import { getP0RoleDefinitions, hasPermission, P0_PERMISSIONS } from '@/lib/rbac';

// GET /api/roles - List system default roles and permissions registry
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'users.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    return NextResponse.json({
      roles: getP0RoleDefinitions(),
      permissions: P0_PERMISSIONS,
    });
  } catch (error: any) {
    console.error('List roles error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
