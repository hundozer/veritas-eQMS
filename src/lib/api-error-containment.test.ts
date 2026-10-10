import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === 'route.ts' ? [path] : [];
  });
}

describe('API unexpected-error containment', () => {
  it('ERROR-T001 never serializes caught exception details in a response', () => {
    const apiRoot = resolve('src/app/api');
    const disclosures: string[] = [];

    for (const file of routeFiles(apiRoot)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const serializesException =
          /(NextResponse|Response)\.(json|redirect)\([^\n]*(error|err)\.(message|stack)/.test(line) ||
          /new (NextResponse|Response)\([^\n]*\$\{(error|err)\.(message|stack)\}/.test(line) ||
          /(message|details|error):\s*(error|err)(\.(message|stack))?\b/.test(line);

        if (serializesException) {
          disclosures.push(`${relative(apiRoot, file)}:${index + 1}`);
        }
      });
    }

    expect(disclosures).toEqual([]);
  });

  it('ERROR-T002 preserves only fixed client-safe messages for unexpected 500 responses', () => {
    const apiRoot = resolve('src/app/api');
    const source = routeFiles(apiRoot).map((file) => readFileSync(file, 'utf8')).join('\n');
    const helper = readFileSync(resolve('src/lib/server-errors.ts'), 'utf8');

    expect(source.match(/unexpectedErrorResponse\(/g)).toHaveLength(16);
    expect(helper.match(/message: 'An unexpected error occurred'/g)).toHaveLength(1);
    expect(source).not.toContain('Error loading document PDF: ${error.message}');
  });
});
