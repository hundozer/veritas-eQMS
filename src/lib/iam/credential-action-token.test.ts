import { createHash } from 'node:crypto';
import { IamCredentialActionPurpose } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  iamUser: { findUnique: vi.fn() },
  iamCredentialActionToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('../db', () => ({ default: prismaMock }));

import {
  consumeCredentialActionToken,
  createCredentialActionToken,
  CredentialActionError,
} from './credential-action-token';

const PURPOSE = IamCredentialActionPurpose.PASSWORD_SETUP;
const activeUser = { id: 'iam-user-1', accountStatus: 'ACTIVE' };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function storedToken(overrides: Record<string, unknown> = {}) {
  return {
    id: 'credential-token-1',
    purpose: PURPOSE,
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: activeUser,
    ...overrides,
  };
}

describe('IAM credential-action tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );
    prismaMock.iamUser.findUnique.mockResolvedValue(activeUser);
    prismaMock.iamCredentialActionToken.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.iamCredentialActionToken.create.mockResolvedValue({ id: 'credential-token-1' });
    prismaMock.iamCredentialActionToken.findUnique.mockResolvedValue(storedToken());
  });

  it('CRED-T001: creates a hashed 30-minute token for an eligible user', async () => {
    const before = Date.now();
    const result = await createCredentialActionToken({ userId: activeUser.id, purpose: PURPOSE });
    const after = Date.now();
    const write = prismaMock.iamCredentialActionToken.create.mock.calls[0][0].data;

    expect(result.token).not.toHaveLength(0);
    expect(write.tokenHash).not.toBe(result.token);
    expect(write.tokenHash).toBe(sha256(result.token));
    expect(write.purpose).toBe(PURPOSE);
    expect(write.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 1_800_000);
    expect(write.expiresAt.getTime()).toBeLessThanOrEqual(after + 1_800_000);
  });

  it('CRED-T002: issues distinct plaintext tokens and hashes', async () => {
    const first = await createCredentialActionToken({ userId: activeUser.id, purpose: PURPOSE });
    const second = await createCredentialActionToken({ userId: activeUser.id, purpose: PURPOSE });
    const [firstWrite, secondWrite] = prismaMock.iamCredentialActionToken.create.mock.calls
      .map(call => call[0].data);

    expect(first.token).not.toBe(second.token);
    expect(firstWrite.tokenHash).not.toBe(secondWrite.tokenHash);
  });

  it('CRED-T003: never passes the plaintext token into Prisma', async () => {
    const result = await createCredentialActionToken({ userId: activeUser.id, purpose: PURPOSE });
    const serializedWrite = JSON.stringify(
      prismaMock.iamCredentialActionToken.create.mock.calls[0][0],
    );

    expect(serializedWrite).not.toContain(result.token);
    expect(prismaMock.iamCredentialActionToken.upsert).not.toHaveBeenCalled();
  });

  it('CRED-T004: rejects an unknown user', async () => {
    prismaMock.iamUser.findUnique.mockResolvedValue(null);

    await expect(createCredentialActionToken({ userId: 'unknown', purpose: PURPOSE }))
      .rejects.toBeInstanceOf(CredentialActionError);
    expect(prismaMock.iamCredentialActionToken.create).not.toHaveBeenCalled();
  });

  it('CRED-T005: rejects an ineligible user', async () => {
    prismaMock.iamUser.findUnique.mockResolvedValue({ ...activeUser, accountStatus: 'SUSPENDED' });

    await expect(createCredentialActionToken({ userId: activeUser.id, purpose: PURPOSE }))
      .rejects.toBeInstanceOf(CredentialActionError);
    expect(prismaMock.iamCredentialActionToken.create).not.toHaveBeenCalled();
  });

  it('CRED-T006: invalidates outstanding same-purpose tokens before issuance', async () => {
    await createCredentialActionToken({ userId: activeUser.id, purpose: PURPOSE });
    const invalidation = prismaMock.iamCredentialActionToken.updateMany.mock.calls[0][0];

    expect(invalidation.where).toMatchObject({
      userId: activeUser.id,
      purpose: PURPOSE,
      consumedAt: null,
    });
    expect(invalidation.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(invalidation.data.consumedAt).toBeInstanceOf(Date);
  });

  it('CRED-T007: leaves the other credential-action purpose unaffected', async () => {
    await createCredentialActionToken({
      userId: activeUser.id,
      purpose: IamCredentialActionPurpose.PASSWORD_RESET,
    });
    const invalidation = prismaMock.iamCredentialActionToken.updateMany.mock.calls[0][0];

    expect(invalidation.where.purpose).toBe(IamCredentialActionPurpose.PASSWORD_RESET);
    expect(invalidation.where.purpose).not.toBe(IamCredentialActionPurpose.PASSWORD_SETUP);
  });

  it('CRED-T008: consumes a valid token exactly once', async () => {
    await expect(consumeCredentialActionToken({ token: 'valid-token', expectedPurpose: PURPOSE }))
      .resolves.toEqual({ userId: activeUser.id });

    expect(prismaMock.iamCredentialActionToken.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'credential-token-1',
        purpose: PURPOSE,
        consumedAt: null,
        expiresAt: { gt: expect.any(Date) },
      }),
      data: { consumedAt: expect.any(Date) },
    });
  });

  it('CRED-T009: rejects an expired token', async () => {
    prismaMock.iamCredentialActionToken.findUnique.mockResolvedValue(
      storedToken({ expiresAt: new Date(Date.now() - 1) }),
    );

    await expect(consumeCredentialActionToken({ token: 'expired', expectedPurpose: PURPOSE }))
      .rejects.toBeInstanceOf(CredentialActionError);
    expect(prismaMock.iamCredentialActionToken.updateMany).not.toHaveBeenCalled();
  });

  it('CRED-T010: rejects an already-consumed token', async () => {
    prismaMock.iamCredentialActionToken.findUnique.mockResolvedValue(
      storedToken({ consumedAt: new Date() }),
    );

    await expect(consumeCredentialActionToken({ token: 'consumed', expectedPurpose: PURPOSE }))
      .rejects.toBeInstanceOf(CredentialActionError);
    expect(prismaMock.iamCredentialActionToken.updateMany).not.toHaveBeenCalled();
  });

  it('CRED-T011: rejects a purpose mismatch', async () => {
    await expect(consumeCredentialActionToken({
      token: 'wrong-purpose',
      expectedPurpose: IamCredentialActionPurpose.PASSWORD_RESET,
    })).rejects.toBeInstanceOf(CredentialActionError);
    expect(prismaMock.iamCredentialActionToken.updateMany).not.toHaveBeenCalled();
  });

  it('CRED-T012: rejects unknown and malformed tokens generically', async () => {
    prismaMock.iamCredentialActionToken.findUnique.mockResolvedValue(null);

    const unknown = consumeCredentialActionToken({ token: 'unknown', expectedPurpose: PURPOSE });
    const empty = consumeCredentialActionToken({ token: '', expectedPurpose: PURPOSE });

    await expect(unknown).rejects.toEqual(expect.objectContaining({
      code: 'CREDENTIAL_ACTION_DENIED',
      message: 'Unable to complete credential action',
    }));
    await expect(empty).rejects.toEqual(expect.objectContaining({
      code: 'CREDENTIAL_ACTION_DENIED',
      message: 'Unable to complete credential action',
    }));
  });

  it('CRED-T013: allows only one concurrent conditional consumption', async () => {
    prismaMock.iamCredentialActionToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      consumeCredentialActionToken({ token: 'same-token', expectedPurpose: PURPOSE }),
      consumeCredentialActionToken({ token: 'same-token', expectedPurpose: PURPOSE }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('CRED-T014: bounds unique-hash collision regeneration', async () => {
    prismaMock.iamCredentialActionToken.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['tokenHash'] },
    });

    await expect(createCredentialActionToken({ userId: activeUser.id, purpose: PURPOSE }))
      .rejects.toBeInstanceOf(CredentialActionError);
    expect(prismaMock.iamCredentialActionToken.create).toHaveBeenCalledTimes(3);
    expect(prismaMock.iamCredentialActionToken.upsert).not.toHaveBeenCalled();
  });

  it('CRED-T015: never logs token or credential material', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'debug').mockImplementation(() => undefined),
    ];

    const created = await createCredentialActionToken({ userId: activeUser.id, purpose: PURPOSE });
    prismaMock.iamCredentialActionToken.findUnique.mockResolvedValue(storedToken());
    await consumeCredentialActionToken({ token: created.token, expectedPurpose: PURPOSE });

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
