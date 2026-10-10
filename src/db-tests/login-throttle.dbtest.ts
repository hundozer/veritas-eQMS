import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signIn } from './sign-in';
import { ownerDatabaseUrl } from './connections';
import { addMember, createFullAccessRole, MEMBER_PASSWORD, seedTenant, type SeededTenant } from './fixtures';

// Failed sign-ins are limited per email and per network address (DEC-079),
// through the real login route and database.
const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
let a: SeededTenant;

beforeAll(async () => {
  a = await seedTenant(owner, 'Alpha', await createFullAccessRole(owner));
});

afterAll(async () => {
  await owner.$disconnect();
});

// A fresh network address per call, distinct across runs against the same database.
const run = randomUUID();
let addresses = 0;
const address = () => `${run.slice(0, 8)}::${(addresses += 1)}`;

async function login(email: string, password: string, ip: string) {
  const { POST } = await import('@/app/api/auth/login/route');
  return POST(new NextRequest('https://veritas.test/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify({ email, password }),
  }));
}

async function member(label: string) {
  await addMember(owner, a, label);
  return (await owner.user.findFirstOrThrow({ where: { tenantId: a.tenantId, fullName: `${a.label} ${label}` } })).email;
}

describe('limit on failed sign-ins', () => {
  it('LOGIN-LIM-T001 after five wrong passwords the right one is refused too, audited, and other accounts still sign in', async () => {
    const email = await member(`Locked${randomUUID().slice(0, 4)}`);
    const other = await member(`Other${randomUUID().slice(0, 4)}`);
    const ip = address();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(email, 'not-the-password', ip)).status).toBe(401);
    }
    const blocked = await login(email.toUpperCase(), MEMBER_PASSWORD, ip);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('900');
    expect(blocked.headers.get('set-cookie')).toBeNull();

    const rows = await owner.iamAuditTrail.findMany({ where: { userEmail: email, action: 'LOGIN_FAILED' }, select: { reason: true, ipAddress: true } });
    expect(rows.map((row) => row.reason).sort()).toEqual([...Array(5).fill('PASSWORD_MISMATCH'), 'TOO_MANY_ATTEMPTS'].sort());
    expect(new Set(rows.map((row) => row.ipAddress))).toEqual(new Set([ip]));

    expect((await login(other, MEMBER_PASSWORD, address())).status).toBe(200);
  });

  it('LOGIN-LIM-T002 an unknown email is limited the same way, so the limit reveals nothing', async () => {
    const unknown = `nobody-${randomUUID()}@example.invalid`;
    const ip = address();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(unknown, 'guess', ip)).status).toBe(401);
    }
    expect((await login(unknown, 'guess', ip)).status).toBe(429);
    expect(await owner.iamAuditTrail.count({ where: { userEmail: unknown, reason: 'UNKNOWN_ACCOUNT' } })).toBe(5);
  });

  it('LOGIN-LIM-T003 a completed sign-in (password and code) clears the count, and the success is audited', async () => {
    const email = await member(`Forgetful${randomUUID().slice(0, 4)}`);
    const ip = address();
    for (let attempt = 0; attempt < 4; attempt += 1) await login(email, 'typo', ip);
    expect((await signIn(owner, email, MEMBER_PASSWORD, ip)).status).toBe(200);
    for (let attempt = 0; attempt < 4; attempt += 1) await login(email, 'typo', ip);
    expect((await signIn(owner, email, MEMBER_PASSWORD, ip)).status).toBe(200);
    const succeeded = await owner.iamAuditTrail.findMany({ where: { userEmail: email, action: 'LOGIN_SUCCEEDED' } });
    expect(succeeded).toHaveLength(2);
    expect(succeeded[0]).toMatchObject({ organizationId: a.organizationId, status: 'SUCCESS', ipAddress: ip });
  });

  it('LOGIN-LIM-T004 twenty failures from one address, across emails, stop that address only', async () => {
    const email = await member(`Victim${randomUUID().slice(0, 4)}`);
    const ip = address();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await login(`spray-${attempt}-${randomUUID()}@example.invalid`, 'guess', ip);
    }
    expect((await login(email, MEMBER_PASSWORD, ip)).status).toBe(429);
    expect((await login(email, MEMBER_PASSWORD, address())).status).toBe(200);
  });

  it('LOGIN-LIM-T005 failures older than 15 minutes no longer count', async () => {
    const email = await member(`Patient${randomUUID().slice(0, 4)}`);
    const ip = address();
    for (let attempt = 0; attempt < 5; attempt += 1) await login(email, 'typo', ip);
    expect((await login(email, MEMBER_PASSWORD, ip)).status).toBe(429);
    // The identity audit trail is append-only, so age the rows with its trigger off.
    await owner.$transaction([
      owner.$executeRawUnsafe('ALTER TABLE "IamAuditTrail" DISABLE TRIGGER USER'),
      owner.$executeRaw`UPDATE "IamAuditTrail" SET "createdAt" = now() - interval '16 minutes' WHERE "userEmail" = ${email}`,
      owner.$executeRawUnsafe('ALTER TABLE "IamAuditTrail" ENABLE TRIGGER USER'),
    ]);
    expect((await login(email, MEMBER_PASSWORD, ip)).status).toBe(200);
  });
});
