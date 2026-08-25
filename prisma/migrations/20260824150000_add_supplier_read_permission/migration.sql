-- Add least-privilege recovery access to supplier reads. Supplier mutations
-- remain outside the narrowed recovery scope and stay disabled.
BEGIN;

INSERT INTO "IamPermission" ("id", "name", "description")
VALUES (
  'veritas.permission.supplier.read',
  'supplier.read',
  'Read tenant-scoped supplier recovery records'
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
WHERE permission."name" = 'supplier.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
