-- Phase 1: release authority (DEC-064). Adds documents.release and grants it to
-- Quality Manager roles only. Additive and idempotent; no role is created.

INSERT INTO "IamPermission" ("id", "name", "description") VALUES
  ('veritas.permission.documents.release', 'documents.release', 'Canonical Veritas permission: documents.release')
ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "IamRolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "IamRole" r
JOIN "IamPermission" p ON p."name" = 'documents.release'
WHERE UPPER(REGEXP_REPLACE(TRIM(r."name"), '[[:space:]-]+', '_', 'g')) = 'QUALITY_MANAGER'
ON CONFLICT DO NOTHING;
