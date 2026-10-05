-- Add least-privilege recovery access to tenant audit-plan summaries. Audit
-- scheduling and lifecycle mutations remain disabled.
BEGIN;

INSERT INTO "IamPermission" ("id", "name", "description")
VALUES (
  'veritas.permission.audit_plan.read',
  'audit_plan.read',
  'Read minimized tenant-scoped audit-plan summaries'
)
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description";

WITH approved_roles AS (
  SELECT "id"
  FROM "IamRole"
  WHERE UPPER(REGEXP_REPLACE(TRIM("name"), '[[:space:]-]+', '_', 'g'))
    IN ('QUALITY_MANAGER', 'AUDITOR', 'EXTERNAL_AUDITOR')
)
INSERT INTO "IamRolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM approved_roles AS role
CROSS JOIN "IamPermission" AS permission
WHERE permission."name" = 'audit_plan.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
