import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The audit export is live as a PDF (DEC-078); the reports export stays disabled.
const exportRoutes = [
  'src/app/api/reports/export/route.ts',
];

describe('sensitive export containment', () => {
  it.each(exportRoutes)('EXPORT-T001 %s exposes only the disabled handler', async (file) => {
    const source = readFileSync(resolve(file), 'utf8');
    expect(source).toContain('sensitiveExportDisabled');
    expect(source).not.toMatch(/NextRequest|NextResponse|@\/lib\/db|getContext|hasPermission|findMany|text\/csv/);

    const route = await import('../app/api/reports/export/route');
    const response = await route.GET();

    expect(route.GET).toHaveLength(0);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('86400');
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ExportDisabled', message: 'Sensitive data exports are temporarily unavailable' },
    });
  });
});
