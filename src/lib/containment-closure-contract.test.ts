import { appPageSource } from '../test-support/app-pages';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = appPageSource();
const auth = readFileSync(resolve('src/lib/auth.ts'), 'utf8');
const documentList = readFileSync(resolve('src/app/api/documents/route.ts'), 'utf8');
const documentDetail = readFileSync(resolve('src/app/api/documents/[id]/route.ts'), 'utf8');
const documentViewer = readFileSync(resolve('src/app/api/documents/[id]/pdf/route.ts'), 'utf8');

describe('repository containment closure contract', () => {
  it('CLOSURE-T001 removes legacy browser identity and persona-switching mechanisms', () => {
    expect(page).not.toContain('x-user-email');
    expect(page).not.toContain('handleUserChange');
    expect(page).not.toContain('showDemoPersonas');
    expect(page).not.toContain('document.cookie = `user-email=');
  });

  it('CLOSURE-T002 removes dormant intelligence execution code and operational-role ABAC grants', () => {
    expect(existsSync(resolve('src/ui/components/RegulatoryIntelligenceModule.tsx'))).toBe(false);
    expect(auth).not.toContain('checkAbac');
    expect(auth).not.toMatch(/user\.role\s*===/);
  });

  it('CLOSURE-T003 attributes retained document reads to the authenticated membership role', () => {
    expect(documentList).toContain('userRole: user.membershipRole');
    expect(documentDetail).toContain('userRole: user.membershipRole');
    expect(documentList).not.toContain('userRole: user.role');
    expect(documentDetail).not.toContain('userRole: user.role');
  });

  it('CLOSURE-T004 protects the controlled-copy HTML boundary', () => {
    expect(documentViewer).toContain('where: { id, tenantId: user.tenantId }');
    expect(documentViewer).toContain('function escapeHtml');
    expect(documentViewer).toContain("default-src 'none'");
    expect(documentViewer).not.toMatch(/owner:\s*true|tenant:\s*true|signer:\s*true/);
  });

  it('CLOSURE-T005 withdraws unsupported performance, signature, export, and active-record demonstrations', () => {
    for (const claim of [
      'LATENCY: 0.2ms', 'Real-time (< 50ms latency)', 'Digital signatures with SHA-256',
      'CONTROLLED RECORD ACTIVE', '[EXPORT INSPECTION PACKAGE ZIP]', 'ELECTRONIC_SIGNATURE_EXECUTED',
      'CAPA & WORKFLOWS',
    ]) expect(page).not.toContain(claim);
  });
});
