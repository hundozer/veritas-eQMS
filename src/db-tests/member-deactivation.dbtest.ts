import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { addMember, createFullAccessRole, MEMBER_PASSWORD, requestAs, seedTenant, type SeededTenant } from './fixtures';
import { signIn } from './sign-in';

// Deactivating a member who has left (VER-00.4), through the real routes with
// the application database role.
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
  deactivate: (await import('@/app/api/users/[id]/deactivate/route')).POST,
  users: (await import('@/app/api/users/route')).GET,
  session: (await import('@/app/api/auth/session/route')).GET,
});

const as = (tenant: SeededTenant, sessionToken: string): SeededTenant => ({ ...tenant, sessionToken });

async function call(tenant: SeededTenant, id: string, body: unknown) {
  const { deactivate } = await routes();
  return deactivate(requestAs(tenant, `/api/users/${id}/deactivate`, { method: 'POST', body }), { params: Promise.resolve({ id }) });
}

async function leaver(tenant: SeededTenant, label: string) {
  const added = await addMember(owner, tenant, `${label}${randomUUID().slice(0, 4)}`);
  const user = await owner.user.findUniqueOrThrow({ where: { id: added.userId } });
  return { ...added, email: user.email };
}

describe('member deactivation', () => {
  it('DEACT-T001 suspends the membership, revokes every session, keeps the records and writes both audit rows', async () => {
    const { users, session } = await routes();
    const member = await leaver(a, 'Leaver');
    const membership = await owner.iamMembership.findFirstOrThrow({ where: { operationalUserId: member.userId } });
    // A second live session, e.g. another browser.
    const other = await signIn(owner, member.email, MEMBER_PASSWORD);
    expect(other.status).toBe(200);
    // Open work in their name that must stay as it is.
    const assignment = await owner.trainingAssignment.create({
      data: { requirementId: (await owner.trainingRequirement.findFirstOrThrow({ where: { documentId: a.documentId } })).id, tenantId: a.tenantId, userId: member.userId, status: 'ASSIGNED' },
    });
    const owned = await owner.document.create({
      data: { title: `Owned by leaver ${randomUUID()}`, description: 'x', classification: 'CONTROLLED', status: 'EFFECTIVE', ownerId: member.userId, tenantId: a.tenantId },
    });
    const auditBefore = await owner.auditLog.count({ where: { tenantId: a.tenantId } });

    expect((await session(requestAs(as(a, member.sessionToken), '/api/auth/session'))).status).toBe(200);

    const response = await call(a, member.userId, { reason: 'Left the company, HR ticket 7' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.revokedSessions).toBeGreaterThanOrEqual(2);
    expect(body.openWork.trainingAssignments).toEqual([expect.objectContaining({ assignmentId: assignment.id, documentId: a.documentId })]);
    expect(body.openWork.ownedDocuments).toEqual([expect.objectContaining({ documentId: owned.id, status: 'EFFECTIVE' })]);

    expect((await owner.iamMembership.findUniqueOrThrow({ where: { id: membership.id } })).status).toBe('SUSPENDED');
    expect((await owner.user.findUniqueOrThrow({ where: { id: member.userId } })).accountStatus).toBe('INACTIVE');
    expect(await owner.iamSession.count({ where: { membershipId: membership.id, revokedAt: null } })).toBe(0);

    // The old session no longer works and they cannot sign in again.
    expect((await session(requestAs(as(a, member.sessionToken), '/api/auth/session'))).status).toBe(401);
    expect((await signIn(owner, member.email, MEMBER_PASSWORD)).status).not.toBe(200);

    // Their records are untouched.
    expect((await owner.trainingAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).status).toBe('ASSIGNED');
    expect((await owner.document.findUniqueOrThrow({ where: { id: owned.id } })).ownerId).toBe(member.userId);

    const audit = await owner.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, action: 'USER_DEACTIVATED', objectId: member.userId } });
    expect(audit.userId).toBe(a.operationalUserId);
    expect(JSON.parse(audit.payload)).toMatchObject({
      before: { membershipStatus: 'ACTIVE', accountStatus: 'ACTIVE' },
      after: { membershipStatus: 'SUSPENDED', accountStatus: 'INACTIVE' },
      reason: 'Left the company, HR ticket 7',
    });
    expect(await owner.auditLog.count({ where: { tenantId: a.tenantId } })).toBe(auditBefore + 1);
    expect(await owner.iamAuditTrail.count({ where: { action: 'MEMBER_DEACTIVATED', objectId: membership.id, reason: 'Left the company, HR ticket 7' } })).toBe(1);

    // The register shows them as inactive.
    const listed = (await (await users(requestAs(a, '/api/users'))).json()).users.find((u: { id: string }) => u.id === member.userId);
    expect(listed.accountStatus).toBe('INACTIVE');
  });

  it('DEACT-T002 refuses a missing reason, oneself, another tenant\'s member, no permission and a second deactivation, writing nothing', async () => {
    const member = await leaver(a, 'Stays');
    const readOnly = await owner.iamRole.create({ data: { name: `Reader ${randomUUID()}`, description: 'test', isSystem: false } });
    const reader = await addMember(owner, a, 'Reader', readOnly.id);
    const auditBefore = await owner.auditLog.count({ where: { action: 'USER_DEACTIVATED' } });

    expect((await call(a, member.userId, {})).status).toBe(400);
    expect((await call(a, member.userId, { reason: '   ' })).status).toBe(400);
    expect((await call(a, a.operationalUserId, { reason: 'myself' })).status).toBe(409);
    expect((await call(b, member.userId, { reason: 'not my organisation' })).status).toBe(404);
    expect((await call(as(a, reader.sessionToken), member.userId, { reason: 'no permission' })).status).toBe(403);

    expect((await owner.iamMembership.findFirstOrThrow({ where: { operationalUserId: member.userId } })).status).toBe('ACTIVE');
    expect((await owner.user.findUniqueOrThrow({ where: { id: member.userId } })).accountStatus).toBe('ACTIVE');
    expect(await owner.auditLog.count({ where: { action: 'USER_DEACTIVATED' } })).toBe(auditBefore);

    expect((await call(a, member.userId, { reason: 'Left' })).status).toBe(200);
    const again = await call(a, member.userId, { reason: 'Left again' });
    expect(again.status).toBe(409);
    expect(await owner.auditLog.count({ where: { action: 'USER_DEACTIVATED', objectId: member.userId } })).toBe(1);
  });

  it('DEACT-T003 a deactivated administrator\'s own session can no longer deactivate anyone', async () => {
    const admin = await leaver(a, 'Admin');
    const target = await leaver(a, 'Target');
    expect((await call(a, admin.userId, { reason: 'Left' })).status).toBe(200);

    const refused = await call(as(a, admin.sessionToken), target.userId, { reason: 'after leaving' });
    expect(refused.status).toBe(401);
    expect((await owner.iamMembership.findFirstOrThrow({ where: { operationalUserId: target.userId } })).status).toBe('ACTIVE');
  });

  it('DEACT-T004 deactivating in one organisation leaves the other organisation untouched', async () => {
    const bSessions = await owner.iamSession.count({ where: { tenantId: b.tenantId, revokedAt: null } });
    const bMembers = await owner.iamMembership.count({ where: { tenantId: b.tenantId, status: 'ACTIVE' } });
    const member = await leaver(a, 'Isolated');
    expect((await call(a, member.userId, { reason: 'Left' })).status).toBe(200);
    expect(await owner.iamSession.count({ where: { tenantId: b.tenantId, revokedAt: null } })).toBe(bSessions);
    expect(await owner.iamMembership.count({ where: { tenantId: b.tenantId, status: 'ACTIVE' } })).toBe(bMembers);
    expect(await owner.auditLog.count({ where: { tenantId: b.tenantId, action: 'USER_DEACTIVATED' } })).toBe(0);
  });
});
