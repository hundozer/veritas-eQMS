import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// GET /api/equipment/[id] - Retrieve equipment details with maintenance logs
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const { id } = await params;

    const equipment = await prisma.equipment.findUnique({
      where: { id },
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

    if (!equipment || equipment.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Equipment not found' } }, { status: 404 });
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Equipment.View',
      objectType: 'Equipment',
      objectId: equipment.id,
      payload: { name: equipment.name, status: equipment.status },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ equipment });
  } catch (error: any) {
    console.error('Get equipment error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
