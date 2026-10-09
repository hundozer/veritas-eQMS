import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifyPassword: vi.fn(),
  writeMandatoryAudit: vi.fn(),
  logSecurityEventBestEffort: vi.fn(),
  recentFailures: vi.fn(),
}));
vi.mock('./db', () => ({ default: { iamUser: { findUnique: mocks.findUnique } } }));
vi.mock('./iam/password', () => ({ verifyPassword: mocks.verifyPassword }));
vi.mock('./audit', () => ({ writeMandatoryAudit: mocks.writeMandatoryAudit }));
vi.mock('./auth', () => ({ logSecurityEventBestEffort: mocks.logSecurityEventBestEffort }));
vi.mock('./tenant-db', () => ({
  tenantRead: (tenantId: string, read: (tx: unknown) => unknown) => read({ auditLog: { count: (args: unknown) => mocks.recentFailures(tenantId, args) } }),
}));

import { MAX_FAILED_SIGNING_ATTEMPTS, recordSignature, SignatureError, signatureFailedResponse, verifySignerOrRecordFailure, verifySignerPassword } from './signatures';

const context = {
  id: 'user-1', iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1', membershipRole: 'Quality Manager',
  permissions: [], email: 'qa@example.invalid', fullName: 'Quinn QA', role: 'QA', department: 'QA',
  clearance: 'INTERNAL', tenantId: 'tenant-a', tenantName: 'Tenant A',
};
const request = { headers: new Headers({ 'x-forwarded-for': '192.0.2.10, 10.0.0.1' }), nextUrl: { pathname: '/api/documents/d/approve' } };

describe('electronic signatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({ passwordHash: 'hash', accountStatus: 'ACTIVE' });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.recentFailures.mockResolvedValue(0);
  });

  it('ESIG-T001 checks the password of the signed-in identity only', async () => {
    await verifySignerPassword(context, 'secret');

    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'iam-1' } }));
    expect(mocks.verifyPassword).toHaveBeenCalledWith('secret', 'hash');
  });

  it('ESIG-T002 refuses a missing password, a wrong password and an inactive identity', async () => {
    await expect(verifySignerPassword(context, '')).rejects.toMatchObject({ reason: 'PASSWORD_REQUIRED' });
    await expect(verifySignerPassword(context, undefined)).rejects.toBeInstanceOf(SignatureError);

    mocks.verifyPassword.mockResolvedValue(false);
    await expect(verifySignerPassword(context, 'wrong')).rejects.toMatchObject({ reason: 'PASSWORD_MISMATCH' });

    mocks.verifyPassword.mockResolvedValue(true);
    mocks.findUnique.mockResolvedValue({ passwordHash: 'hash', accountStatus: 'SUSPENDED' });
    await expect(verifySignerPassword(context, 'secret')).rejects.toMatchObject({ reason: 'PASSWORD_MISMATCH' });
  });

  it('ESIG-T003 audits every failed signing attempt without the password', async () => {
    mocks.verifyPassword.mockResolvedValue(false);

    await expect(verifySignerOrRecordFailure(context, 'wrong', 'version-1', request)).rejects.toBeInstanceOf(SignatureError);

    expect(mocks.logSecurityEventBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SIGNATURE_FAILED', status: 'Failed', objectId: 'version-1', tenantId: 'tenant-a', sourceIp: '192.0.2.10',
    }));
    expect(JSON.stringify(mocks.logSecurityEventBestEffort.mock.calls)).not.toContain('wrong');
  });

  it('ESIG-T004 records who signed, what it means and the hash signed, with its audit row', async () => {
    const tx = { signatureManifest: { create: vi.fn().mockResolvedValue({ id: 'signature-1' }) } };

    await recordSignature(tx as never, {
      context, meaning: 'APPROVED', comment: 'fine', sourceIp: '192.0.2.10', requestUrl: '/x',
      version: { id: 'version-1', documentId: 'doc-1', versionNumber: 2, hash: 'abc123' },
    });

    expect(tx.signatureManifest.create).toHaveBeenCalledWith({ data: {
      documentVersionId: 'version-1', tenantId: 'tenant-a', signedBy: 'user-1', iamUserId: 'iam-1', membershipId: 'membership-1',
      signerName: 'Quinn QA', signerRole: 'Quality Manager', meaning: 'APPROVED', hashSigned: 'abc123',
      ipAddress: '192.0.2.10', comment: 'fine',
    } });
    expect(mocks.writeMandatoryAudit).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'SIGNATURE_APPLIED', objectId: 'version-1',
      payload: expect.objectContaining({ signatureId: 'signature-1', meaning: 'APPROVED', hashSigned: 'abc123' }),
    }));
  });

  it('ESIG-T005 after five wrong passwords in 15 minutes signing is refused without checking the password, and audited', async () => {
    mocks.recentFailures.mockResolvedValue(MAX_FAILED_SIGNING_ATTEMPTS);

    await expect(verifySignerOrRecordFailure(context, 'secret', 'version-1', request)).rejects.toMatchObject({ reason: 'TOO_MANY_ATTEMPTS' });

    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    const [tenantId, { where }] = mocks.recentFailures.mock.calls[0];
    expect(tenantId).toBe('tenant-a');
    expect(where).toMatchObject({ tenantId: 'tenant-a', userId: 'user-1', action: 'SIGNATURE_FAILED', payload: { contains: 'PASSWORD_MISMATCH' } });
    expect(Date.now() - where.timestamp.gte.getTime()).toBeCloseTo(15 * 60 * 1000, -3);
    expect(mocks.logSecurityEventBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SIGNATURE_FAILED', payload: { reason: 'TOO_MANY_ATTEMPTS' },
    }));
    expect(signatureFailedResponse(new SignatureError('TOO_MANY_ATTEMPTS')).status).toBe(429);
  });

  it('ESIG-T006 below the limit the password is checked as usual', async () => {
    mocks.recentFailures.mockResolvedValue(MAX_FAILED_SIGNING_ATTEMPTS - 1);

    await expect(verifySignerOrRecordFailure(context, 'secret', 'version-1', request)).resolves.toBeUndefined();
    expect(mocks.verifyPassword).toHaveBeenCalledWith('secret', 'hash');
    expect(signatureFailedResponse(new SignatureError('PASSWORD_MISMATCH')).status).toBe(403);
  });
});
