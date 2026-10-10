import { NextRequest, NextResponse } from 'next/server';
import { getContext } from '../../../../lib/auth';
import { hasPermission } from '../../../../lib/rbac';
import { writeMandatoryAudit } from '../../../../lib/audit';
import { tenantTransaction } from '../../../../lib/tenant-db';
import { unexpectedErrorResponse } from '../../../../lib/server-errors';
import { parseAuditFilters, readAuditEntries } from '../../../../lib/audit-query';
import { AUDIT_EXPORT_LIMIT, describeFilters, renderAuditPdf } from '../../../../lib/audit-pdf';

// GET /api/audit/export - the audit review as a PDF (DEC-078). Needs audit.read
// and audit.export; the export itself is audited before the file is returned.
export async function GET(req: NextRequest) {
  try {
    const user = await getContext(req);
    if (!user) return NextResponse.json({ error: { code: 'Unauthorized', message: 'Authentication required' } }, { status: 401 });
    if (!hasPermission(user, 'audit.read') || !hasPermission(user, 'audit.export')) {
      return NextResponse.json({ error: { code: 'Forbidden', message: 'Audit export permission is required' } }, { status: 403 });
    }
    const parsed = parseAuditFilters(req.nextUrl.searchParams);
    if ('error' in parsed) return NextResponse.json({ error: { code: 'ValidationFailed', message: parsed.error } }, { status: 400 });

    const found = await readAuditEntries(user.tenantId, parsed.filters, AUDIT_EXPORT_LIMIT + 1);
    const entries = found.slice(0, AUDIT_EXPORT_LIMIT);
    const truncated = found.length > AUDIT_EXPORT_LIMIT;
    const exportedAt = new Date();

    await tenantTransaction(user.tenantId, (tx) => writeMandatoryAudit(tx, {
      context: user, action: 'AUDIT_EXPORTED', objectType: 'AuditLog',
      payload: { format: 'PDF', filters: describeFilters(parsed.filters), entries: entries.length, truncated, exportedAt: exportedAt.toISOString() },
      requestUrl: req.nextUrl.pathname,
    }));

    const bytes = await renderAuditPdf({ tenantName: user.tenantName, exportedBy: user.email, exportedAt, filters: parsed.filters, entries, truncated });
    const fileName = `audit-review-${exportedAt.toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return unexpectedErrorResponse('audit.export');
  }
}
