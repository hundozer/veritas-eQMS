import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// GET /api/suppliers/[id] - Fetch single supplier with detailed history
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        audits: {
          include: { auditor: true },
          orderBy: { auditDate: 'desc' },
        },
        materialReceipts: {
          include: { inspectedBy: true },
          orderBy: { receivedAt: 'desc' },
        },
      },
    });

    if (!supplier || supplier.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Supplier not found' } }, { status: 404 });
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Supplier.Read',
      objectType: 'Supplier',
      objectId: supplier.id,
      payload: { supplierName: supplier.name },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ supplier });
  } catch (error: any) {
    console.error('GET /api/suppliers/[id] error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
