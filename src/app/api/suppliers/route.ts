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
    const { name, contactEmail, contactPhone, category, riskClassification, reEvaluationIntervalDays, notes } = body;

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
      payload: { supplierName: supplier.name, category: supplier.category, riskClassification: supplier.riskClassification },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/suppliers error:', error);
    return NextResponse.json({ error: { code: 'InternalServerError', message: error.message } }, { status: 500 });
  }
}
