import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getContext, findMany } = vi.hoisted(() => ({
  getContext: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getContext }));
vi.mock('@/lib/tenant-db', async () => (await import('../../../test-support/tenant-db-double')).tenantDbDouble());
vi.mock('@/lib/db', () => ({
  default: { notification: { findMany } },
}));

import { GET } from './route';

const authorizedContext = {
  id: 'user-1',
  tenantId: 'tenant-1',
  membershipRole: 'EMPLOYEE',
  permissions: ['notification.read_own'],
};

function request() {
  return new NextRequest('http://localhost/api/notifications');
}

describe('notification read authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('NOTIFICATION-T001 rejects an unauthenticated request before data access', async () => {
    getContext.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('NOTIFICATION-T002 rejects a membership without the persisted permission', async () => {
    getContext.mockResolvedValue({ ...authorizedContext, permissions: [] });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 'Forbidden', message: 'Notification self-read permission is required' },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('NOTIFICATION-T003 returns only the current user tenant notifications', async () => {
    const notifications = [{ id: 'notification-1' }];
    getContext.mockResolvedValue(authorizedContext);
    findMany.mockResolvedValue(notifications);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', tenantId: 'tenant-1' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    expect(await response.json()).toEqual({ notifications });
  });
});
