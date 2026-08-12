import jwt from 'jsonwebtoken';
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

vi.mock('./db', () => ({ default: prismaMock }));

const TEST_JWT_SECRET = 'test-only-veritas-auth-secret-not-for-production';

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
    tenantId: 'tenant-1',
    tenant: { id: 'tenant-1', name: 'Test Tenant' },
    ...overrides,
  };
}

async function getContext() {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  const auth = await import('./auth');
  return auth.getContext;
}

describe('getContext authentication security boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  it('AUTH-T001: missing credentials return null', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      operationalUser({ email: 'admin@simpleafied.app', role: 'ADMIN' }),
    );

    await expect((await getContext())(request())).resolves.toBeNull();
  });

  it('AUTH-T002: an invalid JWT fails closed without legacy fallback', async () => {
    prismaMock.user.findUnique.mockResolvedValue(operationalUser());

    const result = await (await getContext())(
      request({
        iamToken: 'not-a-valid-jwt',
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
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(operationalUser());

    const result = await (await getContext())(
      request({ userEmailHeader: 'unknown@example.com' }),
    );

    expect.soft(result).toBeNull();
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it('AUTH-T006: authentication resolution never provisions identity records', async () => {
    const token = jwt.sign(
      {
        email: 'new-user@example.com',
        organizationId: 'organization-1',
        roleName: 'EMPLOYEE',
      },
      TEST_JWT_SECRET,
      { expiresIn: '5m' },
    );

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

    const result = await (await getContext())(request({ iamToken: token }));

    expect.soft(result).toBeNull();
    expect.soft(prismaMock.user.create).not.toHaveBeenCalled();
    expect.soft(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect.soft(prismaMock.tenant.create).not.toHaveBeenCalled();
    expect.soft(prismaMock.tenant.upsert).not.toHaveBeenCalled();
  });

  it('AUTH-T007: a valid JWT resolves its existing operational user', async () => {
    const user = operationalUser();
    const token = jwt.sign(
      {
        email: user.email,
        organizationId: user.tenantId,
        roleName: user.role,
      },
      TEST_JWT_SECRET,
      { expiresIn: '5m' },
    );
    prismaMock.user.findUnique.mockResolvedValue(user);

    const result = await (await getContext())(request({ iamToken: token }));

    expect(result).toEqual({
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

  it('AUTH-T008: a valid JWT for an existing user does not mutate identity', async () => {
    const user = operationalUser();
    const token = jwt.sign(
      {
        email: user.email,
        organizationId: 'conflicting-organization',
        roleName: 'ADMIN',
      },
      TEST_JWT_SECRET,
      { expiresIn: '5m' },
    );
    prismaMock.user.findUnique.mockResolvedValue(user);

    const result = await (await getContext())(request({ iamToken: token }));

    expect(result?.role).toBe('EMPLOYEE');
    expect(result?.tenantId).toBe('tenant-1');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.upsert).not.toHaveBeenCalled();
    expect(prismaMock.tenant.create).not.toHaveBeenCalled();
    expect(prismaMock.tenant.update).not.toHaveBeenCalled();
    expect(prismaMock.tenant.upsert).not.toHaveBeenCalled();
  });
});
