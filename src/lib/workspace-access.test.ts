import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({ getContext: vi.fn() }));
const navigationMock = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT ${path}`); }),
}));
vi.mock('@/lib/auth', () => authMock);
vi.mock('next/navigation', () => navigationMock);
vi.mock('../app/(marketing)/Landing', () => ({ default: () => null }));

import { workspaceSections } from './workspace-access';

const member = { id: 'user-1', tenantId: 'tenant-a', permissions: ['documents.read'] };

describe('workspace access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('APP-T001 the workspace is rendered only for a valid session', async () => {
    const { default: AppLayout } = await import('../app/(app)/layout');

    authMock.getContext.mockResolvedValue(null);
    await expect(AppLayout({ children: 'workspace' })).rejects.toThrow('NEXT_REDIRECT /');

    authMock.getContext.mockResolvedValue(member);
    await expect(AppLayout({ children: 'workspace' })).resolves.toBe('workspace');
  });

  it('APP-T002 the landing page is the same for everyone; a member with a session is sent on to /app', async () => {
    const { default: HomePage } = await import('../app/(marketing)/page');
    expect(HomePage()).toBeTruthy();
    expect(authMock.getContext).not.toHaveBeenCalled();

    const { hasActiveSession } = await import('./session-client');
    const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
    await expect(hasActiveSession(reply(200, { user: { id: 'user-1' } }) as never)).resolves.toBe(true);
    await expect(hasActiveSession(reply(401, { error: {} }) as never)).resolves.toBe(false);
    await expect(hasActiveSession(vi.fn(async () => { throw new Error('offline'); }) as never)).resolves.toBe(false);
  });

  it('APP-T003 sections follow persisted permissions, not job titles', () => {
    expect(workspaceSections(['documents.read'])).toEqual(['dashboard', 'documents', 'training']);
    expect(workspaceSections(['users.read'])).toContain('users-management');
    expect(workspaceSections(['audit.read'])).toContain('audit');
    expect(workspaceSections(undefined)).toEqual(['dashboard', 'documents', 'training']);
    // A role name in the permission list grants nothing.
    expect(workspaceSections(['ADMIN', 'OWNER', 'AUDITOR'])).toEqual(['dashboard', 'documents', 'training']);
  });
});
