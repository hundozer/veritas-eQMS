import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  iamUser: { findUnique: vi.fn() },
  iamMembership: { findUnique: vi.fn() },
  iamSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('../db', () => ({ default: prismaMock }));

import {
  createIamSession,
  IamSessionCreationError,
  revokeIamSession,
  validateIamSession,
} from './session';

const activeUser = { id: 'iam-user-1', accountStatus: 'ACTIVE' };
const activeMembership = {
  id: 'membership-1',
  userId: activeUser.id,
  organizationId: 'organization-1',
  tenantId: 'tenant-1',
  operationalUserId: 'user-1',
  status: 'ACTIVE',
  organization: { id: 'organization-1', tenantId: 'tenant-1', status: 'ACTIVE' },
  role: {
    id: 'role-1',
    name: 'Employee',
    permissions: [
      { permissionId: 'permission-1', permission: { id: 'permission-1', name: 'documents.read' } },
    ],
  },
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('createIamSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.iamUser.findUnique.mockResolvedValue(activeUser);
    prismaMock.iamMembership.findUnique.mockResolvedValue(activeMembership);
    prismaMock.iamSession.create.mockResolvedValue({ id: 'session-1' });
  });

  it('SESSION-T001: creates a 12-hour session for an active IAM context', async () => {
    const before = Date.now();
    const result = await createIamSession({
      userId: activeUser.id,
      membershipId: activeMembership.id,
    });
    const after = Date.now();
    const persisted = prismaMock.iamSession.create.mock.calls[0][0].data;

    expect(result.sessionToken).not.toHaveLength(0);
    expect(persisted.tokenHash).not.toBe(result.sessionToken);
    expect(persisted.tokenHash).toBe(sha256(result.sessionToken));
    expect(persisted.userId).toBe(activeUser.id);
    expect(persisted.membershipId).toBe(activeMembership.id);
    expect(persisted.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 43_200_000);
    expect(persisted.expiresAt.getTime()).toBeLessThanOrEqual(after + 43_200_000);
    expect(persisted.revokedAt).toBeNull();
  });

  it('SESSION-T002: rejects an inactive or suspended user', async () => {
    prismaMock.iamUser.findUnique.mockResolvedValue({ ...activeUser, accountStatus: 'SUSPENDED' });

    await expect(createIamSession({ userId: activeUser.id, membershipId: activeMembership.id }))
      .rejects.toBeInstanceOf(IamSessionCreationError);
    expect(prismaMock.iamSession.create).not.toHaveBeenCalled();
  });

  it('SESSION-T003: rejects an inactive membership', async () => {
    prismaMock.iamMembership.findUnique.mockResolvedValue({ ...activeMembership, status: 'SUSPENDED' });

    await expect(createIamSession({ userId: activeUser.id, membershipId: activeMembership.id }))
      .rejects.toBeInstanceOf(IamSessionCreationError);
    expect(prismaMock.iamSession.create).not.toHaveBeenCalled();
  });

  it('SESSION-T004: rejects a membership owned by another user', async () => {
    prismaMock.iamMembership.findUnique.mockResolvedValue({ ...activeMembership, userId: 'other-user' });

    await expect(createIamSession({ userId: activeUser.id, membershipId: activeMembership.id }))
      .rejects.toBeInstanceOf(IamSessionCreationError);
    expect(prismaMock.iamSession.create).not.toHaveBeenCalled();
  });

  it('SESSION-T005: rejects an inactive organization', async () => {
    prismaMock.iamMembership.findUnique.mockResolvedValue({
      ...activeMembership,
      organization: { id: 'organization-1', tenantId: 'tenant-1', status: 'SUSPENDED' },
    });

    await expect(createIamSession({ userId: activeUser.id, membershipId: activeMembership.id }))
      .rejects.toBeInstanceOf(IamSessionCreationError);
    expect(prismaMock.iamSession.create).not.toHaveBeenCalled();
  });

  it('SESSION-T006: rejects an unknown membership', async () => {
    prismaMock.iamMembership.findUnique.mockResolvedValue(null);

    await expect(createIamSession({ userId: activeUser.id, membershipId: 'unknown' }))
      .rejects.toBeInstanceOf(IamSessionCreationError);
    expect(prismaMock.iamSession.create).not.toHaveBeenCalled();
  });

  it('SESSION-T007: creates distinct tokens and hashes across calls', async () => {
    prismaMock.iamSession.create
      .mockResolvedValueOnce({ id: 'session-1' })
      .mockResolvedValueOnce({ id: 'session-2' });

    const first = await createIamSession({ userId: activeUser.id, membershipId: activeMembership.id });
    const second = await createIamSession({ userId: activeUser.id, membershipId: activeMembership.id });
    const [firstWrite, secondWrite] = prismaMock.iamSession.create.mock.calls.map(call => call[0].data);

    expect(first.sessionToken).not.toBe(second.sessionToken);
    expect(firstWrite.tokenHash).not.toBe(secondWrite.tokenHash);
  });

  it('SESSION-T008: never passes the plaintext token into Prisma persistence', async () => {
    const result = await createIamSession({ userId: activeUser.id, membershipId: activeMembership.id });
    const serializedWrite = JSON.stringify(prismaMock.iamSession.create.mock.calls[0][0]);

    expect(serializedWrite).not.toContain(result.sessionToken);
    expect(prismaMock.iamSession.upsert).not.toHaveBeenCalled();
  });

  it('SESSION-T009: stores request metadata only in its intended fields', async () => {
    await createIamSession({
      userId: activeUser.id,
      membershipId: activeMembership.id,
      ipAddress: '192.0.2.10',
      userAgent: 'Veritas session test',
      location: 'Prague',
    });
    const persisted = prismaMock.iamSession.create.mock.calls[0][0].data;

    expect(persisted).toMatchObject({
      ipAddress: '192.0.2.10',
      userAgent: 'Veritas session test',
      location: 'Prague',
    });
    expect(Object.keys(persisted).sort()).toEqual([
      'expiresAt', 'ipAddress', 'location', 'membershipId', 'revokedAt',
      'tokenHash', 'userAgent', 'userId',
    ].sort());
  });

  it('SESSION-T010: retries a token-hash collision without overwrite or upsert', async () => {
    prismaMock.iamSession.create
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['tokenHash'] } })
      .mockResolvedValueOnce({ id: 'session-after-collision' });

    const result = await createIamSession({ userId: activeUser.id, membershipId: activeMembership.id });
    const [firstWrite, secondWrite] = prismaMock.iamSession.create.mock.calls.map(call => call[0].data);

    expect(prismaMock.iamSession.create).toHaveBeenCalledTimes(2);
    expect(firstWrite.tokenHash).not.toBe(secondWrite.tokenHash);
    expect(secondWrite.tokenHash).toBe(sha256(result.sessionToken));
    expect(prismaMock.iamSession.upsert).not.toHaveBeenCalled();

    prismaMock.iamSession.create.mockClear();
    prismaMock.iamSession.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['tokenHash'] },
    });

    await expect(createIamSession({ userId: activeUser.id, membershipId: activeMembership.id }))
      .rejects.toBeInstanceOf(IamSessionCreationError);
    expect(prismaMock.iamSession.create).toHaveBeenCalledTimes(3);
    expect(prismaMock.iamSession.upsert).not.toHaveBeenCalled();
  });
});

describe('validateIamSession and revokeIamSession', () => {
  const token = 'A'.repeat(43);
  const storedSession = {
    id: 'session-1',
    userId: activeUser.id,
    membershipId: activeMembership.id,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user: { ...activeUser, email: 'existing-user@example.com' },
    membership: activeMembership,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.iamSession.findUnique.mockResolvedValue(storedSession);
    prismaMock.iamSession.updateMany.mockResolvedValue({ count: 1 });
  });

  it('SESSION-T011: validates a live opaque session by its hash', async () => {
    const result = await validateIamSession(token);

    expect(result).toMatchObject({
      sessionId: storedSession.id,
      userEmail: storedSession.user.email,
      membershipId: activeMembership.id,
      organizationId: activeMembership.organization.id,
      permissions: ['documents.read'],
    });
    expect(prismaMock.iamSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: sha256(token) },
        include: expect.objectContaining({
          membership: expect.objectContaining({
            include: expect.objectContaining({
              role: { include: { permissions: { include: { permission: true } } } },
            }),
          }),
        }),
      }),
    );
  });

  it('SESSION-T012: rejects malformed and nonexistent tokens', async () => {
    await expect(validateIamSession('malformed')).resolves.toBeNull();
    expect(prismaMock.iamSession.findUnique).not.toHaveBeenCalled();

    prismaMock.iamSession.findUnique.mockResolvedValue(null);
    await expect(validateIamSession(token)).resolves.toBeNull();
  });

  it('SESSION-T013: rejects a revoked session', async () => {
    prismaMock.iamSession.findUnique.mockResolvedValue({
      ...storedSession,
      revokedAt: new Date(),
    });
    await expect(validateIamSession(token)).resolves.toBeNull();
  });

  it('SESSION-T014: rejects an expired session', async () => {
    prismaMock.iamSession.findUnique.mockResolvedValue({
      ...storedSession,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(validateIamSession(token)).resolves.toBeNull();
  });

  it('SESSION-T015: rejects a session after its user becomes inactive', async () => {
    prismaMock.iamSession.findUnique.mockResolvedValue({
      ...storedSession,
      user: { ...storedSession.user, accountStatus: 'SUSPENDED' },
    });
    await expect(validateIamSession(token)).resolves.toBeNull();
  });

  it('SESSION-T016: rejects a session after its membership becomes inactive', async () => {
    prismaMock.iamSession.findUnique.mockResolvedValue({
      ...storedSession,
      membership: { ...activeMembership, status: 'SUSPENDED' },
    });
    await expect(validateIamSession(token)).resolves.toBeNull();
  });

  it('SESSION-T017: rejects a session after its organization becomes inactive', async () => {
    prismaMock.iamSession.findUnique.mockResolvedValue({
      ...storedSession,
      membership: {
        ...activeMembership,
        organization: { ...activeMembership.organization, status: 'SUSPENDED' },
      },
    });
    await expect(validateIamSession(token)).resolves.toBeNull();
  });

  it('SESSION-T018: revokes a session by hash without persisting plaintext', async () => {
    await expect(revokeIamSession(token)).resolves.toBe(true);
    const write = prismaMock.iamSession.updateMany.mock.calls[0][0];

    expect(write.where.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(write)).not.toContain(token);
    expect(write.data.revokedAt).toBeInstanceOf(Date);
  });

  it('SESSION-T019: malformed tokens cannot trigger a revocation write', async () => {
    await expect(revokeIamSession('malformed')).resolves.toBe(false);
    expect(prismaMock.iamSession.updateMany).not.toHaveBeenCalled();
  });
});
