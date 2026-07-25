import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// GET /api/equipment - List all equipment & execute compliance check for missed due dates
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // 1. Fetch active equipment
    const allEq = await prisma.equipment.findMany({
      where: { tenantId: user.tenantId },
      include: {
        maintenanceLogs: {
          include: { performedBy: true },
          orderBy: { performedAt: 'desc' }
        },
        deviations: {
          include: { detectedBy: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const now = new Date();
    let updatedAny = false;

    // 2. Compliance monitor checker for missed due dates
    for (const eq of allEq) {
      if (eq.status === 'ACTIVE' && new Date(eq.nextCalibrationDueDate) < now) {
        // Auto-update status to CALIBRATION_DUE
        await prisma.equipment.update({
          where: { id: eq.id },
          data: { status: 'CALIBRATION_DUE' }
        });

        // Auto-create a Deviation record
        const devTitle = `DEV-AUTO-${eq.id}: Calibration Overdue`;
        const devDesc = `Automated Compliance Alert: Equipment "${eq.name}" (ID: ${eq.id}, Serial: ${eq.serialNumber || 'N/A'}) has passed its scheduled calibration due date of ${new Date(eq.nextCalibrationDueDate).toLocaleDateString()}.`;

        const deviation = await prisma.deviation.create({
          data: {
            tenantId: user.tenantId,
            title: devTitle,
            description: devDesc,
            classification: 'MAJOR',
            status: 'LOGGED',
            detectedById: user.id, // Detected by the user checking compliance
            equipmentId: eq.id
          }
        });

        // Log this auto-deviation event in the audit trail
        await logAuditEvent({
          tenantId: user.tenantId,
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: 'Equipment.AutoDeviation',
          objectType: 'Equipment',
          objectId: eq.id,
          payload: {
            equipmentId: eq.id,
            equipmentName: eq.name,
            nextCalibrationDueDate: eq.nextCalibrationDueDate,
            deviationId: deviation.id,
            reason: 'Calibration due date exceeded'
          },
          status: 'Success',
          requestUrl: req.nextUrl.pathname
        });

        updatedAny = true;
      }
    }

    // Fetch fresh list if anything was updated
    const equipment = updatedAny 
      ? await prisma.equipment.findMany({
          where: { tenantId: user.tenantId },
          include: {
            maintenanceLogs: {
              include: { performedBy: true },
              orderBy: { performedAt: 'desc' }
            },
            deviations: {
              include: { detectedBy: true },
              orderBy: { createdAt: 'desc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      : allEq;

    // Log list read event
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Equipment.List',
      objectType: 'Equipment',
      payload: { countReturned: equipment.length },
      status: 'Success',
      requestUrl: req.nextUrl.pathname
    });

    return NextResponse.json({ equipment });
  } catch (error: any) {
    console.error('List equipment error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/equipment - Register a new piece of equipment
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, description, modelNumber, serialNumber, location, calibrationIntervalDays, lastCalibratedAt } = body;

    if (!id || !name || !location || !calibrationIntervalDays) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'ID, Name, Location, and Calibration Interval are required' } }, { status: 400 });
    }

    const interval = Number(calibrationIntervalDays);
    if (Number.isNaN(interval) || interval <= 0) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Calibration interval must be a positive number of days' } }, { status: 400 });
    }

    // Check if ID is already taken
    const existing = await prisma.equipment.findUnique({
      where: { id }
    });
    if (existing) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Equipment ID already exists' } }, { status: 400 });
    }

    const lastCalDate = lastCalibratedAt ? new Date(lastCalibratedAt) : new Date();
    const nextCalDate = new Date(lastCalDate.getTime() + 1000 * 60 * 60 * 24 * interval);

    const equipment = await prisma.equipment.create({
      data: {
        id,
        tenantId: user.tenantId,
        name,
        description,
        modelNumber,
        serialNumber,
        location,
        status: 'ACTIVE',
        calibrationIntervalDays: interval,
        lastCalibratedAt: lastCalDate,
        nextCalibrationDueDate: nextCalDate
      }
    });

    // Audit log registration
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Equipment.Create',
      objectType: 'Equipment',
      objectId: equipment.id,
      payload: {
        name: equipment.name,
        location: equipment.location,
        interval: equipment.calibrationIntervalDays,
        nextCalibrationDueDate: equipment.nextCalibrationDueDate
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname
    });

    return NextResponse.json({ equipment }, { status: 201 });
  } catch (error: any) {
    console.error('Create equipment error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
