import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '@/lib/auth';
import { hasPermission } from '../../../lib/rbac';
import { unexpectedErrorResponse } from '../../../lib/server-errors';
import { parseAuditFilters, readAuditEntries } from '../../../lib/audit-query';

// GET /api/audit - the audit review list (tenant-scoped, audit.read), newest first, at most 200
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) {
      return NextResponse.json({ error: { code: 'Unauthorized', message: 'User context not found' } }, { status: 401 });
    }

    if (!hasPermission(user, 'audit.read')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Audit read permission is required' } }, { status: 403 });
    }

    const parsed = parseAuditFilters(req.nextUrl.searchParams);
    if ('error' in parsed) {
      return NextResponse.json({ error: { code: 'ValidationFailed', message: parsed.error } }, { status: 400 });
    }

    const logs = await readAuditEntries(user.tenantId, parsed.filters, 200);
    return NextResponse.json({ logs }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return unexpectedErrorResponse('audit.query');
  }
}
