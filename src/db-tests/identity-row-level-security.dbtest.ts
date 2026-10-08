import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appDatabaseUrl, ownerDatabaseUrl } from './connections';
import { asTenant, createFullAccessRole, requestAs, seedTenant, type SeededTenant } from './fixtures';

// Row-level security on "Tenant", "User", "IamOrganization" and
// "IamMembership" (DEC-069), checked as the application role.
const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
const app = new PrismaClient({ datasourceUrl: appDatabaseUrl() });
let a: SeededTenant;
let b: SeededTenant;
let aIdentityId: string;

const ROW_LEVEL_SECURITY = /row-level security/i;

beforeAll(async () => {
  const roleId = await createFullAccessRole(owner);
  a = await seedTenant(owner, 'Alpha', roleId);
  b = await seedTenant(owner, 'Bravo', roleId);
  aIdentityId = (await owner.iamUser.findUniqueOrThrow({ where: { email: a.email } })).id;
});

afterAll(async () => {
  await Promise.all([owner.$disconnect(), app.$disconnect()]);
});

describe('row-level security on the identity tables', () => {
  it('IDRLS-T001 without a tenant the application role sees no tenant, user, organisation or membership', async () => {
    expect(await app.tenant.count()).toBe(0);
    expect(await app.user.count()).toBe(0);
    expect(await app.iamOrganization.count()).toBe(0);
    expect(await app.iamMembership.count()).toBe(0);
  });

  it('IDRLS-T002 acting as one tenant, another tenant\'s rows are invisible even by id', async () => {
    const seen = await asTenant(app, a.tenantId, async (tx) => ({
      tenants: (await tx.tenant.findMany({ select: { id: true } })).map((row) => row.id),
      users: (await tx.user.findMany({ select: { tenantId: true } })).map((row) => row.tenantId),
      organizations: (await tx.iamOrganization.findMany({ select: { tenantId: true } })).map((row) => row.tenantId),
      memberships: (await tx.iamMembership.findMany({ select: { tenantId: true } })).map((row) => row.tenantId),
      bravoUser: await tx.user.findUnique({ where: { id: b.operationalUserId } }),
      bravoByEmail: await tx.user.findUnique({ where: { email: b.email } }),
      bravoOrganization: await tx.iamOrganization.findUnique({ where: { id: b.organizationId } }),
    }));

    expect(seen.tenants).toEqual([a.tenantId]);
    expect(new Set([...seen.users, ...seen.organizations, ...seen.memberships])).toEqual(new Set([a.tenantId]));
    expect([seen.bravoUser, seen.bravoByEmail, seen.bravoOrganization]).toEqual([null, null, null]);
  });

  it('IDRLS-T003 a user or membership labelled with another tenant is refused', async () => {
    await expect(asTenant(app, a.tenantId, (tx) => tx.user.create({
      data: { email: `cross-${randomUUID()}@example.invalid`, fullName: 'Cross', role: 'EMPLOYEE', department: 'QA', tenantId: b.tenantId },
    }))).rejects.toThrow(ROW_LEVEL_SECURITY);
    const updated = await asTenant(app, a.tenantId, (tx) => tx.user.updateMany({ where: { id: b.operationalUserId }, data: { fullName: 'Hijacked' } }));
    expect(updated.count).toBe(0);
    expect((await owner.user.findUniqueOrThrow({ where: { id: b.operationalUserId } })).fullName).not.toBe('Hijacked');
  });

  it('IDRLS-T004 the sign-in lookup returns only ids for the one identity asked about', async () => {
    const rows = await app.$queryRaw<Array<Record<string, string>>>`SELECT * FROM veritas_identity_memberships(${aIdentityId})`;

    expect(rows).toEqual([{ membership_id: expect.any(String), organization_id: a.organizationId, tenant_id: a.tenantId }]);
    expect(await app.$queryRaw<unknown[]>`SELECT * FROM veritas_identity_memberships(${randomUUID()})`).toEqual([]);
  });

  it('IDRLS-T005 a session cannot name a tenant other than its membership\'s', async () => {
    const membership = await owner.iamMembership.findFirstOrThrow({ where: { userId: aIdentityId } });
    await expect(app.iamSession.create({
      data: { userId: aIdentityId, membershipId: membership.id, tenantId: b.tenantId, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60_000) },
    })).rejects.toThrow(/Foreign key constraint|violates foreign key/i);
  });

  it('IDRLS-T006 sign-in, session lookup and the member list still work, scoped to the caller', async () => {
    const { getContext } = await import('@/lib/auth');
    const context = await getContext(requestAs(a, '/api/users'));
    expect([context?.tenantId, context?.id, context?.tenantName]).toEqual([a.tenantId, a.operationalUserId, expect.any(String)]);

    const { GET } = await import('@/app/api/users/route');
    const listed = await (await GET(requestAs(a, '/api/users'))).text();
    expect(listed).toContain(a.email);
    expect(listed).not.toContain(b.email);
  });
});
