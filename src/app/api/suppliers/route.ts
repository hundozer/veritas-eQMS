import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// GET /api/suppliers - Get all suppliers for tenant with audit & receipt history
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: user.tenantId },
      include: {
        audits: {
          include: { auditor: true },
          orderBy: { auditDate: 'desc' },
        },
        materialReceipts: {
          include: { inspectedBy: true },
          orderBy: { receivedAt: 'desc' },
        },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Supplier.List',
      objectType: 'Supplier',
      payload: { countReturned: suppliers.length },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ suppliers });
  } catch (error: any) {
    console.error('GET /api/suppliers error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}

// POST /api/suppliers - Register a new supplier
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Role check: Only ADMIN, OWNER, or QA can add suppliers
    if (user.role !== 'ADMIN' && user.role !== 'OWNER' && user.department !== 'QA') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only QA personnel or Admins can register suppliers' } }, { status: 403 });
    }

    const body = await req.json();
    const { name, contactEmail, contactPhone, category, riskClassification, reEvaluationIntervalDays, notes, attachments } = body;

    if (!name || !category || !riskClassification) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Name, Category, and Risk Classification are required' } }, { status: 400 });
    }

    const interval = parseInt(reEvaluationIntervalDays) || 365;
    const reEvaluationDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * interval);

    const supplier = await prisma.supplier.create({
      data: {
        tenantId: user.tenantId,
        name,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        category,
        status: 'UNDER_EVALUATION',
        riskClassification,
        reEvaluationDueDate,
        notes: notes || null,
        attachments: attachments && Array.isArray(attachments) ? {
          create: attachments.map((att: any) => ({
            fileName: att.fileName,
            fileType: att.fileType,
            fileData: att.fileData,
          })),
        } : undefined,
      },
      include: {
        attachments: true,
      },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Supplier.Register',
      objectType: 'Supplier',
      objectId: supplier.id,
      payload: { supplierName: supplier.name, category: supplier.category, riskClassification: supplier.riskClassification, attachmentsCount: attachments?.length || 0 },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/suppliers error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}

// PUT /api/suppliers - Add an attachment to an existing supplier
export async function PUT(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const body = await req.json();
    const { supplierId, fileName, fileType, fileData } = body;

    if (!supplierId || !fileName || !fileData) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'supplierId, fileName, and fileData are required' } }, { status: 400 });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier || supplier.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Supplier not found' } }, { status: 404 });
    }

    const attachment = await prisma.supplierAttachment.create({
      data: {
        supplierId,
        fileName,
        fileType,
        fileData,
      },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Supplier.AddAttachment',
      objectType: 'SupplierAttachment',
      objectId: attachment.id,
      payload: { supplierName: supplier.name, fileName },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error: any) {
    console.error('PUT /api/suppliers error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}

// DELETE /api/suppliers - Delete an attachment from a supplier
export async function DELETE(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'attachmentId is required' } }, { status: 400 });
    }

    const attachment = await prisma.supplierAttachment.findUnique({
      where: { id: attachmentId },
      include: { supplier: true },
    });

    if (!attachment || attachment.supplier.tenantId !== user.tenantId) {
      return NextResponse.json({ error: { code: 'NotFound', message: 'Attachment not found' } }, { status: 404 });
    }

    await prisma.supplierAttachment.delete({
      where: { id: attachmentId },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'Supplier.DeleteAttachment',
      objectType: 'SupplierAttachment',
      objectId: attachmentId,
      payload: { supplierName: attachment.supplier.name, fileName: attachment.fileName },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/suppliers error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
