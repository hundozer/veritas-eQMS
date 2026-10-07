import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({ getContext: vi.fn() }));
vi.mock('@/lib/auth', () => authMock);

const request = {} as never;

describe('session route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('SESSION-T001 returns the persisted permissions that gate the interface', async () => {
    authMock.getContext.mockResolvedValue({
      id: 'user-1', email: 'qm@example.invalid', fullName: 'QM', role: 'ADMIN', department: 'QA',
      clearance: 'INTERNAL', tenantId: 'tenant-a', tenantName: 'Tenant A',
      permissions: ['documents.read', 'documents.create'],
    });
    const { GET } = await import('./route');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      user: { id: 'user-1', tenantName: 'Tenant A', permissions: ['documents.read', 'documents.create'] },
    });
  });

  it('SESSION-T002 refuses without a session', async () => {
    authMock.getContext.mockResolvedValue(null);
    const { GET } = await import('./route');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
