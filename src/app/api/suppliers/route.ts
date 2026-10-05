import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { hasPermission } from '../../../lib/rbac';
import { unexpectedErrorResponse } from '../../../lib/server-errors';

// GET /api/suppliers - Tenant-scoped recovery read.
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'supplier.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Supplier read permission is required' } }, { status: 403 });
    }

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: user.tenantId },
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
        attachments: {
          select: { id: true, supplierId: true, fileName: true, fileType: true, fileData: true, uploadedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.membershipRole,
      action: 'Supplier.List',
      objectType: 'Supplier',
      payload: { countReturned: suppliers.length },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ suppliers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return unexpectedErrorResponse('supplier.list', 'InternalServerError');
  }
}

function mutationDisabled(operation: string) {
  return NextResponse.json(
    { error: { code: 'SupplierMutationDisabled', message: `${operation} is temporarily unavailable` } },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' } },
  );
}

export async function POST() {
  return mutationDisabled('Supplier registration');
}

export async function PUT() {
  return mutationDisabled('Supplier attachment upload');
}

export async function DELETE() {
  return mutationDisabled('Supplier attachment deletion');
}
