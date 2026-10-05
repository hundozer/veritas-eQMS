import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve('src/app/page.tsx'), 'utf8');
const route = readFileSync(resolve('src/app/api/roles/route.ts'), 'utf8');

describe('role-registry containment', () => {
  it('ROLE-REGISTRY-T001 removes the conflicting static UI policy', () => {
    expect(page).not.toContain('DEFAULT_SYSTEM_ROLES');
    expect(page).not.toContain('SYSTEM_PERMISSIONS');
    expect(page).not.toContain('Visual Permission Matrix (13 System Roles × Permissions)');
    expect(page).toContain('Effective access is enforced from persisted IAM role assignments.');
    expect(existsSync(resolve('src/lib/permissions.ts'))).toBe(false);
  });

  it('ROLE-REGISTRY-T002 exposes only the shared no-argument fail-closed handler', () => {
    expect(route).toContain('regulatoryIntelligenceDisabled');
    expect(route).not.toMatch(/getContext|hasPermission|getP0RoleDefinitions|P0_PERMISSIONS|NextRequest|NextResponse/);
  });
});
