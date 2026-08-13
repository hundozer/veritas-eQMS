import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { UserContext } from '@/lib/auth';

const authMock = vi.hoisted(() => ({ getContext: vi.fn(), logAuditEvent: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  trainingRequirement: { findMany: vi.fn() },
  trainingAssignment: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock('@/lib/auth', () => authMock);
vi.mock('@/lib/db', () => ({ default: prismaMock }));
vi.mock('@/lib/rbac', async () => await import('../../../lib/rbac'));
vi.mock('@/lib/audit', async () => await import('../../../lib/audit'));

import { GET, POST } from './route';
import { PUT } from './[id]/route';

function context(membershipRole: string, tenantId = 'tenant-1'): UserContext {
  return {
    iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1', membershipRole,
    id: 'user-1', email: 'user@example.invalid', fullName: 'User', role: 'ADMIN', department: 'QA',
    clearance: 'INTERNAL', tenantId, tenantName: 'Tenant',
  };
}

function request(method = 'GET', body?: object) {
  return new NextRequest('https://veritas.example.test/api/users', {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('user-administration RBAC boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.trainingRequirement.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  it('returns 401 before database access when unauthenticated', async () => {
    authMock.getContext.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('allows tenant admin user reads and scopes them to the authenticated tenant', async () => {
    authMock.getContext.mockResolvedValue(context('TENANT_ADMIN'));
    expect((await GET(request())).status).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1' },
    }));
  });

  it('denies employee administration even when client body claims an admin role', async () => {
    authMock.getContext.mockResolvedValue(context('EMPLOYEE'));
    const response = await POST(request('POST', {
      email: 'new@example.invalid', fullName: 'New User', role: 'TENANT_ADMIN', clientRole: 'TENANT_ADMIN',
    }));
    expect(response.status).toBe(403);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('prevents tenant admins from assigning platform privilege', async () => {
    authMock.getContext.mockResolvedValue(context('TENANT_ADMIN'));
    const response = await POST(request('POST', {
      email: 'new@example.invalid', fullName: 'New User', role: 'PLATFORM_ADMIN',
    }));
    expect(response.status).toBe(403);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('creates one user and one mandatory audit event in the same transaction', async () => {
    authMock.getContext.mockResolvedValue(context('TENANT_ADMIN'));
    prismaMock.user.create.mockResolvedValue({ id: 'new-user', email: 'new@example.invalid', role: 'EMPLOYEE', department: 'QA' });
    const response = await POST(request('POST', { email: 'new@example.invalid', fullName: 'New User', role: 'EMPLOYEE' }));
    expect(response.status).toBe(201);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.user.create).toHaveBeenCalledOnce();
    expect(prismaMock.auditLog.create).toHaveBeenCalledOnce();
  });

  it('fails the regulated operation when mandatory audit persistence fails', async () => {
    authMock.getContext.mockResolvedValue(context('TENANT_ADMIN'));
    prismaMock.user.create.mockResolvedValue({ id: 'new-user', email: 'new@example.invalid', role: 'EMPLOYEE', department: 'QA' });
    prismaMock.auditLog.create.mockRejectedValue(new Error('audit unavailable'));
    const response = await POST(request('POST', { email: 'new@example.invalid', fullName: 'New User', role: 'EMPLOYEE' }));
    expect(response.status).toBe(500);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.user.create).toHaveBeenCalledOnce();
    expect(prismaMock.auditLog.create).toHaveBeenCalledOnce();
  });

  it('does not update a user belonging to another tenant', async () => {
    authMock.getContext.mockResolvedValue(context('TENANT_ADMIN'));
    prismaMock.user.findUnique.mockResolvedValue({ id: 'target', tenantId: 'tenant-2' });
    const response = await PUT(request('PUT', { fullName: 'Changed' }), {
      params: Promise.resolve({ id: 'target' }),
    });
    expect(response.status).toBe(404);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
