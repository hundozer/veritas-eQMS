import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve('src/app/page.tsx'), 'utf8');
const route = readFileSync(resolve('src/app/api/intelligence/route.ts'), 'utf8');

describe('regulatory intelligence containment', () => {
  it('INTELLIGENCE-T001 removes the fabricated score and audit-ready claims from the UI', () => {
    expect(page).not.toContain('healthScore');
    expect(page).not.toContain("fetch('/api/intelligence'");
    expect(page).not.toContain('RegulatoryIntelligenceModule');
    expect(page).not.toContain('100% Audit Ready — Continuous Compliance');
    expect(page).not.toContain('Active Engine Check:');
    expect(page).toContain('Automated compliance scoring is disabled during recovery.');
  });

  it('INTELLIGENCE-T002 exposes only the shared no-argument fail-closed handler', () => {
    expect(route).toContain('regulatoryIntelligenceDisabled');
    expect(route).not.toMatch(/getContext|logAuditEvent|calculateTenantComplianceHealth|NextRequest|NextResponse/);
    expect(route).not.toContain('overallScore');
  });
});
