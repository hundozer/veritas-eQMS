import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// PUT /api/capas/[id] - Update CAPA status (e.g., execute closure with E-Sign)
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

    const capa = await prisma.cAPA.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        assignedTo: true
      }
    });

    if (!capa) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'CAPA not found' } }, { status: 404 });
    }

    const body = await req.json();
    const { status, password } = body;

    if (!status) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Status is required' } }, { status: 400 });
    }

    // E-Sign password validation if closing CAPA
    if (status === 'CLOSED') {
      if (!password) {
        return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Electronic signature password is required to close a GxP CAPA' } }, { status: 400 });
      }

      // Verify E-Sign password
      if (password !== 'password123') {
        await logAuditEvent({
          tenantId: user.tenantId,
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: 'CAPA.CloseSignature',
          objectType: 'CAPA',
          objectId: id,
          payload: { error: 'Incorrect password entered during E-Sign' },
          status: 'Failed',
          requestUrl: req.nextUrl.pathname,
        });

        return NextResponse.json({ error: { code: 'Forbidden', message: 'Invalid password' } }, { status: 403 });
      }
    }

    const updatedCapa = await prisma.cAPA.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'CLOSED' ? new Date() : capa.completedAt,
      },
      include: {
        assignedTo: true,
        deviation: true
      }
    });

    // Log closure audit event
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: status === 'CLOSED' ? 'CAPA.Close' : 'CAPA.Update',
      objectType: 'CAPA',
      objectId: id,
      payload: {
        title: updatedCapa.title,
        status: updatedCapa.status,
        eSigned: status === 'CLOSED',
      },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ capa: updatedCapa });
  } catch (error: any) {
    console.error('Update CAPA error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
