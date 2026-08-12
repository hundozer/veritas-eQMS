import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isPlatformAdminEmail, isGodModeUser } from '@/lib/auth';

// POST /api/auth/login - Authenticate or switch user session (supports admin passwords)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Email address is required' } }, { status: 400 });
    }

    const isAdmin = isPlatformAdminEmail(email);

    // If it's a Platform Admin, verify password
    if (isAdmin) {
      const correctPassword = process.env.ADMIN_PASSWORD;
      if (!correctPassword || !password || password !== correctPassword) {
        return NextResponse.json({ error: { code: 'Unauthorized', message: 'Invalid operator credentials' } }, { status: 401 });
      }

      // Check if user exists, if not auto-provision in the DB
      let user = await prisma.user.findUnique({
        where: { email },
        include: { tenant: true },
      });

      if (!user) {
        let defaultTenant = await prisma.tenant.findFirst();
        if (!defaultTenant) {
          defaultTenant = await prisma.tenant.create({
            data: { name: 'Simpleafied Biotech' },
          });
        }

        const isGod = isGodModeUser(email);
        user = await prisma.user.create({
          data: {
            email,
            fullName: isGod ? 'God Mode Administrator' : email.split('@')[0].toUpperCase() + ' Operator',
            role: 'ADMIN',
            department: 'REGULATORY',
            clearance: 'RESTRICTED',
            tenantId: defaultTenant.id,
          },
          include: { tenant: true },
        });
      }

      const response = NextResponse.json({ user });
      response.cookies.set('user-email', user.email, { path: '/', maxAge: 86400 * 30 });
      return response;
    }

    // Normal customer login path (session switcher)
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
