import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownerDatabaseUrl } from './connections';
import { addMember, createFullAccessRole, requestAs, seedTenant, type SeededTenant } from './fixtures';

// Changing a member's organisation role (VER-00.3), through the real routes
// with the application database role.
const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
let a: SeededTenant;
let b: SeededTenant;
let fullRoleId: string;
let readerRoleId: string;

async function roleWith(permissions: string[]): Promise<string> {
  const role = await owner.iamRole.create({ data: { name: `DB test role ${randomUUID()}`, description: 'test', isSystem: false } });
  const rows = await owner.iamPermission.findMany({ where: { name: { in: permissions } }, select: { id: true } });
  await owner.iamRolePermission.createMany({ data: rows.map((permission) => ({ roleId: role.id, permissionId: permission.id })) });
  return role.id;
}

beforeAll(async () => {
  fullRoleId = await createFullAccessRole(owner);
  readerRoleId = await roleWith(['training.read_own']);
  a = await seedTenant(owner, 'Alpha', fullRoleId);
  b = await seedTenant(owner, 'Bravo', fullRoleId);
});

afterAll(async () => {
  await owner.$disconnect();
});

const routes = async () => ({
  change: (await import('@/app/api/users/[id]/role/route')).POST,
  deactivate: (await import('@/app/api/users/[id]/deactivate/route')).POST,
  roles: (await import('@/app/api/roles/route')).GET,
  session: (await import('@/app/api/auth/session/route')).GET,
  users: (await import('@/app/api/users/route')).GET,
});

const as = (tenant: SeededTenant, sessionToken: string): SeededTenant => ({ ...tenant, sessionToken });

async function call(tenant: SeededTenant, id: string, body: unknown) {
  const { change } = await routes();
  return change(requestAs(tenant, `/api/users/${id}/role`, { method: 'POST', body }), { params: Promise.resolve({ id }) });
}

describe('member role change', () => {
  it('ROLE-T001 replaces the role with a reason, audited, and the member\'s existing session gets the new permissions at once', async () => {
    const { session, users } = await routes();
    const member = await addMember(owner, a, `Mover${randomUUID().slice(0, 4)}`);
    const asMember = as(a, member.sessionToken);
    expect((await users(requestAs(asMember, '/api/users'))).status).toBe(200);

    const response = await call(a, member.userId, { roleId: readerRoleId, reason: 'Moved to production, ticket 9' });
    expect(response.status).toBe(200);

    const membership = await owner.iamMembership.findFirstOrThrow({ where: { operationalUserId: member.userId } });
    expect([membership.roleId, membership.status]).toEqual([readerRoleId, 'ACTIVE']);
    // The same session, not a new sign-in, now carries only the new role's permissions.
    const current = await (await session(requestAs(asMember, '/api/auth/session'))).json();
    expect(current.user.permissions).toEqual(['training.read_own']);
    expect((await users(requestAs(asMember, '/api/users'))).status).toBe(403);

    const audit = await owner.auditLog.findFirstOrThrow({ where: { tenantId: a.tenantId, action: 'USER_ROLE_CHANGED', objectId: member.userId } });
    expect(audit.userId).toBe(a.operationalUserId);
    expect(JSON.parse(audit.payload)).toMatchObject({ roleId: { before: fullRoleId, after: readerRoleId }, reason: 'Moved to production, ticket 9' });
    expect(await owner.iamAuditTrail.count({ where: { action: 'MEMBER_ROLE_CHANGED', objectId: membership.id, reason: 'Moved to production, ticket 9' } })).toBe(1);
  });

  it('ROLE-T002 refuses a missing role or reason, oneself, another tenant\'s member, no permission, a platform role, the same role and a deactivated member, writing nothing', async () => {
    const { deactivate } = await routes();
    const member = await addMember(owner, a, `Stays${randomUUID().slice(0, 4)}`);
    const reader = await addMember(owner, a, `Reader${randomUUID().slice(0, 4)}`, readerRoleId);
    const platform = await owner.iamRole.upsert({
      where: { name: 'System Administrator' }, update: {}, create: { name: 'System Administrator', description: 'Platform', isSystem: true },
    });
    const auditBefore = await owner.auditLog.count({ where: { action: 'USER_ROLE_CHANGED' } });

    expect((await call(a, member.userId, { roleId: readerRoleId })).status).toBe(400);
    expect((await call(a, member.userId, { reason: 'no role' })).status).toBe(400);
    expect((await call(a, a.operationalUserId, { roleId: readerRoleId, reason: 'myself' })).status).toBe(409);
    expect((await call(b, member.userId, { roleId: readerRoleId, reason: 'not my organisation' })).status).toBe(404);
    expect((await call(as(a, reader.sessionToken), member.userId, { roleId: readerRoleId, reason: 'no permission' })).status).toBe(403);
    expect((await call(a, member.userId, { roleId: platform.id, reason: 'escalate' })).status).toBe(403);
    expect((await call(a, member.userId, { roleId: fullRoleId, reason: 'same' })).status).toBe(409);

    const gone = await addMember(owner, a, `Gone${randomUUID().slice(0, 4)}`);
    expect((await deactivate(requestAs(a, `/api/users/${gone.userId}/deactivate`, { method: 'POST', body: { reason: 'Left' } }), { params: Promise.resolve({ id: gone.userId }) })).status).toBe(200);
    expect((await call(a, gone.userId, { roleId: readerRoleId, reason: 'after leaving' })).status).toBe(409);

    expect((await owner.iamMembership.findFirstOrThrow({ where: { operationalUserId: member.userId } })).roleId).toBe(fullRoleId);
    expect((await owner.iamMembership.findFirstOrThrow({ where: { operationalUserId: gone.userId } })).roleId).toBe(fullRoleId);
    expect(await owner.auditLog.count({ where: { action: 'USER_ROLE_CHANGED' } })).toBe(auditBefore);
  });

  it('ROLE-T003 a member who may change roles but not invite gets the assignable roles, never a platform role', async () => {
    const { roles } = await routes();
    const roleAdmin = await addMember(owner, a, `RoleAdmin${randomUUID().slice(0, 4)}`, await roleWith(['users.read', 'users.update']));
    const listed = await roles(requestAs(as(a, roleAdmin.sessionToken), '/api/roles'));
    expect(listed.status).toBe(200);
    const names = (await listed.json()).roles.map((role: { id: string; name: string }) => role.name);
    expect(names).not.toContain('System Administrator');
    const ids = (await (await roles(requestAs(as(a, roleAdmin.sessionToken), '/api/roles'))).json()).roles.map((role: { id: string }) => role.id);
    expect(ids).toContain(readerRoleId);
  });

  it('ROLE-T004 a role change in one organisation leaves the other untouched', async () => {
    const bRoles = await owner.iamMembership.findMany({ where: { tenantId: b.tenantId }, select: { id: true, roleId: true }, orderBy: { id: 'asc' } });
    const member = await addMember(owner, a, `Iso${randomUUID().slice(0, 4)}`);
    expect((await call(a, member.userId, { roleId: readerRoleId, reason: 'Moved' })).status).toBe(200);
    expect(await owner.iamMembership.findMany({ where: { tenantId: b.tenantId }, select: { id: true, roleId: true }, orderBy: { id: 'asc' } })).toEqual(bRoles);
    expect(await owner.auditLog.count({ where: { tenantId: b.tenantId, action: 'USER_ROLE_CHANGED' } })).toBe(0);
  });
});
