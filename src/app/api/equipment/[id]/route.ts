import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '../../../../lib/rbac';
import { unexpectedErrorResponse } from '../../../../lib/server-errors';

// GET /api/equipment/[id] - Retrieve equipment details with maintenance logs
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'equipment.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Equipment read permission is required' } }, { status: 403 });
    }

    const { id } = await params;

    const equipment = await prisma.equipment.findFirst({
      where: { id, tenantId: user.tenantId },
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
          orderBy: { performedAt: 'desc' }
        }
      }
    });

    if (!equipment) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Equipment not found' } }, { status: 404 });
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.membershipRole,
      action: 'Equipment.View',
      objectType: 'Equipment',
      objectId: equipment.id,
      payload: { name: equipment.name, status: equipment.status },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ equipment }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return unexpectedErrorResponse('equipment.get');
  }
}
