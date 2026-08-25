import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const appShellStyles = readFileSync(new URL('../ui/styles/liquid-glass.css', import.meta.url), 'utf8');
const legacyAppShellStyles = readFileSync(new URL('../styles/liquid-glass.css', import.meta.url), 'utf8');
const themeTypography = readFileSync(new URL('../ui/theme/typography.ts', import.meta.url), 'utf8');

describe('production build reproducibility boundary', () => {
  it('BUILD-T001 does not use a build-time remote font loader', () => {
    expect(layoutSource).not.toContain('next/font/google');
    expect(layoutSource).not.toMatch(/\bGeist(?:_Mono)?\s*\(/);
  });

  it('BUILD-T002 defines network-independent sans and mono fallbacks', () => {
    expect(globalStyles).toContain('--font-sans: Arial, Helvetica, system-ui, sans-serif;');
    expect(globalStyles).toContain("--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;");
    expect(globalStyles).not.toContain('--font-geist-');
    expect(appShellStyles).toContain('font-family:var(--font-sans);');
    expect(legacyAppShellStyles).toContain('font-family:var(--font-sans);');
    expect(themeTypography).toContain('Arial, Helvetica, system-ui, sans-serif');
    expect(`${globalStyles}\n${appShellStyles}\n${legacyAppShellStyles}\n${themeTypography}`)
      .not.toContain('Plus Jakarta Sans');
  });
});
