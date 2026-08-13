import { describe, expect, it } from 'vitest';
import type { UserContext } from './auth';
import { hasPermission, normalizeMembershipRole } from './rbac';

function context(membershipRole?: string, tenantId = 'tenant-1'): UserContext {
  return {
    iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1', membershipRole: membershipRole ?? '',
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
    ['TENANT_ADMIN', 'users.create'], ['QUALITY_MANAGER', 'capa.update'],
    ['DOCUMENT_OWNER', 'documents.update_draft'], ['APPROVER', 'documents.approve'],
    ['EMPLOYEE', 'training.complete_own'], ['AUDITOR', 'audit.export'],
  ])('%s receives its intended capability', (role, permission) => {
    expect(hasPermission(context(role), permission)).toBe(true);
  });

  it.each([
    ['TENANT_ADMIN', 'documents.approve'], ['QUALITY_MANAGER', 'users.create'],
    ['DOCUMENT_OWNER', 'users.update'], ['APPROVER', 'users.create'],
    ['EMPLOYEE', 'capa.update'], ['AUDITOR', 'documents.create'],
  ])('%s is denied unrelated privilege', (role, permission) => {
    expect(hasPermission(context(role), permission)).toBe(false);
  });

  it('denies missing/unknown roles, undefined permissions, and cross-tenant requests', () => {
    expect(hasPermission(context(), 'documents.read')).toBe(false);
    expect(hasPermission(context('UNKNOWN'), 'documents.read')).toBe(false);
    expect(hasPermission(context('TENANT_ADMIN'), 'future.undefined')).toBe(false);
    expect(hasPermission(context('TENANT_ADMIN'), 'users.read', 'tenant-2')).toBe(false);
  });

  it('ignores the operational display role', () => {
    expect(hasPermission({ ...context('EMPLOYEE'), role: 'ADMIN' }, 'users.create')).toBe(false);
  });
});
