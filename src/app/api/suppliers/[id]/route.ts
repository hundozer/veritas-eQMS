import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '../../../../lib/rbac';
import { unexpectedErrorResponse } from '../../../../lib/server-errors';

// GET /api/suppliers/[id] - Fetch single supplier with detailed history
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'supplier.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Supplier read permission is required' } }, { status: 403 });
    }

    const { id } = await params;

    const supplier = await prisma.supplier.findFirst({
      where: { id, tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        contactEmail: true,
        contactPhone: true,
        category: true,
        status: true,
        riskClassification: true,
        qualificationDate: true,
        reEvaluationDueDate: true,
        notes: true,
        createdAt: true,
        audits: {
          select: {
            id: true,
            supplierId: true,
            auditorId: true,
            auditDate: true,
            auditType: true,
            findings: true,
            result: true,
            esignSignatureId: true,
            createdAt: true,
            auditor: { select: { fullName: true } },
          },
          orderBy: { auditDate: 'desc' },
        },
        materialReceipts: {
          select: {
            id: true,
            supplierId: true,
            materialName: true,
            lotNumber: true,
            quantityReceived: true,
            unit: true,
            inspectionStatus: true,
            inspectedById: true,
            notes: true,
            receivedAt: true,
            createdAt: true,
            inspectedBy: { select: { fullName: true } },
          },
          orderBy: { receivedAt: 'desc' },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Supplier not found' } }, { status: 404 });
    }

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.membershipRole,
      action: 'Supplier.Read',
      objectType: 'Supplier',
      objectId: supplier.id,
      payload: { supplierName: supplier.name },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ supplier }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return unexpectedErrorResponse('supplier.get', 'InternalServerError');
  }
}
