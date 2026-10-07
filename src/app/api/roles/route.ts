import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { assignableRoles } from '@/lib/iam/provisioning';
import { unexpectedErrorResponse } from '../../../lib/server-errors';

// GET /api/roles - roles the caller may assign when inviting
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    if (!hasPermission(user, 'users.create')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    return NextResponse.json({ roles: await assignableRoles(user) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return unexpectedErrorResponse('role.list');
  }
}
