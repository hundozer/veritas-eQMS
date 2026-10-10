import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getContext, findMany } = vi.hoisted(() => ({
  getContext: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getContext }));
vi.mock('../../../lib/tenant-db', async () => (await import('../../../test-support/tenant-db-double')).tenantDbDouble());
vi.mock('@/lib/db', () => ({ default: { auditLog: { findMany } } }));

import { GET } from './route';

const context = {
  id: 'user-1',
  tenantId: 'tenant-1',
  membershipRole: 'AUDITOR',
  permissions: ['audit.read'],
};

function request(query = '') {
  return new NextRequest(`http://localhost/api/audit${query}`);
}

describe('audit event index containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AUDIT-INDEX-T001 rejects unauthenticated and unauthorized reads before data access', async () => {
    getContext.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    getContext.mockResolvedValue({ ...context, permissions: [] });
    expect((await GET(request())).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('AUDIT-INDEX-T002 rejects invalid date filters before data access', async () => {
    getContext.mockResolvedValue(context);
    const response = await GET(request('?startDate=not-a-date'));
    expect(response.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('AUDIT-INDEX-T003 returns a bounded, minimized tenant event view', async () => {
    const logs = [{ id: 'log-1', eventId: 'event-1', action: 'Document.View', payload: JSON.stringify({ before: 'DRAFT', after: 'IN_REVIEW', version: 1 }) }];
    getContext.mockResolvedValue(context);
    findMany.mockResolvedValue(logs);

    const response = await GET(request('?action=Document.View'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', action: 'Document.View' },
      select: {
        id: true,
        eventId: true,
        timestamp: true,
        userEmail: true,
        userRole: true,
        action: true,
        objectType: true,
        objectId: true,
        status: true,
        payload: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
    // The raw payload is not returned; its field changes and details are.
    await expect(response.json()).resolves.toEqual({ logs: [{
      id: 'log-1', eventId: 'event-1', action: 'Document.View',
      changes: [{ field: 'status', before: 'DRAFT', after: 'IN_REVIEW' }],
      details: [{ field: 'version', value: '1' }],
    }] });
  });
});
