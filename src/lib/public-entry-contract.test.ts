import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { appPageSource } from '../test-support/app-pages';

// The public landing page is its own component; the workspace is behind a
// server-side session check at /app.
const landingSource = readFileSync(new URL('../app/(marketing)/Landing.tsx', import.meta.url), 'utf8');
const source = appPageSource();

describe('public entry containment contract', () => {
  it('ENTRY-T001: exposes no self-service provisioning trigger', () => {
    expect(landingSource).not.toContain('setShowOnboardingWizard(true)');
    expect(landingSource).not.toContain('setShowRegisterModal(true)');
    expect(landingSource).toContain('setShowDemoRequestModal(true)');
  });

  it('ENTRY-T005: excludes dormant registration and onboarding implementations', () => {
    for (const prohibitedImplementation of [
      '/api/auth/register',
      '/api/onboarding/initialize',
      'handleRegisterCompany',
      'showRegisterModal',
      'showOnboardingWizard',
      'OnboardingWizardModal',
      'Provision GxP Organization',
    ]) {
      expect(source).not.toContain(prohibitedImplementation);
    }
  });

  it('ENTRY-T002: exposes no unfinished SSO control', () => {
    expect(landingSource).not.toContain('Sign in with Microsoft');
    expect(landingSource).not.toContain('Sign in with Google');
    expect(landingSource).not.toContain('Sign in with Simpleafied Identity');
    expect(landingSource).toContain('Single sign-on is unavailable during controlled recovery');
  });

  it('ENTRY-T003: excludes categorical compliance guarantees', () => {
    for (const unsupportedClaim of [
      '21 CFR PART 11 / EU ANNEX 11 VERIFIED',
      '100% AUDIT READY',
      'IMMUTABLE AUDIT LEDGER',
      'Inspection-Ready in 48 Hours',
      'Audit-Ready Guarantee',
      'zero orphan records',
    ]) {
      expect(landingSource.toUpperCase()).not.toContain(unsupportedClaim.toUpperCase());
    }
  });

  it('ENTRY-T004: preserves password login for existing members', () => {
    expect(landingSource).toContain('Member Sign In');
    expect(landingSource).toContain('Work Email Address');
    expect(landingSource).toContain('Password');
    expect(landingSource).toContain('AUTHENTICATE WORKSPACE SESSION');
  });

  it('ENTRY-T006: does not collect or dispatch demonstration-request personal data', () => {
    expect(landingSource).not.toContain("fetch('/api/demo-request'");
    expect(landingSource).not.toContain('demoEmail');
    expect(landingSource).not.toContain('demoName');
    expect(landingSource).toContain('mailto:contact@simpleafied.app?subject=Veritas%20Product%20Walkthrough');
    expect(landingSource).toContain('no contact details are submitted through Veritas');
  });
});
