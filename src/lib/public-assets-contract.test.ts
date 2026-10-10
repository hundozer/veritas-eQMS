import { existsSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicRoot = resolve('public');
const prohibitedExtensions = new Set([
  '.csv', '.doc', '.docx', '.json', '.pdf', '.rtf', '.txt', '.xls', '.xlsx', '.xml', '.zip',
]);

function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

describe('public asset boundary', () => {
  it('PUBLIC-ASSET-T001 contains no legacy upload directory', () => {
    expect(existsSync(join(publicRoot, 'uploads'))).toBe(false);
  });

  it('PUBLIC-ASSET-T002 contains no document, data-export, archive, or text record', () => {
    const exposedRecords = listFiles(publicRoot)
      .filter((path) => prohibitedExtensions.has(extname(path).toLowerCase()))
      .map((path) => relative(publicRoot, path));

    expect(exposedRecords).toEqual([]);
  });
});
