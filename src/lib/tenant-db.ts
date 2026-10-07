import type { Prisma } from '@prisma/client';
import prisma from './db';

// Row-level security on tenant-owned tables only returns and accepts rows whose
// tenantId equals the transaction's app.tenant_id. Every read or write of those
// tables therefore runs inside one of these helpers; outside them the
// application role sees no tenant rows at all.
//
// set_config(..., true) is transaction-local, so the setting never leaks to the
// next transaction on a pooled connection.

type TenantWork<T> = (tx: Prisma.TransactionClient) => Promise<T>;

async function runAsTenant<T>(tenantId: string, work: TenantWork<T>): Promise<T> {
  if (!tenantId?.trim()) throw new Error('Tenant context is required');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return work(tx);
  });
}

/** Reads tenant-owned rows as the given tenant. */
export function tenantRead<T>(tenantId: string, work: TenantWork<T>): Promise<T> {
  return runAsTenant(tenantId, work);
}

/** Runs a regulated mutation and its audit write atomically as the given tenant. */
export function tenantTransaction<T>(tenantId: string, work: TenantWork<T>): Promise<T> {
  return runAsTenant(tenantId, work);
}
