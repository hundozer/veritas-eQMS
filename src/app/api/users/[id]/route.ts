import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';

// PUT /api/users/[id] - Update user role, department, or clearance (Admin/Owner only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const adminUser = await getContext(req);
    if (!adminUser) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (!hasPermission(adminUser, 'users.update')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser || targetUser.tenantId !== adminUser.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Target user not found in your tenant organization' } }, { status: 404 });
    }

    const body = await req.json();
    const { role, department, clearance, fullName, site, employmentType, expiresAt } = body;
    if (role && ['PLATFORM_ADMIN', 'GOD', 'SUPER_ADMIN'].includes(String(role).toUpperCase())) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Platform privilege cannot be assigned here' } }, { status: 403 });
    }

    const previousRole = targetUser.role;
    const previousDept = targetUser.department;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
      where: { id },
      data: {
        role: role || targetUser.role,
        department: department || targetUser.department,
        clearance: clearance || targetUser.clearance,
        fullName: fullName || targetUser.fullName,
        site: site !== undefined ? site : targetUser.site,
        employmentType: employmentType !== undefined ? employmentType : targetUser.employmentType,
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : targetUser.expiresAt,
      },
    });

    // Log GxP audit event for role modification
      await writeMandatoryAudit(tx, {
      context: adminUser,
      action: 'User.RoleUpdate',
      objectType: 'User',
      objectId: id,
      payload: {
        targetUserEmail: updated.email,
        targetUserFullName: updated.fullName,
        previousRole,
        newRole: updated.role,
        previousDepartment: previousDept,
        newDepartment: updated.department,
      },
      requestUrl: req.nextUrl.pathname,
    });
      return updated;
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

    if (!hasPermission(adminUser, 'users.deactivate')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    if (adminUser.id === id) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'You cannot remove your own active Admin account' } }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser || targetUser.tenantId !== adminUser.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Target user not found' } }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { accountStatus: 'INACTIVE' } });
      await writeMandatoryAudit(tx, {
      context: adminUser,
      action: 'User.Deactivate',
      objectType: 'User',
      objectId: id,
      payload: { removedUserEmail: targetUser.email, removedUserRole: targetUser.role },
      requestUrl: req.nextUrl.pathname,
    });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove user error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
