import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getP0RoleDefinitions, P0_PERMISSIONS } from '../rbac';

const migration = readFileSync(resolve(
  'prisma/migrations/20260824130000_seed_canonical_iam_permissions/migration.sql',
), 'utf8');

describe('canonical IAM permission data migration', () => {
  it('IAM-PERM-T001 seeds the exact canonical P0 namespace idempotently', () => {
    const seeded = [...migration.matchAll(/\('veritas\.permission\.[^']+', '([^']+)', 'Canonical Veritas permission:/g)]
      .map((match) => match[1]);

    expect(seeded).toHaveLength(P0_PERMISSIONS.length);
    expect(new Set(seeded)).toEqual(new Set(P0_PERMISSIONS));
    expect(migration).toContain('ON CONFLICT ("name") DO UPDATE');
    expect(migration).toContain('ON CONFLICT ("roleId", "permissionId") DO NOTHING');
  });

  it('IAM-PERM-T002 maps only the six approved tenant role families', () => {
    const assignmentBlock = migration.slice(migration.indexOf('canonical_role_permissions'));
    const assignments = [...assignmentBlock.matchAll(/\('([A-Z_]+)', ARRAY\[([\s\S]*?)\]::TEXT\[\]\)/g)]
      .map((match) => ({
        role: match[1],
        permissions: [...match[2].matchAll(/'([^']+)'/g)].map((permission) => permission[1]),
      }));

    expect(assignments.map(({ role }) => role)).toEqual([
      'TENANT_ADMIN', 'QUALITY_MANAGER', 'DOCUMENT_OWNER', 'APPROVER', 'EMPLOYEE', 'AUDITOR',
    ]);
    expect(assignments).toEqual(getP0RoleDefinitions());
    expect(assignments.flatMap(({ permissions }) => permissions)).toHaveLength(73);
    expect(migration).toContain("'ORGANIZATION_OWNER'");
    expect(migration).toContain("'EXTERNAL_AUDITOR'");
    expect(migration).not.toContain('PLATFORM_ADMIN');
  });

  it('IAM-PERM-T003 is additive and never deletes roles, permissions, or assignments', () => {
    expect(migration.trimStart().split('\n')[2]).toBe('BEGIN;');
    expect(migration.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(migration).not.toMatch(/UPDATE\s+"IamRolePermission"/i);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+"IamRole"/i);
  });
});
