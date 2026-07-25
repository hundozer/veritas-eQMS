import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// POST /api/suppliers/[id]/receipts - Log incoming material receipt & inspection result
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { materialName, lotNumber, quantityReceived, unit, inspectionStatus, notes } = body;

    if (!materialName || !lotNumber || !quantityReceived || !inspectionStatus) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Material name, lot number, quantity, and inspection status are required' } }, { status: 400 });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier || supplier.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Supplier not found' } }, { status: 404 });
    }

    // Auto-create Deviation if incoming material fails inspection (REJECTED)
    let createdDeviationId: string | null = null;

    const receiptRecord = await prisma.$transaction(async (tx: any) => {
      const receipt = await tx.materialReceipt.create({
        data: {
          supplierId: id,
          materialName,
          lotNumber,
          quantityReceived: parseInt(quantityReceived),
          unit: unit || 'units',
          inspectionStatus,
          inspectedById: user.id,
          notes: notes || null,
        },
      });

      if (inspectionStatus === 'REJECTED') {
        const dev = await tx.deviation.create({
          data: {
            tenantId: user.tenantId,
            title: `DEV-2026-SUP: Material Rejection (${materialName} Lot ${lotNumber})`,
            description: `Incoming material receipt rejected during QC inspection. Supplier: ${supplier.name} (${supplier.id}). Material: ${materialName}, Lot: ${lotNumber}. Reason: ${notes || 'Failed QC acceptance criteria'}.`,
            classification: supplier.riskClassification === 'CRITICAL' ? 'CRITICAL' : 'MAJOR',
            status: 'LOGGED',
            detectedById: user.id,
          },
        });
        createdDeviationId = dev.id;
      }

      return receipt;
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Supplier.MaterialReceipt',
      objectType: 'MaterialReceipt',
      objectId: receiptRecord.id,
      payload: { supplierId: id, materialName, lotNumber, inspectionStatus, createdDeviationId },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ receipt: receiptRecord, createdDeviationId }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/suppliers/[id]/receipts error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
