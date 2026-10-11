// EXAMPLE (type-checked, not shipped): a module's list-and-create route
// handler, as src/app/api/<module>/route.ts. Pattern taken from
// src/app/api/documents/route.ts and src/app/api/documents/[id]/release/route.ts.
// Order is fixed: session → permission → input → tenant-scoped data →
// one transaction with the audit row → explicit response fields.
import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { tenantRead, tenantTransaction } from '@/lib/tenant-db';
import { writeMandatoryAudit } from '@/lib/audit';
import { reportServerError } from '@/lib/server-errors';

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'change.read')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Change-control read permission is required' } }, { status: 403 });

    const changes = await tenantRead(user.tenantId, (tx) => tx.changeRequest.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, riskLevel: true, status: true, createdAt: true },
    }));
    return NextResponse.json({ changes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    reportServerError('document.list'); // add a 'change.list' event to ServerErrorEvent in the real module
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to list change controls' } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'change.create')) return NextResponse.json({ error: { code: 'Forbidden', message: 'Change-control create permission is required' } }, { status: 403 });

    // Validate by hand into a typed value; never pass the body to Prisma.
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const riskLevel = RISK_LEVELS.find((level) => level === body.riskLevel);
    if (!title || !reason || !riskLevel) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: 'Title, reason and risk level are required' } }, { status: 400 });
    }

    const change = await tenantTransaction(user.tenantId, async (tx) => {
      const created = await tx.changeRequest.create({
        data: { tenantId: user.tenantId, title, reason, riskLevel, status: 'DRAFT' },
        select: { id: true, title: true, riskLevel: true, status: true, createdAt: true },
      });
      await writeMandatoryAudit(tx, {
        context: user, action: 'CHANGE_CREATED', objectType: 'ChangeRequest', objectId: created.id,
        payload: { after: { title, reason, riskLevel, status: 'DRAFT' } },
        requestUrl: req.nextUrl.pathname,
      });
      return created;
    });
    return NextResponse.json({ change }, { status: 201 });
  } catch {
    reportServerError('document.create');
    return NextResponse.json({ error: { code: 'InternalError', message: 'Unable to create change control' } }, { status: 500 });
  }
}
