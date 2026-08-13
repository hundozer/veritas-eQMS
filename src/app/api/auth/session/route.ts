import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getContext(req);
  if (!user) {
    return NextResponse.json(
      { error: { code: 'Unauthorized', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  return NextResponse.json({ user });
}
