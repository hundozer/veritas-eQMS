import { NextRequest, NextResponse } from 'next/server';
import { tenantRead } from '@/lib/tenant-db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '../../../lib/rbac';
import { unexpectedErrorResponse } from '../../../lib/server-errors';

// GET /api/audit - Query the audit index (tenant-scoped, auditor/admin-only)
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (!hasPermission(user, 'audit.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Audit read permission is required' } }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const action = searchParams.get('action');
    const objectType = searchParams.get('objectType');
    const objectId = searchParams.get('objectId');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;
    if (
      (parsedStartDate && Number.isNaN(parsedStartDate.getTime())) ||
      (parsedEndDate && Number.isNaN(parsedEndDate.getTime()))
    ) {
      return NextResponse.json(
        { error: { code: 'ValidationFailed', message: 'Audit date filters must be valid dates' } },
        { status: 400 },
      );
    }

    // Build Prisma query filters
    const where: Record<string, any> = {
      tenantId: user.tenantId,
    };

    if (action) where.action = action;
    if (objectType) where.objectType = objectType;
    if (objectId) where.objectId = objectId;
    if (userId) where.userId = userId;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (parsedStartDate) where.timestamp.gte = parsedStartDate;
      if (parsedEndDate) where.timestamp.lte = parsedEndDate;
    }

    const logs = await tenantRead(user.tenantId, (tx) => tx.auditLog.findMany({
      where,
      select: {
        id: true,
        eventId: true,
        timestamp: true,
        userRole: true,
        action: true,
        objectType: true,
        objectId: true,
        status: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 200, // safety cap
    }));

    return NextResponse.json({ logs }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return unexpectedErrorResponse('audit.query');
  }
}
