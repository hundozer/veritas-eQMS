import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// POST /api/equipment/[id]/logs - Log a calibration or maintenance activity with E-Sign
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { activityType, notes, result, password } = body;

    // Validate required fields
    if (!activityType || !notes || !result || !password) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Activity type, notes, result, and E-Sign password are required' } }, { status: 400 });
    }

    if (!['CALIBRATION', 'PREVENTATIVE_MAINTENANCE', 'REPAIR'].includes(activityType)) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Activity type must be CALIBRATION, PREVENTATIVE_MAINTENANCE, or REPAIR' } }, { status: 400 });
    }

    if (!['PASS', 'FAIL'].includes(result)) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Result must be PASS or FAIL' } }, { status: 400 });
    }

    // 21 CFR Part 11 E-Signature verification (mock password check)
    if (password !== 'password123') {
      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'Equipment.ESign.Failed',
        objectType: 'Equipment',
        objectId: id,
        payload: { reason: 'Invalid E-Signature password' },
        status: 'Denied',
        requestUrl: req.nextUrl.pathname,
      });
      return NextResponse.json({ error: { code: 'ESignFailed', message: '21 CFR Part 11 E-Signature verification failed. Incorrect password.' } }, { status: 403 });
    }

    // Fetch equipment
    const equipment = await prisma.equipment.findUnique({ where: { id } });
    if (!equipment || equipment.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Equipment not found' } }, { status: 404 });
    }

    // Generate E-Sign signature ID
    const esignSigId = `esign-${user.id}-${Date.now()}`;

    // Create the maintenance log
    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId: id,
        performedById: user.id,
        activityType,
        notes,
        result,
        esignSignatureId: esignSigId,
      },
      include: { performedBy: true }
    });

    // Update equipment state based on result
    const now = new Date();
    if (result === 'PASS' && activityType === 'CALIBRATION') {
      // Successful calibration: update last calibrated date and compute next due date
      const nextDue = new Date(now.getTime() + 1000 * 60 * 60 * 24 * equipment.calibrationIntervalDays);
      await prisma.equipment.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          lastCalibratedAt: now,
          nextCalibrationDueDate: nextDue,
        }
      });
    } else if (result === 'FAIL') {
      // Failed calibration/maintenance: take equipment out of service
      await prisma.equipment.update({
        where: { id },
        data: { status: 'OUT_OF_SERVICE' }
      });

      // Auto-create a MAJOR deviation for the failed calibration
      const deviation = await prisma.deviation.create({
        data: {
          tenantId: user.tenantId,
          title: `DEV-AUTO-${id}: ${activityType} Failure`,
          description: `Equipment "${equipment.name}" (ID: ${id}) ${activityType.toLowerCase()} resulted in FAIL. Notes: ${notes}. Equipment has been taken OUT_OF_SERVICE.`,
          classification: 'MAJOR',
          status: 'LOGGED',
          detectedById: user.id,
          equipmentId: id,
        }
      });

      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'Equipment.AutoDeviation',
        objectType: 'Equipment',
        objectId: id,
        payload: {
          deviationId: deviation.id,
          result: 'FAIL',
          activityType,
          reason: `${activityType} failure triggered auto-deviation`,
        },
        status: 'Success',
        requestUrl: req.nextUrl.pathname,
      });
    }

    // Audit log the maintenance/calibration event
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Equipment.MaintenanceLog',
      objectType: 'MaintenanceLog',
      objectId: log.id,
      payload: {
        equipmentId: id,
        equipmentName: equipment.name,
        activityType,
        result,
        esignSignatureId: esignSigId,
        esignMeaning: `21 CFR Part 11 E-Signed ${activityType} log`,
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (error: any) {
    console.error('Create maintenance log error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
