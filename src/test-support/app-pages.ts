import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Source of every page and component of the public and signed-in route groups,
// for the containment contracts that check what the browser bundle contains.
export function appPageSource(): string {
  const read = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return read(path);
    return entry.name.endsWith('.tsx') ? [readFileSync(path, 'utf8')] : [];
  });
  return ['src/app/(marketing)', 'src/app/(app)'].flatMap((group) => read(resolve(group))).join('\n');
}
