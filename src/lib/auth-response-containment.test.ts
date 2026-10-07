import { describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({ getContext: vi.fn() }));
vi.mock('@/lib/auth', () => authMock);

const context = {
  iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1', membershipRole: 'QUALITY_MANAGER',
  permissions: ['documents.read'], id: 'user-1', email: 'user@example.invalid', fullName: 'Quality User',
  role: 'ADMIN', department: 'QA', clearance: 'RESTRICTED', tenantId: 'tenant-1', tenantName: 'Tenant One',
};

describe('authentication response containment', () => {
  it('AUTH-RESPONSE-T001 returns only browser-required identity fields without IAM internals', async () => {
    authMock.getContext.mockResolvedValue(context);
    const { GET } = await import('../app/api/auth/session/route');
    const response = await GET({} as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ user: {
      id: context.id, email: context.email, fullName: context.fullName, role: context.role,
      department: context.department, clearance: context.clearance, tenantId: context.tenantId,
      tenantName: context.tenantName, permissions: [...context.permissions],
    } });
  });

  it('AUTH-RESPONSE-T002 keeps unauthenticated session responses non-cacheable', async () => {
    authMock.getContext.mockResolvedValue(null);
    const { GET } = await import('../app/api/auth/session/route');
    const response = await GET({} as never);

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
