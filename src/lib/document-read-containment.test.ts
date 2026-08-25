import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const listRoute = readFileSync(resolve('src/app/api/documents/route.ts'), 'utf8');
const detailRoute = readFileSync(resolve('src/app/api/documents/[id]/route.ts'), 'utf8');

describe('document read containment', () => {
  it('DOCUMENT-READ-T001 excludes assessment answers, signature internals, and full user relations', () => {
    expect(detailRoute).not.toContain('quizQuestions: true');
    expect(detailRoute).not.toContain('signatureManifest:');
    expect(detailRoute).not.toMatch(/owner:\s*true/);
    expect(detailRoute).not.toMatch(/include:\s*\{\s*approver:\s*true/);
    expect(listRoute).not.toMatch(/owner:\s*true/);
    expect(listRoute).not.toMatch(/include:\s*\{\s*approver:\s*true/);
    expect(detailRoute).not.toContain('comment: true');
    expect(listRoute).not.toContain('comment: true');
  });

  it('DOCUMENT-READ-T002 scopes detail in the database predicate and marks reads non-cacheable', () => {
    expect(detailRoute.match(/where: \{ id, tenantId: user\.tenantId \}/g)).toHaveLength(3);
    expect(detailRoute).toContain("'Cache-Control': 'no-store'");
    expect(listRoute).toContain("'Cache-Control': 'no-store'");
  });

  it('DOCUMENT-READ-T003 retains only the quiz-presence summary needed by the UI', () => {
    expect(detailRoute).toContain('select: { id: true, requiredForRoles: true, requiresQuiz: true }');
    expect(detailRoute).not.toContain('trainingRequirement: true');
  });
});
