import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { writeMandatoryAudit } from '@/lib/audit';

// GET /api/deviations/[id] - Retrieve details for a single deviation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'nonconformance.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    const { id } = await params;

    const deviation = await prisma.deviation.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        detectedBy: true,
        investigator: true,
        capas: {
          include: {
            assignedTo: true
          }
        }
      }
    });

    if (!deviation) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Deviation not found' } }, { status: 404 });
    }

    // Log view audit event
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Deviation.View',
      objectType: 'Deviation',
      objectId: deviation.id,
      payload: { title: deviation.title },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ deviation });
  } catch (error: any) {
    console.error('View deviation error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// PUT /api/deviations/[id] - Update investigation notes and status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { investigatorId, investigationNotes, status } = body;
    if (!hasPermission(user, status === 'CLOSED' ? 'nonconformance.close' : 'nonconformance.investigate')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient permission' } }, { status: 403 });
    }

    const deviation = await prisma.deviation.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!deviation) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Deviation not found' } }, { status: 404 });
    }

    const updatedDeviation = await prisma.$transaction(async (tx) => {
      const updated = await tx.deviation.update({
      where: { id },
      data: {
        investigatorId: investigatorId !== undefined ? investigatorId : deviation.investigatorId,
        investigationNotes: investigationNotes !== undefined ? investigationNotes : deviation.investigationNotes,
        status: status || deviation.status,
      },
      include: {
        detectedBy: true,
        investigator: true,
        capas: {
          include: {
            assignedTo: true
          }
        }
      }
      });
      await writeMandatoryAudit(tx, {
      context: user,
      action: 'Deviation.Update',
      objectType: 'Deviation',
      objectId: deviation.id,
      payload: {
        previousStatus: deviation.status,
        status: updated.status,
        investigatorAssigned: !!investigatorId,
      },
      requestUrl: req.nextUrl.pathname,
    });
      return updated;
    });

    return NextResponse.json({ deviation: updatedDeviation });
  } catch (error: any) {
    console.error('Update deviation error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
