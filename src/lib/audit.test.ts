import { describe, expect, it, vi } from 'vitest';
import type { UserContext } from './auth';
import { writeMandatoryAudit } from './audit';

const context: UserContext = {
  iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1', membershipRole: 'QUALITY_MANAGER',
  id: 'operational-1', email: 'historical@example.invalid', fullName: 'Actor', role: 'EMPLOYEE', department: 'QA',
  clearance: 'INTERNAL', tenantId: 'tenant-1', tenantName: 'Tenant',
};

describe('mandatory audit writer', () => {
  it('persists immutable authoritative actor and tenant attribution with server values', async () => {
    const create = vi.fn().mockResolvedValue({});
    await writeMandatoryAudit({ auditLog: { create } } as never, {
      context, action: 'Document.Update', objectType: 'Document', objectId: 'doc-1', payload: { before: 'DRAFT', after: 'IN_REVIEW' },
    });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tenantId: 'tenant-1', userId: 'operational-1', iamUserId: 'iam-1', membershipId: 'membership-1',
      roleId: 'role-1', userRole: 'QUALITY_MANAGER', action: 'Document.Update', objectId: 'doc-1',
    }) });
  });

  it('propagates persistence failure instead of swallowing it', async () => {
    const failure = new Error('audit insert failed');
    const tx = { auditLog: { create: vi.fn().mockRejectedValue(failure) } };
    await expect(writeMandatoryAudit(tx as never, {
      context, action: 'CAPA.Update', objectType: 'CAPA', payload: {},
    })).rejects.toBe(failure);
  });
});
