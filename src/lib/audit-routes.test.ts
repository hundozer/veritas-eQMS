import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mandatoryFamilies = [
  ['users', ['src/app/api/users/route.ts', 'src/app/api/users/[id]/route.ts']],
  ['documents', ['src/app/api/documents/route.ts', 'src/app/api/documents/[id]/route.ts', 'src/app/api/documents/[id]/approve/route.ts']],
  ['training', ['src/app/api/trainings/route.ts']],
  ['change control', ['src/app/api/change-requests/route.ts', 'src/app/api/change-requests/[id]/approve/route.ts']],
  ['nonconformance', ['src/app/api/deviations/route.ts', 'src/app/api/deviations/[id]/route.ts']],
  ['CAPA', ['src/app/api/capas/route.ts', 'src/app/api/capas/[id]/route.ts']],
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
