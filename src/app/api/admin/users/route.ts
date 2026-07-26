import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, isPlatformAdminEmail, isGodModeUser, logAuditEvent } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user || !isPlatformAdminEmail(user.email)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access Denied: Simpleafied Admins only' } }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      include: {
        tenant: {
          select: { name: true },
        },
      },
      orderBy: { email: 'asc' },
    });

    return NextResponse.json(users);
  } catch (error: any) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user || !isPlatformAdminEmail(user.email)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access Denied: Simpleafied Admins only' } }, { status: 403 });
    }

    const body = await req.json();
    const { action, userId, newRole, email, fullName, role, department, tenantId } = body;

    // Handle user provisioning under a specific tenant workspace
    if (action === 'CREATE_USER') {
      if (!email || !fullName || !role || !tenantId) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Email, Full Name, Role, and Tenant Workspace are required' } }, { status: 400 });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: { code: 'Conflict', message: 'A user with this email address already exists' } }, { status: 409 });
      }

      const newUser = await prisma.user.create({
        data: {
          email,
          fullName,
          firstName: fullName.split(' ')[0],
          lastName: fullName.split(' ').slice(1).join(' '),
          role,
          department: department || 'QA',
          clearance: 'INTERNAL',
          site: 'Main Facility',
          employmentType: 'EMPLOYEE',
          tenantId,
        },
      });

      await logAuditEvent({
        tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'PlatformAdmin.CreateUser',
        objectType: 'User',
        objectId: newUser.id,
        payload: { email, fullName, role, department, tenantId },
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });

      return NextResponse.json({ success: true, user: newUser });
    }

    // Only God Mode user can promote/demote other users to Admin role
    if (!isGodModeUser(user.email)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access Denied: Only the Simpleafied God Mode User can designate other Admins.' } }, { status: 403 });
    }

    if (!userId || !newRole) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'userId and newRole are required' } }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'User not found' } }, { status: 404 });
    }

    // Check if the user email is in the whitelisted domains to be admin
    if (newRole === 'ADMIN' && !isPlatformAdminEmail(targetUser.email)) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access Denied: Only users with @simpleafied.app, @simpleafied.eu, or @simpleafied.de email addresses can be promoted to Platform Admin.' } }, { status: 403 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: newRole === 'ADMIN' ? 'PlatformAdmin.PromoteUser' : 'PlatformAdmin.DemoteUser',
      objectType: 'User',
      objectId: targetUser.id,
      payload: { targetUserEmail: targetUser.email, oldRole: targetUser.role, newRole },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('POST /api/admin/users error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
