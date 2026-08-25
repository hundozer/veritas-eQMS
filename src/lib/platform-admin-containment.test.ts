import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve('src/app/admin/page.tsx'), 'utf8');
const tenantRoute = readFileSync(resolve('src/app/api/admin/tenants/route.ts'), 'utf8');
const userRoute = readFileSync(resolve('src/app/api/admin/users/route.ts'), 'utf8');

describe('platform administration containment', () => {
  it.each([
    ['tenant GET', async () => (await import('../app/api/admin/tenants/route')).GET()],
    ['tenant POST', async () => (await import('../app/api/admin/tenants/route')).POST()],
    ['user GET', async () => (await import('../app/api/admin/users/route')).GET()],
    ['user POST', async () => (await import('../app/api/admin/users/route')).POST()],
  ])('PLATFORM-ADMIN-T001 keeps %s fail-closed without accepting input', async (_name, invoke) => {
    const response = await invoke();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('86400');
  });

  it('PLATFORM-ADMIN-T002 removes identity and data dependencies from remaining handlers', () => {
    for (const source of [tenantRoute, userRoute]) {
      expect(source).toContain('regulatoryIntelligenceDisabled');
      expect(source).not.toMatch(/NextRequest|getContext|prisma|hasPermission/);
    }
  });

  it('PLATFORM-ADMIN-UI-T001 ships no platform control or client authorization implementation', () => {
    expect(page).not.toContain("'use client'");
    expect(page).not.toMatch(/useState|useEffect|fetch\(|god@|God Mode|simpleafied\.(?:app|eu|de)/i);
    expect(page).not.toMatch(/handleProvision|handlePublish|handleImport|handleLogin/);
    expect(page).toContain('Platform administration unavailable');
  });
});
