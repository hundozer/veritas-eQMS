import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// GET /api/capas - List all CAPAs inside the tenant
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const capas = await prisma.cAPA.findMany({
      where: { tenantId: user.tenantId },
      include: {
        assignedTo: true,
        deviation: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Log the read audit log
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CAPA.List',
      objectType: 'CAPA',
      payload: { countReturned: capas.length },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ capas });
  } catch (error: any) {
    console.error('List CAPAs error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/capas - Log a new CAPA
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Only Admin, Owner, or Approver can assign new CAPAs (not Employee/Auditor)
    if (user.role === 'EMPLOYEE' || user.role === 'AUDITOR') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Insufficient role to create CAPAs' } }, { status: 403 });
    }

    const body = await req.json();
    const { title, actionPlan, dueDate, assignedToId, deviationId } = body;

    if (!title || !actionPlan || !dueDate || !assignedToId) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Title, actionPlan, dueDate, and assignedToId are required' } }, { status: 400 });
    }

    // Verify the assignee belongs to this tenant
    const assignee = await prisma.user.findFirst({
      where: {
        id: assignedToId,
        tenantId: user.tenantId
      }
    });

    if (!assignee) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Assignee user not found in this tenant' } }, { status: 404 });
    }

    const capa = await prisma.cAPA.create({
      data: {
        tenantId: user.tenantId,
        title,
        actionPlan,
        status: 'OPEN',
        dueDate: new Date(dueDate),
        assignedToId,
        deviationId: deviationId || null,
      },
      include: {
        assignedTo: true,
        deviation: true
      }
    });

    // Log creation audit log
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'CAPA.Create',
      objectType: 'CAPA',
      objectId: capa.id,
      payload: {
        title: capa.title,
        assignedTo: assignee.fullName,
        deviationId: capa.deviationId,
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ capa }, { status: 201 });
  } catch (error: any) {
    console.error('Create CAPA error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
