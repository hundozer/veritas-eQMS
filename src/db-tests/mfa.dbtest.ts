import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { addMember, createFullAccessRole, MEMBER_PASSWORD, requestAs, seedTenant, type SeededTenant } from './fixtures';
import { codeRequest, freshCode, loginRequest, pendingCookieOf, signIn } from './sign-in';
import { base32Decode, currentStep, totpCode } from '@/lib/iam/totp';

// Two-step verification for everyone (DEC-080), through the real routes.
const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
let a: SeededTenant;
let b: SeededTenant;
let roleId: string;

beforeAll(async () => {
  roleId = await createFullAccessRole(owner);
  a = await seedTenant(owner, 'Alpha', roleId);
  b = await seedTenant(owner, 'Bravo', roleId);
});

afterAll(async () => {
  await owner.$disconnect();
});

const routes = async () => ({
  login: (await import('@/app/api/auth/login/route')).POST,
  mfa: (await import('@/app/api/auth/mfa/route')).POST,
  reset: (await import('@/app/api/users/[id]/mfa-reset/route')).POST,
});

async function person(tenant: SeededTenant, label: string) {
  const added = await addMember(owner, tenant, `${label}${randomUUID().slice(0, 4)}`);
  const user = await owner.user.findUniqueOrThrow({ where: { id: added.userId } });
  return { ...added, email: user.email };
}

const sessionCookie = (response: Response) => /iam-access-token=([^;]+)/.exec(response.headers.get('set-cookie') ?? '')?.[1];

describe('two-step verification at sign-in', () => {
  it('MFA-T007 a correct password alone opens no session; first sign-in sets up the authenticator, stored encrypted', async () => {
    const { login, mfa } = await routes();
    const { email } = await person(a, 'New');

    const first = await login(loginRequest(email, MEMBER_PASSWORD));
    expect(first.status).toBe(200);
    expect(sessionCookie(first)).toBeUndefined();
    const challenge = await first.json();
    expect(challenge).toMatchObject({ mfa: 'ENROLL', setupKey: expect.stringMatching(/^[A-Z2-7]{32}$/), otpauthUri: expect.stringContaining('otpauth://totp/') });
    expect(challenge.qrSvg).toContain('<svg');
    const pending = pendingCookieOf(first);
    expect(first.headers.get('set-cookie')).toMatch(/Path=\/api\/auth\/mfa/i);

    const stored = await owner.iamUser.findUniqueOrThrow({ where: { email } });
    expect([stored.mfaEnabled, stored.mfaSecret?.startsWith('v1:'), stored.mfaSecret?.includes(challenge.setupKey)]).toEqual([false, true, false]);

    const wrong = await mfa(codeRequest('000000', pending));
    expect([wrong.status, sessionCookie(wrong)]).toEqual([401, undefined]);

    const code = totpCode(base32Decode(challenge.setupKey), currentStep());
    const done = await mfa(codeRequest(code, pending));
    expect(done.status).toBe(200);
    expect(sessionCookie(done)).toBeTruthy();
    expect((await owner.iamUser.findUniqueOrThrow({ where: { email } })).mfaEnabled).toBe(true);
    const actions = (await owner.iamAuditTrail.findMany({ where: { userId: stored.id }, select: { action: true } })).map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(['MFA_FAILED', 'MFA_ENROLLED', 'MFA_VERIFIED', 'LOGIN_SUCCEEDED']));

    // The same code is never accepted twice.
    const again = await login(loginRequest(email, MEMBER_PASSWORD));
    expect(await again.json()).toEqual({ mfa: 'VERIFY' });
    expect((await mfa(codeRequest(code, pendingCookieOf(again)))).status).toBe(401);
    expect((await mfa(codeRequest(await freshCode(owner, email), pendingCookieOf(again)))).status).toBe(200);
  });

  it('MFA-T008 the code step needs a genuine, unexpired pending sign-in for that person', async () => {
    const { login, mfa } = await routes();
    const alice = await person(a, 'Alice');
    const bob = await person(a, 'Bob');
    expect((await signIn(owner, alice.email, MEMBER_PASSWORD)).status).toBe(200);
    expect((await signIn(owner, bob.email, MEMBER_PASSWORD)).status).toBe(200);

    expect((await mfa(codeRequest(await freshCode(owner, alice.email), null))).status).toBe(401);
    expect((await mfa(codeRequest(await freshCode(owner, alice.email), 'veritas-mfa-pending=forged.token'))).status).toBe(401);
    // Bob's pending sign-in cannot be completed with Alice's code.
    const bobPending = pendingCookieOf(await login(loginRequest(bob.email, MEMBER_PASSWORD)));
    expect((await mfa(codeRequest(await freshCode(owner, alice.email), bobPending))).status).toBe(401);
  });

  it('MFA-T009 five wrong codes stop the code step for 15 minutes, even with the right code', async () => {
    const { login, mfa } = await routes();
    const { email } = await person(a, 'Guess');
    expect((await signIn(owner, email, MEMBER_PASSWORD)).status).toBe(200);
    const pending = pendingCookieOf(await login(loginRequest(email, MEMBER_PASSWORD)));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await mfa(codeRequest(String(100000 + attempt), pending))).status).toBe(401);
    }
    const blocked = await mfa(codeRequest(await freshCode(owner, email), pending));
    expect([blocked.status, sessionCookie(blocked)]).toEqual([429, undefined]);
  });

  it('MFA-T010 an administrator resets a member\'s verification with a reason, audited; limits on who and whom', async () => {
    const { login, reset } = await routes();
    const member = await person(a, 'LostPhone');
    expect((await signIn(owner, member.email, MEMBER_PASSWORD)).status).toBe(200);
    const call = (tenant: SeededTenant, id: string, body: unknown) => reset(requestAs(tenant, `/api/users/${id}/mfa-reset`, { method: 'POST', body }), { params: Promise.resolve({ id }) });

    expect((await call(a, member.userId, {})).status).toBe(400);
    expect((await call(a, a.operationalUserId, { reason: 'mine' })).status).toBe(409);
    expect((await call(b, member.userId, { reason: 'not mine to reset' })).status).toBe(404);
    const readOnly = await owner.iamRole.create({ data: { name: `Reader ${randomUUID()}`, description: 'test', isSystem: false } });
    const reader = await addMember(owner, a, 'Reader', readOnly.id);
    expect((await call({ ...a, sessionToken: reader.sessionToken }, member.userId, { reason: 'x' })).status).toBe(403);
    expect((await owner.iamUser.findUniqueOrThrow({ where: { email: member.email } })).mfaEnabled).toBe(true);

    expect((await call(a, member.userId, { reason: 'Lost phone, ticket 42' })).status).toBe(200);
    const identity = await owner.iamUser.findUniqueOrThrow({ where: { email: member.email } });
    expect([identity.mfaEnabled, identity.mfaSecret]).toEqual([false, null]);
    expect(await owner.iamAuditTrail.count({ where: { action: 'MFA_RESET', objectId: identity.id, reason: 'Lost phone, ticket 42' } })).toBe(1);
    const audit = await owner.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, action: 'MFA_RESET', objectId: member.userId } });
    expect(JSON.parse(audit.payload)).toMatchObject({ mfaEnabled: { before: true, after: false }, reason: 'Lost phone, ticket 42' });
    expect((await (await login(loginRequest(member.email, MEMBER_PASSWORD))).json()).mfa).toBe('ENROLL');
  });

  it('MFA-T011 a person who also belongs to another organisation is not reset from one of them', async () => {
    const { reset } = await routes();
    const member = await person(a, 'TwoOrgs');
    const identity = await owner.iamUser.findUniqueOrThrow({ where: { email: member.email } });
    const elsewhere = await owner.user.create({ data: { email: `two-orgs-${randomUUID()}@example.invalid`, fullName: 'Two Orgs', role: 'EMPLOYEE', department: 'QA', tenantId: b.tenantId } });
    await owner.iamMembership.create({ data: { userId: identity.id, organizationId: b.organizationId, tenantId: b.tenantId, operationalUserId: elsewhere.id, roleId, status: 'ACTIVE' } });

    const response = await reset(requestAs(a, `/api/users/${member.userId}/mfa-reset`, { method: 'POST', body: { reason: 'try' } }), { params: Promise.resolve({ id: member.userId }) });
    expect(response.status).toBe(409);
  });

  it('MFA-T012 without the encryption key sign-in fails closed', async () => {
    const { login } = await routes();
    const { email } = await person(a, 'NoKey');
    const key = process.env.MFA_ENCRYPTION_KEY;
    delete process.env.MFA_ENCRYPTION_KEY;
    try {
      const response = await login(loginRequest(email, MEMBER_PASSWORD));
      expect([response.status, sessionCookie(response)]).toEqual([503, undefined]);
    } finally {
      process.env.MFA_ENCRYPTION_KEY = key;
    }
  });
});
