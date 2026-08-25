import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  tenant: { findFirst: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
}));
const authMock = vi.hoisted(() => ({ logAuditEvent: vi.fn() }));

vi.mock('@/lib/db', () => ({ default: prismaMock }));
vi.mock('@/lib/auth', () => authMock);

import { GET as initiateMicrosoftSso } from './route';
import { GET as handleMicrosoftCallback } from './callback/route';

async function expectDisabled(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('retry-after')).toBe('86400');
  await expect(response.json()).resolves.toEqual({
    error: {
      code: 'SsoDisabled',
      message: 'Microsoft single sign-on is temporarily unavailable',
    },
  });
}

describe('Microsoft SSO containment boundary', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('SSO-T001: initiation fails closed without an authorization redirect', async () => {
    await expectDisabled(await initiateMicrosoftSso());
  });

  it('SSO-T002: callback fails closed without token exchange or provisioning', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expectDisabled(await handleMicrosoftCallback());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prismaMock.tenant.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(authMock.logAuditEvent).not.toHaveBeenCalled();
  });

  it('SSO-T003: neither endpoint exposes a request-controlled execution path', () => {
    expect(initiateMicrosoftSso.length).toBe(0);
    expect(handleMicrosoftCallback.length).toBe(0);
  });
});
