import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appDatabaseUrl, ownerDatabaseUrl } from './connections';
import { asTenant } from './fixtures';

const owner = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });
const app = new PrismaClient({ datasourceUrl: appDatabaseUrl() });

const tenantId = randomUUID();
const auditLogId = randomUUID();
const iamUserId = randomUUID();
const iamAuditId = randomUUID();

beforeAll(async () => {
  await owner.$executeRaw`insert into "Tenant" (id, name) values (${tenantId}, 'Audit test tenant')`;
  await owner.$executeRaw`insert into "AuditLog" (id, "tenantId", "eventId", action, "objectType", payload, status)
    values (${auditLogId}, ${tenantId}, ${randomUUID()}, 'TEST', 'Test', '{}', 'SUCCESS')`;
  await owner.$executeRaw`insert into "IamUser" (id, email, "passwordHash", "firstName", "lastName", "updatedAt")
    values (${iamUserId}, ${`${iamUserId}@example.invalid`}, 'x', 'Audit', 'Test', now())`;
  await owner.$executeRaw`insert into "IamAuditTrail" (id, "userId", "userEmail", action, "objectType", payload)
    values (${iamAuditId}, ${iamUserId}, 'audit@example.invalid', 'TEST', 'Test', '{}')`;
});

afterAll(async () => {
  await owner.$disconnect();
  await app.$disconnect();
});

describe('audit tables are append-only for every role', () => {
  it('DBAUDIT-T001 the owner cannot update or delete audit rows', async () => {
    await expect(owner.$executeRaw`update "AuditLog" set action = 'CHANGED' where id = ${auditLogId}`).rejects.toThrow(/append-only/);
    await expect(owner.$executeRaw`delete from "AuditLog" where id = ${auditLogId}`).rejects.toThrow(/append-only/);
    await expect(owner.$executeRaw`update "IamAuditTrail" set action = 'CHANGED' where id = ${iamAuditId}`).rejects.toThrow(/append-only/);
    await expect(owner.$executeRaw`delete from "IamAuditTrail" where id = ${iamAuditId}`).rejects.toThrow(/append-only/);
  });

  it('DBAUDIT-T002 the owner cannot truncate audit tables', async () => {
    await expect(owner.$executeRawUnsafe('truncate "AuditLog" cascade')).rejects.toThrow(/append-only/);
    await expect(owner.$executeRawUnsafe('truncate "IamAuditTrail"')).rejects.toThrow(/append-only/);
  });

  it('DBAUDIT-T003 deleting an identity with audit history is refused instead of rewriting the audit row', async () => {
    await expect(owner.$executeRaw`delete from "IamUser" where id = ${iamUserId}`).rejects.toThrow(/append-only/);
    const rows = await owner.$queryRaw<{ userId: string }[]>`select "userId" from "IamAuditTrail" where id = ${iamAuditId}`;
    expect(rows[0].userId).toBe(iamUserId);
  });
});

describe('the application role is least-privileged', () => {
  it('DBAPP-T001 can insert and read audit rows', async () => {
    const id = randomUUID();
    const rows = await asTenant(app, tenantId, async (tx) => {
      await tx.$executeRaw`insert into "AuditLog" (id, "tenantId", "eventId", action, "objectType", payload, status)
        values (${id}, ${tenantId}, ${randomUUID()}, 'APP', 'Test', '{}', 'SUCCESS')`;
      return tx.$queryRaw<{ id: string }[]>`select id from "AuditLog" where id = ${id}`;
    });
    expect(rows).toHaveLength(1);
  });

  it('DBAPP-T002 has no update or delete privilege on audit tables', async () => {
    await expect(app.$executeRaw`update "AuditLog" set action = 'CHANGED' where id = ${auditLogId}`).rejects.toThrow(/permission denied/);
    await expect(app.$executeRaw`delete from "IamAuditTrail" where id = ${iamAuditId}`).rejects.toThrow(/permission denied/);
  });

  it('DBAPP-T003 cannot change the schema, truncate, or read the migration ledger', async () => {
    await expect(app.$executeRawUnsafe('drop table "AuditLog"')).rejects.toThrow(/must be owner|permission denied/);
    await expect(app.$executeRawUnsafe('alter table "AuditLog" disable trigger all')).rejects.toThrow(/must be owner|permission denied/);
    await expect(app.$executeRawUnsafe('truncate "Document" cascade')).rejects.toThrow(/permission denied/);
    await expect(app.$executeRawUnsafe('create table app_should_not_create (id int)')).rejects.toThrow(/permission denied/);
    await expect(app.$queryRawUnsafe('select * from "_prisma_migrations"')).rejects.toThrow(/permission denied/);
  });

  it('DBAPP-T004 can still read and write ordinary application data', async () => {
    const id = randomUUID();
    await app.$executeRaw`insert into "Tenant" (id, name) values (${id}, 'App role tenant')`;
    await app.$executeRaw`update "Tenant" set name = 'Renamed' where id = ${id}`;
    await app.$executeRaw`delete from "Tenant" where id = ${id}`;
    const rows = await app.$queryRaw<{ n: bigint }[]>`select count(*) as n from "Tenant" where id = ${id}`;
    expect(Number(rows[0].n)).toBe(0);
  });
});
