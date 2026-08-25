import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve('src/app/page.tsx'), 'utf8');

describe('audit-plan UI containment', () => {
  it('AUDIT-PLAN-UI-T001 removes unevidenced audit-readiness and integrity claims', () => {
    expect(page).not.toContain('Export Audit Readiness Report');
    expect(page).not.toContain('All software change control records');
    expect(page).not.toContain('Immutable system audit trail logging active');
    expect(page).not.toContain('SHA-256 integrity checksums verified across all document versions');
    expect(page).toContain('Automated readiness conclusions unavailable');
  });
});
