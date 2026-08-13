import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routeContracts: Record<string, string[]> = {
  'src/app/api/users/route.ts': ['users.read', 'users.create'],
  'src/app/api/users/[id]/route.ts': ['users.update', 'users.deactivate'],
  'src/app/api/documents/route.ts': ['documents.read', 'documents.create'],
  'src/app/api/documents/[id]/route.ts': ['documents.read', 'documents.update_draft', 'documents.obsolete'],
  'src/app/api/documents/[id]/approve/route.ts': ['documents.approve'],
  'src/app/api/trainings/route.ts': ['training.read_own', 'training.read_all', 'training.complete_own'],
  'src/app/api/change-requests/route.ts': ['change.read', 'change.create'],
  'src/app/api/change-requests/[id]/approve/route.ts': ['change.approve'],
  'src/app/api/deviations/route.ts': ['nonconformance.read', 'nonconformance.create'],
  'src/app/api/deviations/[id]/route.ts': ['nonconformance.read', 'nonconformance.investigate', 'nonconformance.close'],
  'src/app/api/capas/route.ts': ['capa.read', 'capa.create'],
  'src/app/api/capas/[id]/route.ts': ['capa.update', 'capa.approve_close'],
  'src/app/api/audit/route.ts': ['audit.read'],
  'src/app/api/audit/export/route.ts': ['audit.export'],
  'src/app/api/reports/export/route.ts': ['audit.export'],
};

describe('P0 route authorization contracts', () => {
  for (const [file, permissions] of Object.entries(routeContracts)) {
    it(`${file} enforces its central permissions`, () => {
      const source = readFileSync(resolve(file), 'utf8');
      expect(source).toContain('getContext(req)');
      expect(source).toContain("code: 'Unauthorized'");
      expect(source).toContain("code: 'Forbidden'");
      expect(source).not.toMatch(/(?:user|adminUser)\.role\s*[!=]==?/);
      for (const permission of permissions) expect(source).toContain(permission);
    });
  }
});
