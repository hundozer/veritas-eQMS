-- Seed the canonical Veritas tenant permission namespace. This migration is
-- additive and idempotent: it neither creates roles nor removes customer data.
BEGIN;

INSERT INTO "IamPermission" ("id", "name", "description") VALUES
  ('veritas.permission.users.read', 'users.read', 'Canonical Veritas permission: users.read'),
  ('veritas.permission.users.create', 'users.create', 'Canonical Veritas permission: users.create'),
  ('veritas.permission.users.update', 'users.update', 'Canonical Veritas permission: users.update'),
  ('veritas.permission.users.deactivate', 'users.deactivate', 'Canonical Veritas permission: users.deactivate'),
  ('veritas.permission.documents.read', 'documents.read', 'Canonical Veritas permission: documents.read'),
  ('veritas.permission.documents.create', 'documents.create', 'Canonical Veritas permission: documents.create'),
  ('veritas.permission.documents.update_draft', 'documents.update_draft', 'Canonical Veritas permission: documents.update_draft'),
  ('veritas.permission.documents.submit_review', 'documents.submit_review', 'Canonical Veritas permission: documents.submit_review'),
  ('veritas.permission.documents.review', 'documents.review', 'Canonical Veritas permission: documents.review'),
  ('veritas.permission.documents.approve', 'documents.approve', 'Canonical Veritas permission: documents.approve'),
  ('veritas.permission.documents.obsolete', 'documents.obsolete', 'Canonical Veritas permission: documents.obsolete'),
  ('veritas.permission.training.read_own', 'training.read_own', 'Canonical Veritas permission: training.read_own'),
  ('veritas.permission.training.complete_own', 'training.complete_own', 'Canonical Veritas permission: training.complete_own'),
  ('veritas.permission.training.read_all', 'training.read_all', 'Canonical Veritas permission: training.read_all'),
  ('veritas.permission.training.assign', 'training.assign', 'Canonical Veritas permission: training.assign'),
  ('veritas.permission.change.read', 'change.read', 'Canonical Veritas permission: change.read'),
  ('veritas.permission.change.create', 'change.create', 'Canonical Veritas permission: change.create'),
  ('veritas.permission.change.review', 'change.review', 'Canonical Veritas permission: change.review'),
  ('veritas.permission.change.approve', 'change.approve', 'Canonical Veritas permission: change.approve'),
  ('veritas.permission.nonconformance.read', 'nonconformance.read', 'Canonical Veritas permission: nonconformance.read'),
  ('veritas.permission.nonconformance.create', 'nonconformance.create', 'Canonical Veritas permission: nonconformance.create'),
  ('veritas.permission.nonconformance.investigate', 'nonconformance.investigate', 'Canonical Veritas permission: nonconformance.investigate'),
  ('veritas.permission.nonconformance.close', 'nonconformance.close', 'Canonical Veritas permission: nonconformance.close'),
  ('veritas.permission.capa.read', 'capa.read', 'Canonical Veritas permission: capa.read'),
  ('veritas.permission.capa.create', 'capa.create', 'Canonical Veritas permission: capa.create'),
  ('veritas.permission.capa.update', 'capa.update', 'Canonical Veritas permission: capa.update'),
  ('veritas.permission.capa.approve_close', 'capa.approve_close', 'Canonical Veritas permission: capa.approve_close'),
  ('veritas.permission.audit.read', 'audit.read', 'Canonical Veritas permission: audit.read'),
  ('veritas.permission.audit.export', 'audit.export', 'Canonical Veritas permission: audit.export')
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description";

WITH normalized_roles AS (
  SELECT
    "id",
    CASE
      WHEN UPPER(REGEXP_REPLACE(TRIM("name"), '[[:space:]-]+', '_', 'g'))
        IN ('TENANT_ADMIN', 'ADMIN', 'OWNER', 'ORGANIZATION_OWNER') THEN 'TENANT_ADMIN'
      WHEN UPPER(REGEXP_REPLACE(TRIM("name"), '[[:space:]-]+', '_', 'g')) = 'QUALITY_MANAGER' THEN 'QUALITY_MANAGER'
      WHEN UPPER(REGEXP_REPLACE(TRIM("name"), '[[:space:]-]+', '_', 'g')) = 'DOCUMENT_OWNER' THEN 'DOCUMENT_OWNER'
      WHEN UPPER(REGEXP_REPLACE(TRIM("name"), '[[:space:]-]+', '_', 'g')) = 'APPROVER' THEN 'APPROVER'
      WHEN UPPER(REGEXP_REPLACE(TRIM("name"), '[[:space:]-]+', '_', 'g')) = 'EMPLOYEE' THEN 'EMPLOYEE'
      WHEN UPPER(REGEXP_REPLACE(TRIM("name"), '[[:space:]-]+', '_', 'g')) IN ('AUDITOR', 'EXTERNAL_AUDITOR') THEN 'AUDITOR'
      ELSE NULL
    END AS role_key
  FROM "IamRole"
), canonical_role_permissions (role_key, permission_names) AS (
  VALUES
    ('TENANT_ADMIN', ARRAY[
      'users.read', 'users.create', 'users.update', 'users.deactivate',
      'documents.read', 'audit.read', 'audit.export'
    ]::TEXT[]),
    ('QUALITY_MANAGER', ARRAY[
      'users.read',
      'documents.read', 'documents.create', 'documents.update_draft', 'documents.submit_review',
      'documents.review', 'documents.approve', 'documents.obsolete',
      'training.read_own', 'training.complete_own', 'training.read_all', 'training.assign',
      'change.read', 'change.create', 'change.review', 'change.approve',
      'nonconformance.read', 'nonconformance.create', 'nonconformance.investigate', 'nonconformance.close',
      'capa.read', 'capa.create', 'capa.update', 'capa.approve_close',
      'audit.read', 'audit.export'
    ]::TEXT[]),
    ('DOCUMENT_OWNER', ARRAY[
      'documents.read', 'documents.create', 'documents.update_draft', 'documents.submit_review',
      'training.read_own', 'training.complete_own',
      'change.read', 'change.create', 'nonconformance.read', 'nonconformance.create',
      'capa.read', 'capa.create'
    ]::TEXT[]),
    ('APPROVER', ARRAY[
      'documents.read', 'documents.review', 'documents.approve',
      'training.read_own', 'training.complete_own',
      'change.read', 'change.review', 'change.approve',
      'nonconformance.read', 'nonconformance.close',
      'capa.read', 'capa.approve_close', 'audit.read'
    ]::TEXT[]),
    ('EMPLOYEE', ARRAY[
      'documents.read', 'training.read_own', 'training.complete_own',
      'change.read', 'nonconformance.read', 'nonconformance.create', 'capa.read'
    ]::TEXT[]),
    ('AUDITOR', ARRAY[
      'users.read', 'documents.read', 'training.read_all', 'change.read',
      'nonconformance.read', 'capa.read', 'audit.read', 'audit.export'
    ]::TEXT[])
)
INSERT INTO "IamRolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM normalized_roles AS role
JOIN canonical_role_permissions AS canonical ON canonical.role_key = role.role_key
CROSS JOIN LATERAL UNNEST(canonical.permission_names) AS assigned(permission_name)
JOIN "IamPermission" AS permission ON permission."name" = assigned.permission_name
WHERE role.role_key IS NOT NULL
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

COMMIT;
