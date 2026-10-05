import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

describe('POST /api/demo-request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('DEMO-T001 fails closed without accepting a request', async () => {
    const response = await POST();

    expect(POST).toHaveLength(0);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('86400');
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'DemoRequestDisabled',
        message: 'Online demonstration requests are temporarily unavailable',
      },
    });
  });

  it('DEMO-T002 cannot dispatch personal data to any network processor', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await POST();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
