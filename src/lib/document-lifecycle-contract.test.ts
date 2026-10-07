import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(path), 'utf8');

describe('document lifecycle route safety contracts', () => {
  it('ignores client-supplied status during document creation', () => {
    const route = source('src/app/api/documents/route.ts');
    expect(route).not.toMatch(/body\.status|status:\s*body\./);
    expect(route).toMatch(/status:\s*'DRAFT'/);
  });

  it('prevents binary editing outside the current draft', () => {
    const route = source('src/app/api/documents/[id]/route.ts');
    expect(route).toContain("document.status !== 'DRAFT'");
    expect(route).toContain("currentVersion.status !== 'DRAFT'");
    expect(route).toContain("where: { id: currentVersion.id, status: 'DRAFT' }");
  });

  it('requires assigned review and approval participants', () => {
    const submit = source('src/app/api/documents/[id]/submit-review/route.ts');
    const review = source('src/app/api/documents/[id]/review/route.ts');
    const approve = source('src/app/api/documents/[id]/approve/route.ts');
    expect(submit).toContain('reviewerId === approverId');
    expect(review).toContain('step.approverId !== user.id');
    expect(approve).toContain('approvalStep.approverId !== user.id');
  });

  it('tenant-scopes every workflow document lookup', () => {
    for (const path of [
      'src/app/api/documents/[id]/submit-review/route.ts',
      'src/app/api/documents/[id]/review/route.ts',
      'src/app/api/documents/[id]/approve/route.ts',
      'src/app/api/documents/[id]/revision/route.ts',
    ]) expect(source(path)).toContain('tenantId: user.tenantId');
  });

  it('uses central RBAC on each mutating workflow action', () => {
    expect(source('src/app/api/documents/[id]/submit-review/route.ts')).toContain("hasPermission(user, 'documents.submit_review')");
    expect(source('src/app/api/documents/[id]/review/route.ts')).toContain("hasPermission(user, 'documents.review')");
    expect(source('src/app/api/documents/[id]/approve/route.ts')).toContain("hasPermission(user, 'documents.approve')");
  });

  it('keeps effectiveness fail-closed until distinct release authority exists', () => {
    const route = source('src/app/api/documents/[id]/effective/route.ts');
    expect(route).toContain('documentReleaseDisabled');
    expect(route).not.toMatch(/NextRequest|prisma|getContext|hasPermission|writeMandatoryAudit/);
  });

  it('verifies durable integrity before submit and approval', () => {
    for (const path of [
      'src/app/api/documents/[id]/submit-review/route.ts',
      'src/app/api/documents/[id]/approve/route.ts',
    ]) expect(source(path)).toContain('await verifyLifecycleIntegrity(version)');
  });
});
