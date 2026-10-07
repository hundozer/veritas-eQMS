import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getContext(req);
  if (!user) {
    return NextResponse.json(
      { error: { code: 'Unauthorized', message: 'Authentication required' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      clearance: user.clearance,
      tenantId: user.tenantId,
      tenantName: user.tenantName,
      permissions: [...user.permissions],
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
