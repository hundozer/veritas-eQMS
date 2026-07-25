import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

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

// POST /api/users - Invite / Add new employee to tenant organization with assigned role
export async function POST(req: NextRequest) {
  try {
    const adminUser = await getContext(req);
    if (!adminUser) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (adminUser.role !== 'OWNER' && adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only Organization Owners or QA Administrators can invite team members and assign roles' } }, { status: 403 });
    }

    const body = await req.json();
    const { email, fullName, role, department, clearance, site, employmentType, expiresAt, firstName, lastName, phone } = body;

    if (!email || !fullName || !role) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Email, Full Name, and Role are required' } }, { status: 400 });
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: { code: 'Conflict', message: 'A user with this email address already exists in the system' } }, { status: 409 });
    }

    const newUser = await prisma.user.create({
      data: {
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
      },
    });

    // Auto-assign existing mandatory training requirements for this role/department
    const matchingReqs = await prisma.trainingRequirement.findMany({
      where: {
        document: { tenantId: adminUser.tenantId, status: 'EFFECTIVE' },
      },
    });

    let assignedCount = 0;
    for (const reqItem of matchingReqs) {
      const roles = reqItem.requiredForRoles.split(',');
      if (roles.includes(newUser.role) || roles.includes(newUser.department)) {
        await prisma.trainingAssignment.create({
          data: {
            requirementId: reqItem.id,
            userId: newUser.id,
            status: 'ASSIGNED',
          },
        });
        assignedCount++;
      }
    }

    await logAuditEvent({
      tenantId: adminUser.tenantId,
      userId: adminUser.id,
      userEmail: adminUser.email,
      userRole: adminUser.role,
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
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ user: newUser, trainingAssignmentsCreated: assignedCount }, { status: 201 });
  } catch (error: any) {
    console.error('Invite user error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
