import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST /api/auth/login - Authenticate or switch user session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Email address is required' } }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'User account not found' } }, { status: 404 });
    }

    const response = NextResponse.json({ user });
    response.cookies.set('user-email', user.email, { path: '/', maxAge: 86400 * 30 });

    return response;
  } catch (error: any) {
    console.error('POST /api/auth/login error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
