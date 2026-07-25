import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET /api/audit - Query the audit index (tenant-scoped, auditor/admin-only)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // GxP access check: only ADMIN or AUDITOR can access the full audit trail
    if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
      await logAuditEvent({
        tenantId: user.tenantId,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'AuditTrail.Query',
        objectType: 'AuditLog',
        payload: { reason: 'Unauthorized role' },
        status: 'Denied',
        requestUrl: req.nextUrl.pathname,
      });
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access denied: Auditor or QA Admin credentials required' } }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const action = searchParams.get('action');
    const objectType = searchParams.get('objectType');
    const objectId = searchParams.get('objectId');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build Prisma query filters
    const where: Prisma.AuditLogWhereInput = {
      tenantId: user.tenantId,
    };

    if (action) where.action = action;
    if (objectType) where.objectType = objectType;
    if (objectId) where.objectId = objectId;
    if (userId) where.userId = userId;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200, // safety cap
    });

    // Log the audit query itself in the audit trail (GxP metadata)
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'AuditTrail.Query',
      objectType: 'AuditLog',
      payload: { countReturned: logs.length, filtersApplied: Object.fromEntries(searchParams) },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Query audit logs error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
