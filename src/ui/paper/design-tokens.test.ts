import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Design-system gates (VER-DS-01, docs/design-system/contributing.md).
// Workspace and shared-component styles take every colour and font from the
// tokens, so light and dark themes and the paper language stay one system.

const TOKEN_FILES = ['src/app/globals.css', 'src/ui/styles/liquid-glass.css'];
// Stylesheets held to the token rules: the shared components, the workspace
// modules and the showcase. Legacy files are not listed until migrated.
const GOVERNED_DIRS = ['src/ui/paper', 'src/app/(app)', 'src/app/dev'];

function cssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const governed = GOVERNED_DIRS.flatMap((dir) => cssFiles(resolve(dir)));
const defined = new Set(
  TOKEN_FILES.flatMap((file) => [...readFileSync(resolve(file), 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])),
);

describe('design tokens', () => {
  it('DS-T001 governed stylesheets use colour tokens, never raw colour values', () => {
    expect(governed.length).toBeGreaterThan(5);
    const offenders = governed.flatMap((file) => {
      const css = withoutComments(readFileSync(file, 'utf8'));
      return [...css.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g)].map((m) => `${file}: ${m[0]}`);
    });
    expect(offenders).toEqual([]);
  });

  it('DS-T002 every custom property a governed stylesheet reads is a defined token or set in that file', () => {
    const missing = governed.flatMap((file) => {
      const css = withoutComments(readFileSync(file, 'utf8'));
      const local = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
      // A property with a fallback, var(--steps, 4), is set inline by its component.
      return [...css.matchAll(/var\((--[\w-]+)\s*\)/g)]
        .map((m) => m[1])
        .filter((name) => !defined.has(name) && !local.has(name))
        .map((name) => `${file}: ${name}`);
    });
    expect([...new Set(missing)]).toEqual([]);
  });

  it('DS-T003 no stylesheet loads a remote font or stylesheet (system fonts only, BUILD-T001)', () => {
    const offenders = [...governed, ...TOKEN_FILES.map((f) => resolve(f))].filter((file) => /@import\s+url|@font-face|fonts\.googleapis/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('DS-T004 both themes define the same colour tokens', () => {
    const css = readFileSync(resolve('src/ui/styles/liquid-glass.css'), 'utf8');
    const block = (selector: string) => {
      const start = css.indexOf(`${selector}{`);
      return new Set([...css.slice(start, css.indexOf('}', start)).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    };
    const light = block(':root');
    const dark = block(":root[data-theme='dark']");
    const themed = [...light].filter((name) => !name.startsWith('--radius') && !name.startsWith('--ease') && name !== '--ts');
    expect(themed.filter((name) => !dark.has(name))).toEqual([]);
  });

  it('DS-T005 every class in the shared paper stylesheet is used by a shared component', () => {
    const css = withoutComments(readFileSync(resolve('src/ui/paper/paper.module.css'), 'utf8'));
    const source = readdirSync(resolve('src/ui/paper'))
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => readFileSync(resolve('src/ui/paper', name), 'utf8'))
      .join('\n');
    const classes = [...new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]))];
    const used = (name: string) =>
      new RegExp(`styles\\.${name}\\b`).test(source) ||
      // Variant and state classes are looked up by name: styles[variant], styles[`stamp${state}`].
      (/^(primary|outline|quiet)$/.test(name) && source.includes('styles[variant]')) ||
      (/^stamp[A-Z_]+$/.test(name) && source.includes('styles[`stamp${state}`]'));
    expect(classes.filter((name) => !used(name))).toEqual([]);
  });
});
