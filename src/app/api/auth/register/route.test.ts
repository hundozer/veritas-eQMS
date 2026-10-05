import { afterEach, describe, expect, it, vi } from 'vitest';

const sideEffects = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  tenantCreate: vi.fn(),
  userCreate: vi.fn(),
  documentCreate: vi.fn(),
  auditCreate: vi.fn(),
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  default: {
    $transaction: sideEffects.transaction,
    user: { findUnique: sideEffects.findUnique, create: sideEffects.userCreate },
    tenant: { create: sideEffects.tenantCreate },
    document: { create: sideEffects.documentCreate },
    auditLog: { create: sideEffects.auditCreate },
  },
}));

vi.mock('@/lib/controlled-storage', () => ({
  cleanupUncontrolledObject: sideEffects.cleanup,
  createControlledObjectKey: vi.fn(),
  createServerGeneratedTextUpload: vi.fn(),
  vercelBlobStorage: {
    putObject: sideEffects.putObject,
    deleteObject: sideEffects.deleteObject,
  },
}));

import { POST } from './route';

describe('POST /api/auth/register', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('REGISTRATION-T001 fails closed with a non-cacheable service response', async () => {
    const response = await POST();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('86400');
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'RegistrationDisabled',
        message: 'Self-service organization registration is temporarily unavailable',
      },
    });
  });

  it('REGISTRATION-T002 cannot invoke network, database, storage, or audit side effects', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await POST();

    expect(fetchSpy).not.toHaveBeenCalled();
    for (const effect of Object.values(sideEffects)) {
      expect(effect).not.toHaveBeenCalled();
    }
  });

  it('REGISTRATION-T003 accepts no request argument that could be parsed', () => {
    expect(POST).toHaveLength(0);
  });
});
