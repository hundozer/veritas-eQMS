import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const sessionMock = vi.hoisted(() => ({ revokeIamSession: vi.fn() }));
vi.mock('@/lib/iam/session', () => sessionMock);

import { POST } from './route';

function request(token?: string): NextRequest {
  return {
    cookies: { get: vi.fn(() => token ? { value: token } : undefined) },
  } as unknown as NextRequest;
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('LOGOUT-T001: revokes the presented session and expires its cookie', async () => {
    const token = 'S'.repeat(43);
    const response = await POST(request(token));
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(sessionMock.revokeIamSession).toHaveBeenCalledWith(token);
    expect(setCookie).toContain('iam-access-token=');
    expect(setCookie.toLowerCase()).toContain('max-age=0');
    expect(setCookie.toLowerCase()).toContain('httponly');
  });
});
