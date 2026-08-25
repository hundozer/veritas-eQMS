import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  'prisma/migrations/20260824150000_add_supplier_read_permission/migration.sql',
), 'utf8');

describe('supplier read permission migration', () => {
  it('SUPPLIER-PERM-T001 seeds one idempotent permission transaction', () => {
    expect(migration).toContain("'veritas.permission.supplier.read'");
    expect(migration.match(/'supplier\.read'/g)).toHaveLength(2);
    expect(migration).toContain('ON CONFLICT ("name") DO UPDATE');
    expect(migration).toContain('ON CONFLICT ("roleId", "permissionId") DO NOTHING');
    expect(migration.trimStart().split('\n')[2]).toBe('BEGIN;');
    expect(migration.trimEnd().endsWith('COMMIT;')).toBe(true);
  });

  it('SUPPLIER-PERM-T002 grants only quality managers and auditors', () => {
    expect(migration).toContain("IN ('QUALITY_MANAGER', 'AUDITOR', 'EXTERNAL_AUDITOR')");
    expect(migration).not.toMatch(/TENANT_ADMIN|ORGANIZATION_OWNER|PLATFORM_ADMIN|EMPLOYEE|APPROVER|DOCUMENT_OWNER/);
  });

  it('SUPPLIER-PERM-T003 is additive and non-destructive', () => {
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b|\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+"IamRole"/i);
  });
});
