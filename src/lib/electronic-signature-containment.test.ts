import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  cAPA: { findFirst: vi.fn() },
  equipment: { findUnique: vi.fn(), update: vi.fn() },
  maintenanceLog: { create: vi.fn() },
  deviation: { create: vi.fn() },
  supplier: { findUnique: vi.fn(), update: vi.fn() },
  supplierAudit: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const authMock = vi.hoisted(() => ({ getContext: vi.fn(), logAuditEvent: vi.fn() }));
const rbacMock = vi.hoisted(() => ({ hasPermission: vi.fn() }));
const auditMock = vi.hoisted(() => ({ writeMandatoryAudit: vi.fn() }));

vi.mock('@/lib/db', () => ({ default: prismaMock }));
vi.mock('@/lib/auth', () => authMock);
vi.mock('@/lib/rbac', () => rbacMock);
vi.mock('@/lib/audit', () => auditMock);

const context = {
  id: 'quality-1', email: 'quality@example.invalid', fullName: 'Quality User', role: 'ADMIN', department: 'QA',
  clearance: 'RESTRICTED', tenantId: 'tenant-a', tenantName: 'Tenant A', membershipRole: 'QUALITY_MANAGER',
  iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1',
};

function request(body: Record<string, unknown>, path: string) {
  return { json: vi.fn().mockResolvedValue(body), nextUrl: new URL(`https://veritas.invalid${path}`) } as never;
}

describe('electronic-signature containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.getContext.mockResolvedValue(context);
    rbacMock.hasPermission.mockReturnValue(true);
  });

  it('ESIGN-T001 disables equipment signature mutations without accepting a request', async () => {
    const { POST } = await import('../app/api/equipment/[id]/logs/route');
    const response = await POST();

    expect(POST).toHaveLength(0);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'ElectronicSignatureDisabled' } });
    expect(prismaMock.equipment.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.maintenanceLog.create).not.toHaveBeenCalled();
    expect(prismaMock.deviation.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('ESIGN-T002 disables supplier-audit signatures without accepting a request', async () => {
    const { POST } = await import('../app/api/suppliers/[id]/audits/route');
    const response = await POST();

    expect(POST).toHaveLength(0);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'ElectronicSignatureDisabled' } });
    expect(prismaMock.supplier.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.supplierAudit.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
