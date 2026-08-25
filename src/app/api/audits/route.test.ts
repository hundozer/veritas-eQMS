import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getContext, findMany, create, transaction } = vi.hoisted(() => ({
  getContext: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getContext }));
vi.mock('@/lib/db', () => ({
  default: { auditPlan: { findMany, create }, $transaction: transaction },
}));

import { GET, POST } from './route';

const context = {
  id: 'user-1',
  tenantId: 'tenant-1',
  membershipRole: 'QUALITY_MANAGER',
  permissions: ['audit_plan.read'],
};

function request() {
  return new NextRequest('http://localhost/api/audits');
}

describe('audit-plan containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AUDIT-PLAN-T001 rejects an unauthenticated read before data access', async () => {
    getContext.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('AUDIT-PLAN-T002 rejects a read without persisted permission', async () => {
    getContext.mockResolvedValue({ ...context, permissions: [] });
    expect((await GET(request())).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('AUDIT-PLAN-T003 returns only minimized tenant-scoped summaries', async () => {
    const auditPlans = [{ id: 'audit-1', title: 'Internal audit' }];
    getContext.mockResolvedValue(context);
    findMany.mockResolvedValue(auditPlans);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      select: {
        id: true,
        title: true,
        scope: true,
        auditType: true,
        status: true,
        scheduledDate: true,
      },
      orderBy: { scheduledDate: 'desc' },
    });
    await expect(response.json()).resolves.toEqual({ auditPlans });
  });

  it('AUDIT-PLAN-T004 disables scheduling without request or data processing', async () => {
    const response = await POST();

    expect(POST).toHaveLength(0);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('86400');
    expect(getContext).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
