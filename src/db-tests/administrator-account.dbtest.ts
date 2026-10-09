import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { createFullAccessRole, requestAs, seedTenant, type SeededTenant } from './fixtures';

// The production maintenance step that creates the owner's separate
// administrator account (DEC-071), run against a copy of the production shape:
// organisation "Simpleafied Operations", owner god@simpleafied.app, role
// "Organization Owner". Then the real setup-link, password and sign-in routes.
const outbox = vi.hoisted(() => ({ sent: [] as Array<{ to: string; token: string }> }));
vi.mock('@/lib/iam/credential-email', () => ({
  sendCredentialActionEmail: async (to: string, token: string) => { outbox.sent.push({ to, token }); },
}));

const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
const script = readFileSync(resolve('prisma/maintenance/2026-10-09-administrator-account.sql'), 'utf8');
const ADMIN = 'contact@simpleafied.app';
let operations: SeededTenant;
let other: SeededTenant;

function anonymous(path: string, body: unknown) {
  return new NextRequest(`https://veritas.test${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  process.env.RESEND_API_KEY = 'test-only';
  process.env.EMAIL_FROM = 'Simpleafied Veritas <contact@simpleafied.app>';
  process.env.APP_ORIGIN = 'https://veritas.test';

  const fullAccess = await createFullAccessRole(owner);
  operations = await seedTenant(owner, 'Operations', fullAccess);
  other = await seedTenant(owner, 'Other', fullAccess);
  // Production shape: the owner's organisation and identity by name.
  await owner.iamOrganization.update({ where: { id: operations.organizationId }, data: { companyName: 'Simpleafied Operations' } });
  await owner.iamUser.update({ where: { email: operations.email }, data: { email: 'god@simpleafied.app' } });
  // As in production, the role is a seeded system role (isSystem = true).
  const adminRole = await owner.iamRole.upsert({
    where: { name: 'Organization Owner' }, update: { isSystem: true }, create: { name: 'Organization Owner', description: 'Tenant administration', isSystem: true },
  });
  const permissions = await owner.iamPermission.findMany({ where: { name: { in: ['users.create', 'users.read', 'documents.read', 'audit.read'] } } });
  await owner.iamRolePermission.createMany({ data: permissions.map((p) => ({ roleId: adminRole.id, permissionId: p.id })), skipDuplicates: true });
});

afterAll(async () => {
  await owner.$disconnect();
});

describe('separate administrator account (maintenance step)', () => {
  it('ADMIN-T001 creates an invited administrator in the owner\'s organisation, audited, and refuses a second run', async () => {
    await owner.$executeRawUnsafe(script);

    const identity = await owner.iamUser.findUniqueOrThrow({ where: { email: ADMIN }, include: { memberships: { include: { role: true } } } });
    expect(identity.accountStatus).toBe('INVITED');
    expect(identity.memberships).toHaveLength(1);
    expect(identity.memberships[0]).toMatchObject({ tenantId: operations.tenantId, status: 'ACTIVE', role: { name: 'Organization Owner' } });
    const user = await owner.user.findUniqueOrThrow({ where: { id: identity.memberships[0].operationalUserId } });
    expect(user.tenantId).toBe(operations.tenantId);
    expect(await owner.iamAuditTrail.count({ where: { action: 'USER_INVITED', objectId: identity.id, organizationId: operations.organizationId } })).toBe(1);
    expect(await owner.auditLog.count({ where: { action: 'USER_INVITED', objectId: user.id, tenantId: operations.tenantId } })).toBe(1);

    await expect(owner.$executeRawUnsafe(script)).rejects.toThrow(/already in use/);
    expect(await owner.iamUser.count({ where: { email: ADMIN } })).toBe(1);
  });

  it('ADMIN-T002 the administrator sets their own password from a requested link, signs in, and may invite, but not sign documents', async () => {
    const { POST: requestLink } = await import('@/app/api/auth/setup-password/request/route');
    const { POST: setup } = await import('@/app/api/auth/setup-password/route');
    const { POST: login } = await import('@/app/api/auth/login/route');

    expect((await requestLink(anonymous('/api/auth/setup-password/request', { email: ADMIN }))).status).toBe(200);
    expect(outbox.sent.map((mail) => mail.to)).toEqual([ADMIN]);
    expect((await setup(anonymous('/api/auth/setup-password', { token: outbox.sent[0].token, password: 'administrator-password' }))).status).toBe(200);

    const signedIn = await login(anonymous('/api/auth/login', { email: ADMIN, password: 'administrator-password' }));
    expect(signedIn.status).toBe(200);
    const sessionToken = /iam-access-token=([^;]+)/.exec(signedIn.headers.get('set-cookie') ?? '')?.[1];
    expect(sessionToken).toBeTruthy();
    const asAdmin = { ...operations, sessionToken: sessionToken! };

    const { GET: session } = await import('@/app/api/auth/session/route');
    const { user } = await (await session(requestAs(asAdmin, '/api/auth/session'))).json();
    expect(user.tenantId).toBe(operations.tenantId);
    expect(user.permissions).toEqual(expect.arrayContaining(['users.create', 'users.read']));
    expect(user.permissions).not.toEqual(expect.arrayContaining(['documents.approve']));

    const { GET: members } = await import('@/app/api/users/route');
    const listed = await (await members(requestAs(asAdmin, '/api/users'))).text();
    expect(listed).toContain(ADMIN);
    expect(listed).not.toContain(other.email);
  });
});
