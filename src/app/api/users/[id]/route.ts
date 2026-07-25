import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// PUT /api/users/[id] - Update user role, department, or clearance (Admin/Owner only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const adminUser = await getContext(req);
    if (!adminUser) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (adminUser.role !== 'OWNER' && adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only Organization Owners or QA Administrators can reassign user roles' } }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser || targetUser.tenantId !== adminUser.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Target user not found in your tenant organization' } }, { status: 404 });
    }

    const body = await req.json();
    const { role, department, clearance, fullName } = body;

    const previousRole = targetUser.role;
    const previousDept = targetUser.department;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: role || targetUser.role,
        department: department || targetUser.department,
        clearance: clearance || targetUser.clearance,
        fullName: fullName || targetUser.fullName,
      },
    });

    // Log GxP audit event for role modification
    await logAuditEvent({
      tenantId: adminUser.tenantId,
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: adminUser.role,
      action: 'User.RoleUpdate',
      objectType: 'User',
      objectId: id,
      payload: {
        targetUserEmail: updatedUser.email,
        targetUserFullName: updatedUser.fullName,
        previousRole,
        newRole: updatedUser.role,
        previousDepartment: previousDept,
        newDepartment: updatedUser.department,
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error: any) {
    console.error('Update user role error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Deactivate/Remove user from organization (Admin/Owner only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const adminUser = await getContext(req);
    if (!adminUser) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (adminUser.role !== 'OWNER' && adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only Organization Owners or QA Administrators can remove team members' } }, { status: 403 });
    }

    if (adminUser.id === id) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'You cannot remove your own active Admin account' } }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser || targetUser.tenantId !== adminUser.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Target user not found' } }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });

    await logAuditEvent({
      tenantId: adminUser.tenantId,
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: adminUser.role,
      action: 'User.Remove',
      objectType: 'User',
      objectId: id,
      payload: { removedUserEmail: targetUser.email, removedUserRole: targetUser.role },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove user error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
