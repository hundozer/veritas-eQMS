import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mandatoryFamilies = [
  ['documents', ['src/app/api/documents/route.ts', 'src/app/api/documents/[id]/route.ts', 'src/app/api/documents/[id]/approve/route.ts']],
] as const;

describe('mandatory route-family audit transaction contracts', () => {
  for (const [family, files] of mandatoryFamilies) {
    it(`${family} mutations use transaction-coupled mandatory audit writes`, () => {
      const source = files.map((file) => readFileSync(resolve(file), 'utf8')).join('\n');
      expect(source).toContain('prisma.$transaction');
      expect(source).toContain('writeMandatoryAudit(tx');
    });
  }
});
