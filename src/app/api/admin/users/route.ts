import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';

async function denyUnmodeledPlatformAdministration(req: NextRequest) {
  const user = await getContext(req);
  if (!user) {
    return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
  }
  return NextResponse.json(
    { error: { code: 'Forbidden', message: 'Platform administration is not available through tenant RBAC' } },
    { status: 403 },
  );
}

export const GET = denyUnmodeledPlatformAdministration;
export const POST = denyUnmodeledPlatformAdministration;
