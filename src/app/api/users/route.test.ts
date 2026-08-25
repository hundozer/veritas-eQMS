import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getContext, findMany, create, update, transaction } = vi.hoisted(() => ({
  getContext: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getContext }));
vi.mock('@/lib/db', () => ({
  default: { user: { findMany, create, update }, $transaction: transaction },
}));

import { GET, POST } from './route';
import { DELETE, PUT } from './[id]/route';

const context = {
  id: 'user-1',
  tenantId: 'tenant-1',
  membershipRole: 'TENANT_ADMIN',
  permissions: ['users.read'],
};

function request() {
  return new NextRequest('http://localhost/api/users');
}

describe('user-administration containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('USER-ADMIN-T001 rejects roster reads without identity or persisted permission', async () => {
    getContext.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    getContext.mockResolvedValue({ ...context, permissions: [] });
    expect((await GET(request())).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('USER-ADMIN-T002 returns a minimized non-cacheable tenant roster', async () => {
    const users = [{ id: 'user-1', fullName: 'Current User' }];
    getContext.mockResolvedValue(context);
    findMany.mockResolvedValue(users);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: {
        id: true,
        fullName: true,
        email: true,
        accountStatus: true,
        role: true,
        department: true,
        site: true,
        employmentType: true,
        clearance: true,
        expiresAt: true,
      },
      orderBy: { fullName: 'asc' },
    });
    await expect(response.json()).resolves.toEqual({ users });
  });

  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['DELETE', DELETE],
  ])('USER-ADMIN-T003 disables %s without identity or data processing', async (_method, handler) => {
    const response = await handler();

    expect(handler).toHaveLength(0);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('86400');
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'UserAdministrationDisabled',
        message: 'User provisioning and role changes are temporarily unavailable',
      },
    });
    expect(getContext).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
