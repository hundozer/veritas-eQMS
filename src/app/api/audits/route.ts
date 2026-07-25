import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';

// GET /api/audits - List internal and supplier audit plans
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    const auditPlans = await prisma.auditPlan.findMany({
      where: { tenantId: user.tenantId },
      include: {
        leadAuditor: true,
        findings: {
          include: { capa: true },
        },
      },
      orderBy: { scheduledDate: 'desc' },
    });

    return NextResponse.json({ auditPlans });
  } catch (error: any) {
    console.error('List audit plans error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}

// POST /api/audits - Schedule a new internal or supplier audit
export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (user.role !== 'OWNER' && user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Only Auditors and Quality Admins can schedule audits' } }, { status: 403 });
    }

    const body = await req.json();
    const { title, scope, auditType, scheduledDate, summary } = body;

    if (!title || !scope || !auditType) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Title, scope, and auditType are required' } }, { status: 400 });
    }

    const newAudit = await prisma.auditPlan.create({
      data: {
        tenantId: user.tenantId,
        title,
        scope,
        auditType: auditType || 'INTERNAL',
        status: 'PLANNED',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        leadAuditorId: user.id,
        summary: summary || '',
      },
    });

    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'AuditPlan.Create',
      objectType: 'AuditPlan',
      objectId: newAudit.id,
      payload: { title: newAudit.title, auditType: newAudit.auditType },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ auditPlan: newAudit }, { status: 201 });
  } catch (error: any) {
    console.error('Create audit plan error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
