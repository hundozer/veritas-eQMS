import { NextRequest, NextResponse } from 'next/server';
import { getContext, logAuditEvent } from '@/lib/auth';
import { DEFAULT_SYSTEM_ROLES, SYSTEM_PERMISSIONS } from '@/lib/permissions';

// GET /api/roles - List system default roles and permissions registry
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    return NextResponse.json({
      roles: DEFAULT_SYSTEM_ROLES,
      permissions: SYSTEM_PERMISSIONS,
    });
  } catch (error: any) {
    console.error('List roles error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
