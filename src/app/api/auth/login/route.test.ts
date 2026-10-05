import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const prismaMock = vi.hoisted(() => ({
  iamUser: { findUnique: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
  tenant: { create: vi.fn() },
  iamOrganization: { create: vi.fn() },
  iamMembership: { create: vi.fn() },
}));
const passwordMock = vi.hoisted(() => ({ verifyPassword: vi.fn() }));
const sessionMock = vi.hoisted(() => ({ createIamSession: vi.fn() }));

vi.mock('@/lib/db', () => ({ default: prismaMock }));
vi.mock('@/lib/iam/password', () => passwordMock);
vi.mock('@/lib/iam/session', () => sessionMock);

import { POST } from './route';

const sessionToken = 'S'.repeat(43);
const organization = { id: 'organization-1', tenantId: 'tenant-1', status: 'ACTIVE' };
const operationalUser = {
  id: 'user-1',
  email: 'different-qms-email@example.com',
  fullName: 'Quality User',
  role: 'EMPLOYEE',
  department: 'QA',
  clearance: 'INTERNAL',
  tenantId: organization.tenantId,
  accountStatus: 'ACTIVE',
  expiresAt: null,
  tenant: { id: organization.tenantId, name: 'Tenant' },
};
const membership = {
  id: 'membership-1',
  userId: 'iam-user-1',
  organizationId: organization.id,
  tenantId: organization.tenantId,
  status: 'ACTIVE',
  organization,
  role: { id: 'role-1', name: 'Employee' },
  operationalUser,
};
const iamUser = {
  id: 'iam-user-1',
  email: 'member@example.com',
  passwordHash: '$argon2id$redacted',
  accountStatus: 'ACTIVE',
  memberships: [membership],
};

function request(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers({ 'user-agent': 'Veritas login test' }),
  } as unknown as NextRequest;
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.iamUser.findUnique.mockResolvedValue(iamUser);
    passwordMock.verifyPassword.mockResolvedValue(true);
    sessionMock.createIamSession.mockResolvedValue({
      sessionId: 'session-1',
      sessionToken,
      expiresAt: new Date(Date.now() + 43_200_000),
    });
  });

  it('LOGIN-T001: valid IAM credentials issue a secure opaque session cookie', async () => {
    const response = await POST(request({ email: iamUser.email, password: 'correct password' }));
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(passwordMock.verifyPassword).toHaveBeenCalledWith('correct password', iamUser.passwordHash);
    expect(sessionMock.createIamSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: iamUser.id,
      membershipId: membership.id,
    }));
    expect(setCookie).toContain(`iam-access-token=${sessionToken}`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).not.toContain(iamUser.email);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      user: {
        id: operationalUser.id,
        email: operationalUser.email,
        fullName: operationalUser.fullName,
        role: operationalUser.role,
        department: operationalUser.department,
        clearance: operationalUser.clearance,
        tenantId: operationalUser.tenantId,
        tenantName: operationalUser.tenant.name,
      },
    });
  });

  it('LOGIN-T002: a wrong password fails generically without a session', async () => {
    passwordMock.verifyPassword.mockResolvedValue(false);
    const response = await POST(request({ email: iamUser.email, password: 'wrong' }));

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(sessionMock.createIamSession).not.toHaveBeenCalled();
  });

  it('LOGIN-T003: an unknown email fails generically', async () => {
    prismaMock.iamUser.findUnique.mockResolvedValue(null);
    const response = await POST(request({ email: 'unknown@example.com', password: 'password' }));

    expect(response.status).toBe(401);
    expect(sessionMock.createIamSession).not.toHaveBeenCalled();
  });

  it('LOGIN-T004: inactive users cannot authenticate', async () => {
    prismaMock.iamUser.findUnique.mockResolvedValue({ ...iamUser, accountStatus: 'SUSPENDED' });
    const response = await POST(request({ email: iamUser.email, password: 'password' }));

    expect(response.status).toBe(401);
    expect(sessionMock.createIamSession).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive membership', { ...membership, status: 'SUSPENDED' }],
    ['inactive organization', {
      ...membership,
      organization: { ...organization, status: 'SUSPENDED' },
    }],
  ])('LOGIN-T005: %s cannot authenticate', async (_name, unusableMembership) => {
    prismaMock.iamUser.findUnique.mockResolvedValue({
      ...iamUser,
      memberships: [unusableMembership],
    });
    const response = await POST(request({ email: iamUser.email, password: 'password' }));

    expect(response.status).toBe(401);
    expect(sessionMock.createIamSession).not.toHaveBeenCalled();
  });

  it('LOGIN-T006: missing passwords fail without password verification', async () => {
    const response = await POST(request({ email: iamUser.email }));

    expect(response.status).toBe(401);
    expect(passwordMock.verifyPassword).not.toHaveBeenCalled();
  });

  it('LOGIN-T007: multiple active memberships require explicit selection', async () => {
    prismaMock.iamUser.findUnique.mockResolvedValue({
      ...iamUser,
      memberships: [membership, { ...membership, id: 'membership-2' }],
    });
    const response = await POST(request({ email: iamUser.email, password: 'password' }));

    expect(response.status).toBe(409);
    expect(sessionMock.createIamSession).not.toHaveBeenCalled();
  });

  it('LOGIN-T008: login never provisions identity or tenant records', async () => {
    prismaMock.iamUser.findUnique.mockResolvedValue({
      ...iamUser,
      memberships: [{ ...membership, operationalUser: null }],
    });
    const response = await POST(request({ email: iamUser.email, password: 'password' }));

    expect(response.status).toBe(401);
    expect(prismaMock.iamUser.create).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.tenant.create).not.toHaveBeenCalled();
    expect(prismaMock.iamOrganization.create).not.toHaveBeenCalled();
    expect(prismaMock.iamMembership.create).not.toHaveBeenCalled();
  });
});
