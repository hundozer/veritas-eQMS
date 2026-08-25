import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getContext } from '@/lib/auth';
import { hasPermission } from '../../../lib/rbac';
import { unexpectedErrorResponse } from '../../../lib/server-errors';

// GET /api/audits - List internal and supplier audit plans
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }
    if (!hasPermission(user, 'audit_plan.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Audit-plan read permission is required' } }, { status: 403 });
    }

    const auditPlans = await prisma.auditPlan.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        title: true,
        scope: true,
        auditType: true,
        status: true,
        scheduledDate: true,
      },
      orderBy: { scheduledDate: 'desc' },
    });

    return NextResponse.json({ auditPlans });
  } catch (error: any) {
    return unexpectedErrorResponse('auditPlan.list');
  }
}

// Scheduling remains unavailable until canonical create permission, validated
// workflow rules, and mandatory transactional audit evidence are implemented.
export async function POST() {
  return NextResponse.json(
    { error: { code: 'AuditPlanMutationDisabled', message: 'Audit scheduling is temporarily unavailable' } },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '86400' } },
  );
}
