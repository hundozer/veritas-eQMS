-- Add least-privilege access to each user's own tenant-scoped notifications.
-- This self-service permission applies to approved tenant role families only.
BEGIN;

INSERT INTO "IamPermission" ("id", "name", "description")
VALUES (
  'veritas.permission.notification.read_own',
  'notification.read_own',
  'Read the current user''s tenant-scoped notifications'
)
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description";

WITH approved_roles AS (
  SELECT "id"
  FROM "IamRole"
  WHERE UPPER(REGEXP_REPLACE(TRIM("name"), '[[:space:]-]+', '_', 'g')) IN (
    'TENANT_ADMIN', 'ADMIN', 'OWNER', 'ORGANIZATION_OWNER',
    'QUALITY_MANAGER', 'DOCUMENT_OWNER', 'APPROVER', 'EMPLOYEE',
    'AUDITOR', 'EXTERNAL_AUDITOR'
  )
)
INSERT INTO "IamRolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM approved_roles AS role
CROSS JOIN "IamPermission" AS permission
WHERE permission."name" = 'notification.read_own'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
