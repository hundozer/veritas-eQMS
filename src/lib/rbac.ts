import type { UserContext } from './auth';

export const P0_PERMISSIONS = [
  'users.read', 'users.create', 'users.update', 'users.deactivate',
  'documents.read', 'documents.create', 'documents.update_draft',
  'documents.submit_review', 'documents.review', 'documents.approve', 'documents.obsolete',
  'training.read_own', 'training.complete_own', 'training.read_all', 'training.assign',
  'change.read', 'change.create', 'change.review', 'change.approve',
  'nonconformance.read', 'nonconformance.create', 'nonconformance.investigate', 'nonconformance.close',
  'capa.read', 'capa.create', 'capa.update', 'capa.approve_close',
  'audit.read', 'audit.export',
] as const;

export type P0Permission = typeof P0_PERMISSIONS[number];
export type RbacRole =
  | 'TENANT_ADMIN'
  | 'QUALITY_MANAGER'
  | 'DOCUMENT_OWNER'
  | 'APPROVER'
  | 'EMPLOYEE'
  | 'AUDITOR';

const ROLE_ALIASES: Readonly<Record<string, RbacRole>> = {
  TENANT_ADMIN: 'TENANT_ADMIN',
  ADMIN: 'TENANT_ADMIN',
  OWNER: 'TENANT_ADMIN',
  QUALITY_MANAGER: 'QUALITY_MANAGER',
  DOCUMENT_OWNER: 'DOCUMENT_OWNER',
  APPROVER: 'APPROVER',
  EMPLOYEE: 'EMPLOYEE',
  AUDITOR: 'AUDITOR',
  EXTERNAL_AUDITOR: 'AUDITOR',
};

const ROLE_PERMISSIONS: Readonly<Record<RbacRole, ReadonlySet<P0Permission>>> = {
  TENANT_ADMIN: new Set([
    'users.read', 'users.create', 'users.update', 'users.deactivate',
    'documents.read', 'audit.read', 'audit.export',
  ]),
  QUALITY_MANAGER: new Set([
    'users.read',
    'documents.read', 'documents.create', 'documents.update_draft', 'documents.submit_review',
    'documents.review', 'documents.approve', 'documents.obsolete',
    'training.read_own', 'training.complete_own', 'training.read_all', 'training.assign',
    'change.read', 'change.create', 'change.review', 'change.approve',
    'nonconformance.read', 'nonconformance.create', 'nonconformance.investigate', 'nonconformance.close',
    'capa.read', 'capa.create', 'capa.update', 'capa.approve_close',
    'audit.read', 'audit.export',
  ]),
  DOCUMENT_OWNER: new Set([
    'documents.read', 'documents.create', 'documents.update_draft', 'documents.submit_review',
    'training.read_own', 'training.complete_own',
    'change.read', 'change.create', 'nonconformance.read', 'nonconformance.create', 'capa.read', 'capa.create',
  ]),
  APPROVER: new Set([
    'documents.read', 'documents.review', 'documents.approve',
    'training.read_own', 'training.complete_own',
    'change.read', 'change.review', 'change.approve',
    'nonconformance.read', 'nonconformance.close', 'capa.read', 'capa.approve_close', 'audit.read',
  ]),
  EMPLOYEE: new Set([
    'documents.read', 'training.read_own', 'training.complete_own',
    'change.read', 'nonconformance.read', 'nonconformance.create', 'capa.read',
  ]),
  AUDITOR: new Set([
    'users.read', 'documents.read', 'training.read_all', 'change.read',
    'nonconformance.read', 'capa.read', 'audit.read', 'audit.export',
  ]),
};

export function getP0RoleDefinitions(): Array<{ role: RbacRole; permissions: P0Permission[] }> {
  return (Object.keys(ROLE_PERMISSIONS) as RbacRole[]).map((role) => ({
    role,
    permissions: [...ROLE_PERMISSIONS[role]],
  }));
}

export function normalizeMembershipRole(roleName: string | null | undefined): RbacRole | null {
  if (!roleName) return null;
  const key = roleName.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return ROLE_ALIASES[key] ?? null;
}

export function hasPermission(
  context: UserContext | null | undefined,
  permission: string,
  tenantId?: string,
): boolean {
  if (!context?.membershipRole || !context.tenantId) return false;
  if (tenantId !== undefined && context.tenantId !== tenantId) return false;
  const role = normalizeMembershipRole(context.membershipRole);
  if (!role || !P0_PERMISSIONS.includes(permission as P0Permission)) return false;
  return ROLE_PERMISSIONS[role].has(permission as P0Permission);
}
