import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve('src/app/page.tsx'), 'utf8');

describe('user-administration UI containment', () => {
  it('USER-ADMIN-UI-T001 removes provisioning and role-change controls', () => {
    expect(page).not.toContain('handleInviteUser');
    expect(page).not.toContain('handleUpdateUserRole');
    expect(page).not.toContain('showInviteUserModal');
    expect(page).not.toContain('showEditUserModal');
    expect(page).not.toContain('Invite Team Member & Assign Role');
    expect(page).not.toContain('Reassign Role');
    expect(page).not.toMatch(/fetch\(`?\/api\/users\/\$\{/);
    expect(page).toContain('IAM-bound provisioning, role changes, and deactivation are temporarily unavailable.');
  });
});
