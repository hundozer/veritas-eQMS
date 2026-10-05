import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '../../../lib/rbac';
import { unexpectedErrorResponse } from '../../../lib/server-errors';

// GET /api/equipment - Tenant-scoped read only. Deadline monitoring must run as
// an authorized, idempotent workflow and never as a side effect of a GET.
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'equipment.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Equipment read permission is required' } }, { status: 403 });
    }

    const equipment = await prisma.equipment.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        modelNumber: true,
        serialNumber: true,
        location: true,
        status: true,
        calibrationIntervalDays: true,
        lastCalibratedAt: true,
        nextCalibrationDueDate: true,
        createdAt: true,
        maintenanceLogs: {
          select: {
            id: true,
            equipmentId: true,
            performedById: true,
            performedAt: true,
            activityType: true,
            notes: true,
            result: true,
            esignSignatureId: true,
            createdAt: true,
            performedBy: { select: { fullName: true } },
          },
          orderBy: { performedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.membershipRole,
      action: 'Equipment.List',
      objectType: 'Equipment',
      payload: { countReturned: equipment.length },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ equipment }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return unexpectedErrorResponse('equipment.list');
  }
}

// Equipment creation stays unavailable until membership-derived equipment
// permissions and mandatory transactional audit evidence are implemented.
export async function POST() {
  return NextResponse.json(
    { error: { code: 'EquipmentMutationDisabled', message: 'Equipment registration is temporarily unavailable' } },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' } },
  );
}
