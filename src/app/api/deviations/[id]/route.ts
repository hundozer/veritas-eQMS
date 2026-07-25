import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

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

    const deviation = await prisma.deviation.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!deviation) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Deviation not found' } }, { status: 404 });
    }

    // Only Admin, Owner, or Approver can update deviation investigation details
    if (user.role === 'EMPLOYEE' || user.role === 'AUDITOR') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient role to perform investigation' } }, { status: 403 });
    }

    const body = await req.json();
    const { investigatorId, investigationNotes, status } = body;

    const updatedDeviation = await prisma.deviation.update({
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

    // Log the update event
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Deviation.Update',
      objectType: 'Deviation',
      objectId: deviation.id,
      payload: {
        title: updatedDeviation.title,
        status: updatedDeviation.status,
        investigatorAssigned: !!investigatorId,
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ deviation: updatedDeviation });
  } catch (error: any) {
    console.error('Update deviation error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
