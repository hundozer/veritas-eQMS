import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every .tsx file under src, to find which shared page classes are still used.
function componentSource(directory: string): string {
  return readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return componentSource(path);
    return entry.name.endsWith('.tsx') ? readFileSync(path, 'utf8') : '';
  }).join('\n');
}

describe('shared page styles', () => {
  it('STYLES-T001 every class in page.module.css is used by a component', () => {
    const css = readFileSync(resolve('src/app/page.module.css'), 'utf8');
    const source = componentSource(resolve('src'));
    const classes = [...new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((match) => match[1]))];

    expect(classes.length).toBeGreaterThan(0);
    expect(classes.filter((name) => !new RegExp(`styles\\.${name}\\b`).test(source))).toEqual([]);
  });
});
