import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext } from '@/lib/auth';

// GET /api/users - List all users in the current tenant (for the Switch Role Bar)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
      },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('List tenant users error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
