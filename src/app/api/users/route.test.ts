import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getContext, findMany, create, update, transaction, provisioning } = vi.hoisted(() => {
  class ProvisioningError extends Error {
    constructor(readonly failure: string) { super(failure); }
    get status() { return 409; }
    get publicMessage() { return 'A user with this email address already exists'; }
    operationalUserId = undefined;
  }
  return {
    getContext: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
    provisioning: { ProvisioningError, inviteMember: vi.fn(), pendingInvitationUserIds: vi.fn() },
  };
});

vi.mock('@/lib/auth', () => ({ getContext }));
vi.mock('@/lib/iam/provisioning', () => provisioning);
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

function inviteRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/users', { method: 'POST', body: JSON.stringify(body) });
}

describe('user-administration containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provisioning.pendingInvitationUserIds.mockResolvedValue(new Set(['user-2']));
  });

  it('USER-ADMIN-T001 rejects roster reads without identity or persisted permission', async () => {
    getContext.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    getContext.mockResolvedValue({ ...context, permissions: [] });
    expect((await GET(request())).status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('USER-ADMIN-T002 returns a minimized non-cacheable tenant roster', async () => {
    const users = [{ id: 'user-1', fullName: 'Current User' }, { id: 'user-2', fullName: 'Invited User' }];
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
    await expect(response.json()).resolves.toEqual({ users: [
      { id: 'user-1', fullName: 'Current User', invitationPending: false },
      { id: 'user-2', fullName: 'Invited User', invitationPending: true },
    ] });
  });

  it.each([
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

  it('USER-ADMIN-T004 inviting requires users.create and goes through the provisioning service', async () => {
    getContext.mockResolvedValue(null);
    expect((await POST(inviteRequest({}))).status).toBe(401);
    getContext.mockResolvedValue({ ...context, permissions: ['users.read'] });
    expect((await POST(inviteRequest({}))).status).toBe(403);
    expect(provisioning.inviteMember).not.toHaveBeenCalled();

    const inviter = { ...context, permissions: ['users.create'] };
    getContext.mockResolvedValue(inviter);
    provisioning.inviteMember.mockResolvedValue({ userId: 'user-3', email: 'new@example.invalid' });
    const body = { email: 'new@example.invalid', firstName: 'New', lastName: 'Person', department: 'QA', roleId: 'role-1' };
    const response = await POST(inviteRequest(body));

    expect(response.status).toBe(201);
    expect(provisioning.inviteMember).toHaveBeenCalledWith(inviter, body, '/api/users');
  });

  it('USER-ADMIN-T005 reports provisioning refusals with their fixed message', async () => {
    getContext.mockResolvedValue({ ...context, permissions: ['users.create'] });
    provisioning.inviteMember.mockRejectedValue(new provisioning.ProvisioningError('EmailInUse'));

    const response = await POST(inviteRequest({ email: 'taken@example.invalid' }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: { code: 'EmailInUse', message: 'A user with this email address already exists' } });
  });
});
