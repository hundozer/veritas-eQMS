import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routeFiles = [
  'src/app/api/deviations/route.ts',
  'src/app/api/deviations/[id]/route.ts',
  'src/app/api/capas/route.ts',
  'src/app/api/capas/[id]/route.ts',
];
const page = readFileSync(resolve('src/app/page.tsx'), 'utf8');
const equipmentList = readFileSync(resolve('src/app/api/equipment/route.ts'), 'utf8');
const equipmentDetail = readFileSync(resolve('src/app/api/equipment/[id]/route.ts'), 'utf8');

describe('quality-event containment', () => {
  it.each([
    ['deviation list', async () => (await import('../app/api/deviations/route')).GET()],
    ['deviation create', async () => (await import('../app/api/deviations/route')).POST()],
    ['deviation detail', async () => (await import('../app/api/deviations/[id]/route')).GET()],
    ['deviation update', async () => (await import('../app/api/deviations/[id]/route')).PUT()],
    ['CAPA list', async () => (await import('../app/api/capas/route')).GET()],
    ['CAPA create', async () => (await import('../app/api/capas/route')).POST()],
    ['CAPA update', async () => (await import('../app/api/capas/[id]/route')).PUT()],
  ])('QUALITY-T001 keeps %s fail-closed before accepting input', async (_name, invoke) => {
    const response = await invoke();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('86400');
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'QualityEventsDisabled' } });
  });

  it('QUALITY-T002 removes request, identity, data, AI, and audit dependencies from every route', () => {
    for (const file of routeFiles) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).toContain('qualityEventsDisabled');
      expect(source).not.toMatch(/NextRequest|prisma|getContext|hasPermission|autoMap|writeMandatoryAudit|unexpectedErrorResponse/);
    }
  });

  it('QUALITY-UI-T001 removes quality events from navigation and automatic loading', () => {
    for (const token of [
      'interface Deviation', 'interface CAPA', 'selectedDeviationId', 'selectedCapaId',
      'showCreateDeviation', 'showCreateCapa', 'showCapaSign', 'showDeviationInvestigate',
      'handleCreateDeviation', 'handleDeviationInvestigate', 'handleCreateCapa', 'handleCapaSignOff',
      'quality-events', "fetch('/api/deviations", "fetch('/api/capas", 'selectedEquipment.deviations',
    ]) expect(page).not.toContain(token);
    expect(page).not.toContain('<DashboardAnalytics');
    expect(page).toContain('Unavailable during recovery');
  });

  it('QUALITY-T003 prevents equipment reads from re-exposing deviation relations', () => {
    expect(equipmentList).not.toContain('deviations:');
    expect(equipmentDetail).not.toContain('deviations:');
    expect(equipmentList).not.toContain('detectedBy');
    expect(equipmentDetail).not.toContain('detectedBy');
  });
});
