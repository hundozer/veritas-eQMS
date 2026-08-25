import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('POST /api/onboarding/initialize containment boundary', () => {
  it('ONBOARDING-T001: fails closed with no provisioning capability', async () => {
    const response = await POST();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('86400');
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'ProvisioningDisabled',
        message: 'Enterprise workspace provisioning is temporarily unavailable',
      },
    });
  });

  it('ONBOARDING-T002: exposes no request-controlled execution path', () => {
    expect(POST.length).toBe(0);
  });
});
