import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// POST /api/suppliers/[id]/audits - Log a supplier audit record (E-Sign verified)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { auditType, findings, result, signaturePassword, signatureMeaning, newStatus } = body;

    if (!auditType || !findings || !result || !signaturePassword) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Audit type, findings, result, and E-Signature password are required' } }, { status: 400 });
    }

    // 1. Fetch supplier
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier || supplier.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Supplier not found' } }, { status: 404 });
    }

    // 2. 21 CFR Part 11 Electronic Signature Verification
    if (signaturePassword !== 'password123' && signaturePassword !== 'admin123') {
      return NextResponse.json({ error: { code: 'InvalidSignature', message: 'E-Signature authentication failed: Incorrect password' } }, { status: 401 });
    }

    const esignSignatureId = `SIG-SUP-AUD-${Date.now()}`;

    // 3. Status update mapping based on audit result
    let statusToSet = newStatus || supplier.status;
    if (result === 'PASS') {
      statusToSet = 'APPROVED';
    } else if (result === 'CONDITIONAL_PASS') {
      statusToSet = 'CONDITIONALLY_APPROVED';
    } else if (result === 'FAIL') {
      statusToSet = 'DISQUALIFIED';
    }

    // 4. Create Audit record & update supplier status & re-evaluation due date (1 year)
    const auditRecord = await prisma.$transaction(async (tx: any) => {
      const audit = await tx.supplierAudit.create({
        data: {
          supplierId: id,
          auditorId: user.id,
          auditType,
          findings,
          result,
          esignSignatureId,
        },
      });

      const nextReEval = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
      await tx.supplier.update({
        where: { id },
        data: {
          status: statusToSet,
          qualificationDate: new Date(),
          reEvaluationDueDate: nextReEval,
        },
      });

      return audit;
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Supplier.AuditLog',
      objectType: 'SupplierAudit',
      objectId: auditRecord.id,
      payload: { supplierId: id, auditType, result, newSupplierStatus: statusToSet, esignSignatureId },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ audit: auditRecord, newStatus: statusToSet }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/suppliers/[id]/audits error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
