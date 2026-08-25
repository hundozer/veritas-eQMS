import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  'prisma/migrations/20260824160000_add_notification_read_own_permission/migration.sql',
), 'utf8');

describe('notification self-read permission migration', () => {
  it('NOTIFICATION-PERM-T001 seeds one idempotent permission transaction', () => {
    expect(migration).toContain("'veritas.permission.notification.read_own'");
    expect(migration.match(/'notification\.read_own'/g)).toHaveLength(2);
    expect(migration).toContain('ON CONFLICT ("name") DO UPDATE');
    expect(migration).toContain('ON CONFLICT ("roleId", "permissionId") DO NOTHING');
    expect(migration.trimStart().split('\n')[2]).toBe('BEGIN;');
    expect(migration.trimEnd().endsWith('COMMIT;')).toBe(true);
  });

  it('NOTIFICATION-PERM-T002 grants every approved tenant role family', () => {
    for (const role of [
      'TENANT_ADMIN', 'ADMIN', 'OWNER', 'ORGANIZATION_OWNER',
      'QUALITY_MANAGER', 'DOCUMENT_OWNER', 'APPROVER', 'EMPLOYEE',
      'AUDITOR', 'EXTERNAL_AUDITOR',
    ]) {
      expect(migration).toContain(`'${role}'`);
    }
    expect(migration).not.toContain('PLATFORM_ADMIN');
  });

  it('NOTIFICATION-PERM-T003 is additive and non-destructive', () => {
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b|\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+"IamRole"/i);
  });
});
