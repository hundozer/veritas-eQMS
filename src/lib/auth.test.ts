import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
}));
const sessionMock = vi.hoisted(() => ({ validateIamSession: vi.fn() }));

vi.mock('./db', () => ({ default: prismaMock }));
vi.mock('./iam/session', () => sessionMock);

const VALID_SESSION_TOKEN = 'A'.repeat(43);
const VALIDATED_SESSION = {
  sessionId: 'session-1',
  userId: 'iam-user-1',
  userEmail: 'iam-login@example.com',
  membershipId: 'membership-1',
  operationalUserId: 'user-1',
  organizationId: 'tenant-1',
  tenantId: 'tenant-1',
  roleId: 'role-1',
  roleName: 'Employee',
  expiresAt: new Date(Date.now() + 60_000),
};

type RequestOptions = {
  iamToken?: string;
  userEmailCookie?: string;
  userEmailHeader?: string;
};

function request(options: RequestOptions = {}): NextRequest {
  const cookies = new Map<string, string>();
  if (options.iamToken) cookies.set('iam-access-token', options.iamToken);
  if (options.userEmailCookie) cookies.set('user-email', options.userEmailCookie);

  return {
    cookies: {
      get: vi.fn((name: string) => {
        const value = cookies.get(name);
        return value === undefined ? undefined : { name, value };
      }),
    },
    headers: new Headers(
      options.userEmailHeader
        ? { 'x-user-email': options.userEmailHeader }
        : undefined,
    ),
  } as unknown as NextRequest;
}

function operationalUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'existing-user@example.com',
    fullName: 'Existing User',
    role: 'EMPLOYEE',
    department: 'QA',
    clearance: 'INTERNAL',
    accountStatus: 'ACTIVE',
    expiresAt: null,
    tenantId: 'tenant-1',
    tenant: { id: 'tenant-1', name: 'Test Tenant' },
    ...overrides,
  };
}

async function getContext() {
  const auth = await import('./auth');
  return auth.getContext;
}

describe('getContext authentication security boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('AUTH-T001: missing credentials return null', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      operationalUser({ email: 'admin@simpleafied.app', role: 'ADMIN' }),
    );

    await expect((await getContext())(request())).resolves.toBeNull();
  });

  it('AUTH-T002: an invalid session fails closed without legacy fallback', async () => {
    prismaMock.user.findUnique.mockResolvedValue(operationalUser());
    sessionMock.validateIamSession.mockResolvedValue(null);

    const result = await (await getContext())(
      request({
        iamToken: 'not-a-valid-session',
        userEmailHeader: 'existing-user@example.com',
        userEmailCookie: 'existing-user@example.com',
      }),
    );

    expect(result).toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('AUTH-T003: x-user-email cannot establish identity', async () => {
    prismaMock.user.findUnique.mockResolvedValue(operationalUser());

    const result = await (await getContext())(
      request({ userEmailHeader: 'existing-user@example.com' }),
    );

    expect(result).toBeNull();
  });

  it('AUTH-T004: user-email cookie cannot establish identity', async () => {
    prismaMock.user.findUnique.mockResolvedValue(operationalUser());

    const result = await (await getContext())(
      request({ userEmailCookie: 'existing-user@example.com' }),
    );

    expect(result).toBeNull();
  });

  it('AUTH-T005: unknown identity does not select the first user', async () => {
    sessionMock.validateIamSession.mockResolvedValue({
      ...VALIDATED_SESSION,
      operationalUserId: 'unknown-user',
    });
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(operationalUser());

    const result = await (await getContext())(
      request({ iamToken: VALID_SESSION_TOKEN, userEmailHeader: 'unknown@example.com' }),
    );

    expect.soft(result).toBeNull();
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it('AUTH-T006: authentication resolution never provisions identity records', async () => {
    sessionMock.validateIamSession.mockResolvedValue({
      ...VALIDATED_SESSION,
      operationalUserId: 'new-user',
      organizationId: 'organization-1',
    });

    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.tenant.findUnique.mockResolvedValue(null);
    prismaMock.tenant.create.mockResolvedValue({
      id: 'organization-1',
      name: 'Corporate Tenant Workspace',
    });
    prismaMock.user.create.mockResolvedValue(
      operationalUser({
        email: 'new-user@example.com',
        tenantId: 'organization-1',
        tenant: {
          id: 'organization-1',
          name: 'Corporate Tenant Workspace',
        },
      }),
    );

    const result = await (await getContext())(request({ iamToken: VALID_SESSION_TOKEN }));

    expect.soft(result).toBeNull();
    expect.soft(prismaMock.user.create).not.toHaveBeenCalled();
    expect.soft(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect.soft(prismaMock.tenant.create).not.toHaveBeenCalled();
    expect.soft(prismaMock.tenant.upsert).not.toHaveBeenCalled();
  });

  it('AUTH-T007: a valid opaque session resolves its existing operational user', async () => {
    const user = operationalUser();
    sessionMock.validateIamSession.mockResolvedValue({
      ...VALIDATED_SESSION,
    });
    prismaMock.user.findUnique.mockResolvedValue(user);

    const result = await (await getContext())(request({ iamToken: VALID_SESSION_TOKEN }));

    expect(result).toEqual({
      iamUserId: VALIDATED_SESSION.userId,
      membershipId: VALIDATED_SESSION.membershipId,
      roleId: VALIDATED_SESSION.roleId,
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      clearance: user.clearance,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
    });
  });

  it('AUTH-T008: a valid opaque session for an existing user does not mutate identity', async () => {
    const user = operationalUser();
    sessionMock.validateIamSession.mockResolvedValue({
      ...VALIDATED_SESSION,
    });
    prismaMock.user.findUnique.mockResolvedValue(user);

    const result = await (await getContext())(request({ iamToken: VALID_SESSION_TOKEN }));

    expect(result?.role).toBe('EMPLOYEE');
    expect(result?.tenantId).toBe('tenant-1');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect(prismaMock.tenant.create).not.toHaveBeenCalled();
    expect(prismaMock.tenant.update).not.toHaveBeenCalled();
    expect(prismaMock.tenant.upsert).not.toHaveBeenCalled();
  });

  it('AUTH-T009: explicit linkage remains stable when IAM and QMS emails differ', async () => {
    const user = operationalUser({ email: 'changed-qms-email@example.com' });
    sessionMock.validateIamSession.mockResolvedValue({
      ...VALIDATED_SESSION,
      userEmail: 'changed-iam-email@example.com',
    });
    prismaMock.user.findUnique.mockResolvedValue(user);

    const result = await (await getContext())(request({ iamToken: VALID_SESSION_TOKEN }));

    expect(result?.id).toBe(user.id);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: VALIDATED_SESSION.operationalUserId },
      include: { tenant: true },
    });
  });

  it('AUTH-T010: a cross-tenant explicit linkage fails closed', async () => {
    sessionMock.validateIamSession.mockResolvedValue(VALIDATED_SESSION);
    prismaMock.user.findUnique.mockResolvedValue(operationalUser({ tenantId: 'tenant-2' }));

    await expect((await getContext())(request({ iamToken: VALID_SESSION_TOKEN }))).resolves.toBeNull();
  });

  it('AUTH-T011: a missing operational-user linkage fails closed', async () => {
    sessionMock.validateIamSession.mockResolvedValue({
      ...VALIDATED_SESSION,
      operationalUserId: null,
    });

    await expect((await getContext())(request({ iamToken: VALID_SESSION_TOKEN }))).resolves.toBeNull();
  });

  it('AUTH-T012: an inactive linked operational user fails closed', async () => {
    sessionMock.validateIamSession.mockResolvedValue(VALIDATED_SESSION);
    prismaMock.user.findUnique.mockResolvedValue(operationalUser({ accountStatus: 'INACTIVE' }));

    await expect((await getContext())(request({ iamToken: VALID_SESSION_TOKEN }))).resolves.toBeNull();
  });
});
