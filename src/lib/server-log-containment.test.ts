import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('server log containment', () => {
  it('LOG-T001 prohibits direct server console calls outside the controlled logger', () => {
    const roots = [resolve('src/app/api'), resolve('src/lib')];
    const violations: string[] = [];

    for (const root of roots) {
      for (const file of sourceFiles(root)) {
        readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
          if (!/console\.(log|error|warn|info|debug)\s*\(/.test(line)) return;
          if (file.endsWith('server-errors.ts')) return;
          violations.push(`${relative(resolve('src'), file)}:${index + 1}`);
        });
      }
    }

    expect(violations).toEqual([]);
    const logger = readFileSync(resolve('src/lib/server-errors.ts'), 'utf8');
    expect(logger.match(/console\.error\(/g)).toHaveLength(1);
    expect(logger.match(/console\.info\(/g)).toHaveLength(1);
  });

  it('LOG-T002 excludes former high-risk identifiers from server log calls', () => {
    const source = [...sourceFiles(resolve('src/app/api')), ...sourceFiles(resolve('src/lib'))]
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/console\.[^(]+\([^\n]*(documentId|versionId|\{\s*key|error\s*\}|,\s*(error|err|e)\s*\))/);
  });
});
