import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext } from '@/lib/auth';

// GET /api/users - List users (tenant-scoped if authenticated, or all system demo users for persona login)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);

    const where = user ? { tenantId: user.tenantId } : {};

    const users = await prisma.user.findMany({
      where,
      include: { tenant: true },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('List users error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
