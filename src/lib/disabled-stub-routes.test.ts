import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Handler = () => Promise<Response> | Response;

const methods: Array<[string, () => Promise<Handler>]> = [
  ['GET /api/roles', async () => (await import('../app/api/roles/route')).GET],
];

const routeFiles = [
  'src/app/api/roles/route.ts',
];

describe('public recovery stub containment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(methods)('STUB-T001 %s fails closed without accepting a request', async (_label, load) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const handler = await load();
    const response = await handler();

    expect(handler).toHaveLength(0);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('86400');
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'FeatureDisabled',
        message: 'Regulatory intelligence and platform administration are temporarily unavailable',
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('STUB-T002 route modules expose only the shared fail-closed handler', () => {
    const source = routeFiles.map((file) => readFileSync(resolve(file), 'utf8')).join('\n');

    expect(source).not.toContain('NextRequest');
    expect(source).not.toContain('NextResponse');
    expect(source).not.toContain("@/lib/db");
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('Rebuild in progress');
    expect(source.match(/recovery-disabled/g)).toHaveLength(routeFiles.length);
  });
});
