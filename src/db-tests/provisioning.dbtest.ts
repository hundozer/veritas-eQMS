import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { addMember, createFullAccessRole, requestAs, seedTenant, type SeededTenant } from './fixtures';

// The invitation email is captured instead of sent; everything else is real:
// routes, sessions, the application database role and row-level security.
const outbox = vi.hoisted(() => ({ sent: [] as Array<{ to: string; token: string }>, fail: false }));
vi.mock('@/lib/iam/credential-email', () => ({
  sendCredentialActionEmail: async (to: string, token: string) => {
    if (outbox.fail) throw new Error('email provider down');
    outbox.sent.push({ to, token });
  },
}));

const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
let a: SeededTenant;
let b: SeededTenant;
let reviewerRoleId: string;

const NEW_PASSWORD = 'a-long-enough-new-password';
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function anonymous(path: string, body: unknown) {
  return new NextRequest(`https://veritas.test${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

function invitation(overrides: Record<string, unknown> = {}) {
  const run = randomUUID().slice(0, 8);
  return { firstName: 'Rita', lastName: `Reviewer ${run}`, email: `rita-${run}@example.invalid`, department: 'QA', roleId: reviewerRoleId, ...overrides };
}

async function invite(by: SeededTenant, body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/users/route');
  return POST(requestAs(by, '/api/users', { method: 'POST', body }));
}

beforeAll(async () => {
  process.env.RESEND_API_KEY = 'test-only';
  process.env.EMAIL_FROM = 'Veritas <no-reply@example.invalid>';
  process.env.APP_ORIGIN = 'https://veritas.test';
  const roleId = await createFullAccessRole(owner);
  a = await seedTenant(owner, 'Alpha', roleId);
  b = await seedTenant(owner, 'Bravo', roleId);
  const reviewerRole = await owner.iamRole.create({ data: { name: `DB test reviewer ${randomUUID()}`, description: 'Reviewer', isSystem: false } });
  const permissions = await owner.iamPermission.findMany({ where: { name: { in: ['documents.read', 'documents.review'] } } });
  await owner.iamRolePermission.createMany({ data: permissions.map((permission) => ({ roleId: reviewerRole.id, permissionId: permission.id })) });
  reviewerRoleId = reviewerRole.id;
});

beforeEach(() => {
  outbox.sent.length = 0;
  outbox.fail = false;
});

afterAll(async () => {
  await owner.$disconnect();
});

describe('audited provisioning and password setup', () => {
  it('PROV-T001 an invitation creates the identity, user and membership atomically, audited, and emails a setup link', async () => {
    const body = invitation();
    const response = await invite(a, body);
    expect(response.status).toBe(201);

    const identity = await owner.iamUser.findUniqueOrThrow({ where: { email: body.email }, include: { memberships: true } });
    expect(identity.accountStatus).toBe('INVITED');
    expect(identity.memberships).toHaveLength(1);
    expect(identity.memberships[0]).toMatchObject({ tenantId: a.tenantId, roleId: reviewerRoleId, status: 'ACTIVE' });
    const user = await owner.user.findUniqueOrThrow({ where: { id: identity.memberships[0].operationalUserId } });
    expect(user.tenantId).toBe(a.tenantId);

    expect(await owner.iamAuditTrail.count({ where: { action: 'USER_INVITED', objectId: identity.id } })).toBe(1);
    expect(await owner.auditLog.count({ where: { action: 'USER_INVITED', objectId: user.id, tenantId: a.tenantId } })).toBe(1);
    expect(outbox.sent).toEqual([{ to: body.email, token: expect.any(String) }]);
  });

  it('PROV-T002 the invited person signs in only after setting their own password from the link, which works once', async () => {
    const body = invitation();
    expect((await invite(a, body)).status).toBe(201);
    const { token } = outbox.sent[0];
    const { POST: login } = await import('@/app/api/auth/login/route');
    const { POST: setup } = await import('@/app/api/auth/setup-password/route');

    expect((await login(anonymous('/api/auth/login', { email: body.email, password: NEW_PASSWORD }))).status).toBe(401);

    const weak = await setup(anonymous('/api/auth/setup-password', { token, password: 'short' }));
    expect(weak.status).toBe(400);

    const set = await setup(anonymous('/api/auth/setup-password', { token, password: NEW_PASSWORD }));
    expect(set.status).toBe(200);
    const identity = await owner.iamUser.findUniqueOrThrow({ where: { email: body.email } });
    expect(identity.accountStatus).toBe('ACTIVE');
    expect(identity.lastPasswordChange).not.toBeNull();
    expect(await owner.iamAuditTrail.count({ where: { action: 'PASSWORD_SET', objectId: identity.id } })).toBe(1);

    const reused = await setup(anonymous('/api/auth/setup-password', { token, password: 'another-long-password' }));
    expect(reused.status).toBe(400);

    const signedIn = await login(anonymous('/api/auth/login', { email: body.email, password: NEW_PASSWORD }));
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get('set-cookie')).toContain('iam-access-token=');
  });

  it('PROV-T003 a separate administrator may assign organisation roles but never a platform role; others cannot invite', async () => {
    const adminRole = await owner.iamRole.create({ data: { name: `DB test administrator ${randomUUID()}`, description: 'Administrator', isSystem: false } });
    const permissions = await owner.iamPermission.findMany({ where: { name: { in: ['users.create', 'users.read'] } } });
    await owner.iamRolePermission.createMany({ data: permissions.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })) });
    const admin = await addMember(owner, a, 'Administrator', adminRole.id);
    const asAdmin = { ...a, sessionToken: admin.sessionToken };
    const platformRole = await owner.iamRole.upsert({
      where: { name: 'System Administrator' }, update: {}, create: { name: 'System Administrator', description: 'Platform', isSystem: true },
    });

    expect((await invite(asAdmin, invitation())).status).toBe(201);

    const platform = invitation({ roleId: platformRole.id });
    expect((await invite(asAdmin, platform)).status).toBe(403);
    expect(await owner.iamUser.count({ where: { email: platform.email } })).toBe(0);

    const { GET: roles } = await import('@/app/api/roles/route');
    const listed = await (await roles(requestAs(asAdmin, '/api/roles'))).json();
    expect(listed.roles.map((role: { id: string }) => role.id)).toEqual(expect.arrayContaining([reviewerRoleId]));
    expect(listed.roles.map((role: { id: string }) => role.id)).not.toContain(platformRole.id);

    const reviewer = await addMember(owner, a, 'Plain', reviewerRoleId);
    const asReviewer = { ...a, sessionToken: reviewer.sessionToken };
    const refused = invitation();
    expect((await invite(asReviewer, refused)).status).toBe(403);
    expect((await roles(requestAs(asReviewer, '/api/roles'))).status).toBe(403);
    expect(await owner.iamUser.count({ where: { email: refused.email } })).toBe(0);
  });

  it('PROV-T004 an email address that already exists is refused without creating anything', async () => {
    const body = invitation({ email: a.email });
    const before = await owner.iamMembership.count();

    const response = await invite(a, body);

    expect(response.status).toBe(409);
    expect(await owner.iamMembership.count()).toBe(before);
    expect(outbox.sent).toEqual([]);
  });

  it('PROV-T005 another organisation cannot see or re-invite the person', async () => {
    const body = invitation();
    expect((await invite(a, body)).status).toBe(201);
    const identity = await owner.iamUser.findUniqueOrThrow({ where: { email: body.email }, include: { memberships: true } });
    const userId = identity.memberships[0].operationalUserId;

    const { GET } = await import('@/app/api/users/route');
    const bravoList = await (await GET(requestAs(b, '/api/users'))).text();
    expect(bravoList).not.toContain(body.email);

    const { POST: resend } = await import('@/app/api/users/[id]/invitation/route');
    outbox.sent.length = 0;
    expect((await resend(requestAs(b, `/api/users/${userId}/invitation`, { method: 'POST' }), params(userId))).status).toBe(404);
    expect(outbox.sent).toEqual([]);

    const alphaList = await (await GET(requestAs(a, '/api/users'))).json();
    expect(alphaList.users.find((user: { id: string }) => user.id === userId)).toMatchObject({ invitationPending: true });
  });

  it('PROV-T006 without email configured nobody is invited', async () => {
    const saved = process.env.EMAIL_FROM;
    delete process.env.EMAIL_FROM;
    const body = invitation();
    try {
      expect((await invite(a, body)).status).toBe(503);
    } finally {
      process.env.EMAIL_FROM = saved;
    }
    expect(await owner.iamUser.count({ where: { email: body.email } })).toBe(0);
  });

  it('PROV-T007 a failed email is reported and audited, and a resend issues a fresh working link', async () => {
    outbox.fail = true;
    const body = invitation();
    const failed = await invite(a, body);
    expect(failed.status).toBe(502);
    const { error } = await failed.json();
    expect(await owner.auditLog.count({ where: { action: 'INVITATION_EMAIL_FAILED', objectId: error.userId } })).toBe(1);

    outbox.fail = false;
    const { POST: resend } = await import('@/app/api/users/[id]/invitation/route');
    const resent = await resend(requestAs(a, `/api/users/${error.userId}/invitation`, { method: 'POST' }), params(error.userId));
    expect(resent.status).toBe(200);
    expect(outbox.sent).toHaveLength(1);

    const { POST: setup } = await import('@/app/api/auth/setup-password/route');
    expect((await setup(anonymous('/api/auth/setup-password', { token: outbox.sent[0].token, password: NEW_PASSWORD }))).status).toBe(200);
    const resentAgain = await resend(requestAs(a, `/api/users/${error.userId}/invitation`, { method: 'POST' }), params(error.userId));
    expect(resentAgain.status).toBe(409);
  });

  it('PROV-T008 an invited person can ask for a fresh link; nothing reveals whether an address exists', async () => {
    const body = invitation();
    expect((await invite(a, body)).status).toBe(201);
    const firstToken = outbox.sent[0].token;
    outbox.sent.length = 0;
    const { POST: request } = await import('@/app/api/auth/setup-password/request/route');

    const answers = await Promise.all([body.email.toUpperCase(), a.email, 'nobody@example.invalid'].map(async (email) => {
      const response = await request(anonymous('/api/auth/setup-password/request', { email }));
      return [response.status, await response.json()];
    }));
    expect(new Set(answers.map((answer) => JSON.stringify(answer))).size).toBe(1);
    expect(outbox.sent).toEqual([{ to: body.email, token: expect.any(String) }]);

    const { POST: setup } = await import('@/app/api/auth/setup-password/route');
    expect((await setup(anonymous('/api/auth/setup-password', { token: firstToken, password: NEW_PASSWORD }))).status).toBe(400);
    expect((await setup(anonymous('/api/auth/setup-password', { token: outbox.sent[0].token, password: NEW_PASSWORD }))).status).toBe(200);
  });
});
