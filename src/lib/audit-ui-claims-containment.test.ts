import { appPageSource } from '../test-support/app-pages';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = appPageSource();

describe('audit UI claims containment', () => {
  it('AUDIT-UI-T001 removes export controls and unsupported audit/SoD claims', () => {
    expect(page).not.toContain('handleExportAudit');
    expect(page).not.toContain('/api/reports/export?');
    expect(page).not.toContain('Immutable chronological ledger of all CUD and READ actions');
    expect(page).not.toContain('Veritas automatically enforces EU Annex 11 & 21 CFR Part 11 SoD policies');
    expect(page).toContain('Append-only storage, completeness, retention, and regulatory validation are not yet evidenced.');
  });
});
