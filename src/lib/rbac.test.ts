import { describe, expect, it } from 'vitest';
import type { UserContext } from './auth';
import { hasPermission, normalizeMembershipRole } from './rbac';

function context(permissions: readonly string[] = [], tenantId = 'tenant-1'): UserContext {
  return {
    iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1', membershipRole: 'IGNORED_ROLE_NAME', permissions,
    id: 'user-1', email: 'user@example.invalid', fullName: 'User', role: 'ADMIN', department: 'QA',
    clearance: 'INTERNAL', tenantId, tenantName: 'Tenant',
  };
}

describe('authoritative P0 RBAC', () => {
  it('maps only approved fixed role aliases', () => {
    expect(normalizeMembershipRole('Admin')).toBe('TENANT_ADMIN');
    expect(normalizeMembershipRole('External Auditor')).toBe('AUDITOR');
    expect(normalizeMembershipRole('platform_admin')).toBeNull();
  });

  it.each([
    'users.create', 'capa.update', 'documents.update_draft',
    'documents.approve', 'training.complete_own', 'audit.export', 'equipment.read',
  ])('grants the persisted %s capability', (permission) => {
    expect(hasPermission(context([permission]), permission)).toBe(true);
  });

  it('denies absent assignments, unassigned permissions, and cross-tenant requests', () => {
    expect(hasPermission(context([]), 'documents.read')).toBe(false);
    expect(hasPermission(context(['documents.read']), 'future.undefined')).toBe(false);
    expect(hasPermission(context(['users.read']), 'users.read', 'tenant-2')).toBe(false);
  });

  it('ignores both operational and membership role names as grants', () => {
    expect(hasPermission({ ...context([]), role: 'ADMIN', membershipRole: 'TENANT_ADMIN' }, 'users.create')).toBe(false);
  });
});
