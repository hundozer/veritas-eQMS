import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext, logAuditEvent } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET /api/audit/export - Export the audit trail to CSV format (auditor/admin-only)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    // Role verification
    if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Access denied: Auditor or QA Admin credentials required' } }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Prisma.AuditLogWhereInput = {
      tenantId: user.tenantId,
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    // Helper to format values securely for CSV (handling commas, double quotes, and newlines)
    const csvEscape = (val: string | null | undefined) => {
      if (val === null || val === undefined) return '';
      let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Construct CSV header & rows
    const headers = [
      'Event ID',
      'Timestamp (UTC)',
      'User Email',
      'User Role',
      'Action',
      'Object Type',
      'Object ID',
      'Status',
      'Source IP',
      'Request URL',
      'Payload Details'
    ];

    const rows: (string | null | undefined)[][] = logs.map((log: typeof logs[number]) => [
      log.eventId,
      log.timestamp.toISOString(),
      log.userEmail || 'System',
      log.userRole || 'System',
      log.action,
      log.objectType,
      log.objectId || '',
      log.status,
      log.sourceIp || '',
      log.requestUrl || '',
      log.payload
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: (string | null | undefined)[]) => row.map(csvEscape).join(','))
    ].join('\n');

    // Log the export action
    await logAuditEvent({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'AuditTrail.Export',
      objectType: 'AuditLog',
      payload: { countExported: logs.length, format: 'CSV', filtersApplied: Object.fromEntries(searchParams) },
      status: 'Success',
      requestUrl: req.nextUrl.pathname,
    });

    // Return text/csv response
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="veritas-eqms-audit-trail.csv"',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('Export audit logs error:', error);
    return NextResponse.json({ error: { code: 'InternalError', message: error.message } }, { status: 500 });
  }
}
