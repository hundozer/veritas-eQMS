import { appPageSource } from '../test-support/app-pages';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const listRoute = readFileSync(resolve('src/app/api/change-requests/route.ts'), 'utf8');
const approvalRoute = readFileSync(resolve('src/app/api/change-requests/[id]/approve/route.ts'), 'utf8');
const page = appPageSource();

describe('change-control containment', () => {
  it.each([
    ['list GET', async () => (await import('../app/api/change-requests/route')).GET()],
    ['create POST', async () => (await import('../app/api/change-requests/route')).POST()],
    ['approval POST', async () => (await import('../app/api/change-requests/[id]/approve/route')).POST()],
  ])('CHANGE-T001 keeps %s fail-closed and non-cacheable', async (_name, invoke) => {
    const response = await invoke();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('86400');
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'ChangeControlDisabled',
        message: 'Change-control workflows are temporarily unavailable',
      },
    });
  });

  it('CHANGE-T002 routes cannot accept input or reach identity, data, or audit dependencies', () => {
    for (const source of [listRoute, approvalRoute]) {
      expect(source).toContain('changeControlDisabled');
      expect(source).not.toMatch(/NextRequest|prisma|getContext|hasPermission|writeMandatoryAudit|unexpectedErrorResponse/);
    }
  });

  it('CHANGE-UI-T001 removes change control from navigation and automatic loading', () => {
    for (const token of [
      'ChangeRequest', 'changeRequests', 'selectedCRId', 'showCreateCR', 'showCRSign',
      'newCR', 'esignCR', 'change-control', 'handleCreateCR', 'handleCRSignOff', '/api/change-requests',
    ]) expect(page).not.toContain(token);
  });
});
