import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(resolve('src/app/api/documents/[id]/effective/route.ts'), 'utf8');
const page = readFileSync(resolve('src/app/page.tsx'), 'utf8');

describe('document release containment', () => {
  it('DOCUMENT-RELEASE-T001 fails closed before accepting input or reaching dependencies', async () => {
    const { POST } = await import('../app/api/documents/[id]/effective/route');
    const response = await POST();

    expect(POST).toHaveLength(0);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('86400');
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'DocumentReleaseDisabled' } });
    expect(route).not.toMatch(/NextRequest|prisma|getContext|hasPermission|writeMandatoryAudit|unexpectedErrorResponse/);
  });

  it('DOCUMENT-RELEASE-UI-T001 removes the release mutation and states the limitation', () => {
    expect(page).not.toContain('handleMakeEffective');
    expect(page).not.toContain("/effective`,");
    expect(page).not.toContain('>Make Effective</button>');
    expect(page).toContain('Release unavailable pending distinct release authority.');
  });
});
