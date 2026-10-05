import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pageSource = readFileSync(resolve('src/app/page.tsx'), 'utf8');
const equipmentSources = [
  readFileSync(resolve('src/app/api/equipment/route.ts'), 'utf8'),
  readFileSync(resolve('src/app/api/equipment/[id]/route.ts'), 'utf8'),
];
const supplierSources = [
  readFileSync(resolve('src/app/api/suppliers/route.ts'), 'utf8'),
  readFileSync(resolve('src/app/api/suppliers/[id]/route.ts'), 'utf8'),
];

const prismaMock = vi.hoisted(() => ({
  equipment: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  deviation: { create: vi.fn() },
  supplier: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  supplierAttachment: { create: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  materialReceipt: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const authMock = vi.hoisted(() => ({ getContext: vi.fn(), logAuditEvent: vi.fn() }));

vi.mock('@/lib/db', () => ({ default: prismaMock }));
vi.mock('@/lib/auth', () => authMock);

const context = {
  id: 'member-1', email: 'member@example.invalid', fullName: 'Member', role: 'EMPLOYEE', department: 'QA',
  clearance: 'INTERNAL', tenantId: 'tenant-a', tenantName: 'Tenant A', membershipRole: 'EMPLOYEE',
  iamUserId: 'iam-1', membershipId: 'membership-1', roleId: 'role-1',
  permissions: ['equipment.read', 'supplier.read'],
};

function request(path: string) {
  return { nextUrl: new URL(`https://veritas.invalid${path}`) } as never;
}

describe('non-core mutation containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.getContext.mockResolvedValue(context);
    authMock.logAuditEvent.mockResolvedValue(undefined);
  });

  it('NONCORE-T001 keeps equipment GET tenant-scoped and free of equipment/deviation mutations', async () => {
    const overdueEquipment = [{
      id: 'eq-1', tenantId: 'tenant-a', name: 'Balance', status: 'ACTIVE',
      nextCalibrationDueDate: new Date('2000-01-01T00:00:00.000Z'),
    }];
    prismaMock.equipment.findMany.mockResolvedValue(overdueEquipment);
    const { GET } = await import('../app/api/equipment/route');
    const response = await GET(request('/api/equipment'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(prismaMock.equipment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a' } }));
    expect(prismaMock.equipment.update).not.toHaveBeenCalled();
    expect(prismaMock.deviation.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ equipment: overdueEquipment.map((item) => ({
      ...item, nextCalibrationDueDate: item.nextCalibrationDueDate.toISOString(),
    })) });
  });

  it.each([
    ['list', async () => (await import('../app/api/equipment/route')).GET(request('/api/equipment'))],
    ['detail', async () => (await import('../app/api/equipment/[id]/route')).GET(
      request('/api/equipment/eq-1'), { params: Promise.resolve({ id: 'eq-1' }) },
    )],
  ])('EQUIPMENT-T001 returns 401 for unauthenticated %s before equipment access', async (_name, invoke) => {
    authMock.getContext.mockResolvedValue(null);
    expect((await invoke()).status).toBe(401);
    expect(prismaMock.equipment.findMany).not.toHaveBeenCalled();
    expect(prismaMock.equipment.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['list', async () => (await import('../app/api/equipment/route')).GET(request('/api/equipment'))],
    ['detail', async () => (await import('../app/api/equipment/[id]/route')).GET(
      request('/api/equipment/eq-1'), { params: Promise.resolve({ id: 'eq-1' }) },
    )],
  ])('EQUIPMENT-T002 returns 403 for %s without persisted permission before equipment access', async (_name, invoke) => {
    authMock.getContext.mockResolvedValue({ ...context, membershipRole: 'QUALITY_MANAGER', permissions: [] });
    expect((await invoke()).status).toBe(403);
    expect(prismaMock.equipment.findMany).not.toHaveBeenCalled();
    expect(prismaMock.equipment.findFirst).not.toHaveBeenCalled();
  });

  it('EQUIPMENT-T003 scopes detail lookup by tenant and returns 404 without a second lookup', async () => {
    prismaMock.equipment.findFirst.mockResolvedValue(null);
    const { GET } = await import('../app/api/equipment/[id]/route');
    const response = await GET(request('/api/equipment/foreign-equipment'), {
      params: Promise.resolve({ id: 'foreign-equipment' }),
    });

    expect(response.status).toBe(404);
    expect(prismaMock.equipment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'foreign-equipment', tenantId: 'tenant-a' },
    }));
    expect(prismaMock.equipment.findUnique).not.toHaveBeenCalled();
    expect(authMock.logAuditEvent).not.toHaveBeenCalled();
  });

  it('EQUIPMENT-T004 returns a permitted tenant record with membership-role audit attribution', async () => {
    const equipment = { id: 'eq-1', tenantId: 'tenant-a', name: 'Balance', status: 'ACTIVE' };
    prismaMock.equipment.findFirst.mockResolvedValue(equipment);
    const { GET } = await import('../app/api/equipment/[id]/route');
    const response = await GET(request('/api/equipment/eq-1'), {
      params: Promise.resolve({ id: 'eq-1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ equipment });
    expect(prismaMock.equipment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'eq-1', tenantId: 'tenant-a' },
    }));
    expect(authMock.logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a', userRole: context.membershipRole, objectId: 'eq-1',
    }));
  });

  it.each([
    ['list', async () => (await import('../app/api/suppliers/route')).GET(request('/api/suppliers'))],
    ['detail', async () => (await import('../app/api/suppliers/[id]/route')).GET(
      request('/api/suppliers/supplier-1'), { params: Promise.resolve({ id: 'supplier-1' }) },
    )],
  ])('SUPPLIER-T001 returns 401 for unauthenticated %s before supplier access', async (_name, invoke) => {
    authMock.getContext.mockResolvedValue(null);
    expect((await invoke()).status).toBe(401);
    expect(prismaMock.supplier.findMany).not.toHaveBeenCalled();
    expect(prismaMock.supplier.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['list', async () => (await import('../app/api/suppliers/route')).GET(request('/api/suppliers'))],
    ['detail', async () => (await import('../app/api/suppliers/[id]/route')).GET(
      request('/api/suppliers/supplier-1'), { params: Promise.resolve({ id: 'supplier-1' }) },
    )],
  ])('SUPPLIER-T002 returns 403 for %s without persisted permission before supplier access', async (_name, invoke) => {
    authMock.getContext.mockResolvedValue({ ...context, membershipRole: 'QUALITY_MANAGER', permissions: ['equipment.read'] });
    expect((await invoke()).status).toBe(403);
    expect(prismaMock.supplier.findMany).not.toHaveBeenCalled();
    expect(prismaMock.supplier.findFirst).not.toHaveBeenCalled();
  });

  it('SUPPLIER-T003 scopes detail lookup by tenant and returns 404 without a second lookup', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    const { GET } = await import('../app/api/suppliers/[id]/route');
    const response = await GET(request('/api/suppliers/foreign-supplier'), {
      params: Promise.resolve({ id: 'foreign-supplier' }),
    });

    expect(response.status).toBe(404);
    expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'foreign-supplier', tenantId: 'tenant-a' },
    }));
    expect(prismaMock.supplier.findUnique).not.toHaveBeenCalled();
    expect(authMock.logAuditEvent).not.toHaveBeenCalled();
  });

  it('SUPPLIER-T004 returns a permitted tenant record with membership-role audit attribution', async () => {
    const supplier = { id: 'supplier-1', tenantId: 'tenant-a', name: 'Qualified Supplier' };
    prismaMock.supplier.findFirst.mockResolvedValue(supplier);
    const { GET } = await import('../app/api/suppliers/[id]/route');
    const response = await GET(request('/api/suppliers/supplier-1'), {
      params: Promise.resolve({ id: 'supplier-1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ supplier });
    expect(prismaMock.supplier.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'supplier-1', tenantId: 'tenant-a' },
    }));
    expect(authMock.logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a', userRole: context.membershipRole, objectId: 'supplier-1',
    }));
  });

  it.each([
    ['NONCORE-T002', 'equipment registration', async () => (await import('../app/api/equipment/route')).POST(), prismaMock.equipment.create],
    ['NONCORE-T003', 'supplier registration', async () => (await import('../app/api/suppliers/route')).POST(), prismaMock.supplier.create],
    ['NONCORE-T004', 'supplier attachment upload', async () => (await import('../app/api/suppliers/route')).PUT(), prismaMock.supplierAttachment.create],
    ['NONCORE-T005', 'supplier attachment deletion', async () => (await import('../app/api/suppliers/route')).DELETE(), prismaMock.supplierAttachment.delete],
    ['NONCORE-T006', 'material receipt recording', async () => (await import('../app/api/suppliers/[id]/receipts/route')).POST(), prismaMock.materialReceipt.create],
  ])('%s disables %s before any data mutation', async (_id, _label, invoke, mutation) => {
    const response = await invoke();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('86400');
    expect(mutation).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('NONCORE-UI-T001 removes dormant equipment and supplier mutation workflows from the client', () => {
    for (const token of [
      'handleLogMaintenance', 'showLogMaintenanceModal', 'eqLogPassword',
      'handleCreateSupplier', 'showCreateSupplierModal', 'newSupAttachments',
      'handleAddAttachment', 'handleDeleteAttachment', 'handleAuditSupplier',
      'showAuditSupplierModal', 'auditPassword', 'handleMaterialReceipt', 'showReceiptModal',
    ]) expect(pageSource).not.toContain(token);
  });

  it('NONCORE-READ-T001 uses explicit projections, minimized people, and private responses', () => {
    for (const source of [...equipmentSources, ...supplierSources]) {
      expect(source).toContain('select: {');
      expect(source).toContain("'Cache-Control': 'no-store'");
      expect(source).not.toMatch(/include:\s*\{\s*(performedBy|auditor|inspectedBy):\s*true/);
    }
    for (const source of equipmentSources) {
      expect(source).toContain('performedBy: { select: { fullName: true } }');
    }
    for (const source of supplierSources) {
      expect(source).toContain('auditor: { select: { fullName: true } }');
      expect(source).toContain('inspectedBy: { select: { fullName: true } }');
    }
  });
});
