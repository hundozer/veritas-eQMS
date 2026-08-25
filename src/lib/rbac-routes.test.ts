import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routeContracts: Record<string, string[]> = {
  'src/app/api/users/route.ts': ['users.read'],
  'src/app/api/documents/route.ts': ['documents.read', 'documents.create'],
  'src/app/api/documents/[id]/route.ts': ['documents.read', 'documents.update_draft', 'documents.obsolete'],
  'src/app/api/documents/[id]/approve/route.ts': ['documents.approve'],
  'src/app/api/trainings/route.ts': ['training.read_own', 'training.read_all'],
  'src/app/api/audit/route.ts': ['audit.read'],
  'src/app/api/equipment/route.ts': ['equipment.read'],
  'src/app/api/equipment/[id]/route.ts': ['equipment.read'],
  'src/app/api/suppliers/route.ts': ['supplier.read'],
  'src/app/api/suppliers/[id]/route.ts': ['supplier.read'],
  'src/app/api/notifications/route.ts': ['notification.read_own'],
  'src/app/api/audits/route.ts': ['audit_plan.read'],
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
