import { tenantRead } from './tenant-db';
import { describeAuditPayload } from './audit-review';

// Shared by the audit review list and its PDF export (DEC-077, DEC-078): the
// same filters, always inside the caller's tenant, newest first.

export type AuditFilters = {
  action?: string;
  objectType?: string;
  objectId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
};

export function parseAuditFilters(params: URLSearchParams): { filters: AuditFilters } | { error: string } {
  const filters: AuditFilters = {};
  for (const key of ['action', 'objectType', 'objectId', 'userId'] as const) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  for (const key of ['startDate', 'endDate'] as const) {
    const value = params.get(key);
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { error: 'Audit date filters must be valid dates' };
    filters[key] = date;
  }
  return { filters };
}

export async function readAuditEntries(tenantId: string, filters: AuditFilters, take: number) {
  const { startDate, endDate, ...exact } = filters;
  const logs = await tenantRead(tenantId, (tx) => tx.auditLog.findMany({
    where: {
      tenantId,
      ...exact,
      ...(startDate || endDate ? { timestamp: { ...(startDate && { gte: startDate }), ...(endDate && { lte: endDate }) } } : {}),
    },
    select: {
      id: true,
      eventId: true,
      timestamp: true,
      userEmail: true,
      userRole: true,
      action: true,
      objectType: true,
      objectId: true,
      status: true,
      payload: true,
    },
    orderBy: { timestamp: 'desc' },
    take,
  }));
  // Reviewers see field changes and recorded details, not the raw payload.
  return logs.map(({ payload, ...log }) => ({ ...log, ...describeAuditPayload(payload) }));
}

export type AuditEntry = Awaited<ReturnType<typeof readAuditEntries>>[number];
