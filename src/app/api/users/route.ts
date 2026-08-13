import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';

// GET /api/users - List users (tenant-scoped if authenticated, or all system demo users for persona login)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'users.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: { tenantId: user.tenantId },
      include: { tenant: true },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('List users error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/users - Invite / Add new employee to tenant organization with assigned role
export async function POST(req: NextRequest) {
  try {
    const adminUser = await getContext(req);
    if (!adminUser) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (!hasPermission(adminUser, 'users.create')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    const body = await req.json();
    const { email, fullName, role, department, clearance, site, employmentType, expiresAt, firstName, lastName, phone } = body;

    if (['PLATFORM_ADMIN', 'GOD', 'SUPER_ADMIN'].includes(String(role).toUpperCase())) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Platform privilege cannot be assigned here' } }, { status: 403 });
    }

    if (!email || !fullName || !role) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Email, Full Name, and Role are required' } }, { status: 400 });
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: { code: 'Conflict', message: 'A user with this email address already exists in the system' } }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({ data: {
        email,
        fullName,
        firstName: firstName || fullName.split(' ')[0],
        lastName: lastName || fullName.split(' ').slice(1).join(' '),
        phone: phone || null,
        role: role || 'EMPLOYEE',
        department: department || 'QA',
        clearance: clearance || 'INTERNAL',
        site: site || 'Main Facility',
        employmentType: employmentType || 'EMPLOYEE',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        tenantId: adminUser.tenantId,
      } });

    // Auto-assign existing mandatory training requirements for this role/department
    const matchingReqs = await tx.trainingRequirement.findMany({
      where: {
        document: { tenantId: adminUser.tenantId, status: 'EFFECTIVE' },
      },
    });

    let assignedCount = 0;
    for (const reqItem of matchingReqs) {
      const roles = reqItem.requiredForRoles.split(',');
      if (roles.includes(newUser.role) || roles.includes(newUser.department)) {
        await tx.trainingAssignment.create({
          data: {
            requirementId: reqItem.id,
            userId: newUser.id,
            status: 'ASSIGNED',
          },
        });
        assignedCount++;
      }
    }

      await writeMandatoryAudit(tx, {
      context: adminUser,
      action: 'User.Invite',
      objectType: 'User',
      objectId: newUser.id,
      payload: {
        newUserId: newUser.id,
        newUserEmail: newUser.email,
        assignedRole: newUser.role,
        assignedDepartment: newUser.department,
        trainingAssignmentsCreated: assignedCount,
      },
      requestUrl: req.nextUrl.pathname,
    });

      return { newUser, assignedCount };
    });

    return NextResponse.json({ user: result.newUser, trainingAssignmentsCreated: result.assignedCount }, { status: 201 });
  } catch (error: any) {
    console.error('Invite user error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
