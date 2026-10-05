# Target Database Read-Only Inventory

Date: 2026-08-25
Decision: `DEC-045`
Mode: aggregate-only PostgreSQL inventory with startup-enforced read-only access

## Safety boundary

- Used the configured target database only; no production application, deployment, domain, storage, or environment setting was changed.
- Derived the unpooled endpoint locally because the Neon pooler rejects PostgreSQL's `default_transaction_read_only` startup parameter.
- PostgreSQL confirmed `transaction_read_only=on` before inventory queries.
- Used 10-second statement and 2-second lock timeouts and wrapped the inventory in `BEGIN READ ONLY` followed by `ROLLBACK`.
- Queried counts and migration metadata only. No email, name, token, document, payload, tenant identifier, record identifier, hostname, or credential was selected or retained.
- Did not run `prisma migrate status` or any migration command against the target.

## Structural and migration baseline

- PostgreSQL major version: **18**.
- Public tables: **43**; IAM tables: **10**.
- Prisma migration table exists.
- Registered migrations: **6 applied**, **0 failed**, **0 rolled back**.
- Latest registered migration: `20260813224500_add_controlled_record_storage`.
- Repository lineage contains **12** migrations. The target is therefore **6 migrations behind**:
  - `20260814060000_add_document_lifecycle`
  - `20260824130000_seed_canonical_iam_permissions`
  - `20260824140000_add_equipment_read_permission`
  - `20260824150000_add_supplier_read_permission`
  - `20260824160000_add_notification_read_own_permission`
  - `20260824170000_add_audit_plan_read_permission`

This inventory does not authorize applying them. A recoverable backup/branch, exact SQL review, IAM mapping approval, and controlled execution/rollback gate are required first.

## IAM aggregate baseline

- IAM users: **1** total / **1 active**.
- Organizations: **1**.
- Memberships: **1** total / **1 active**.
- Roles: **8** total / **4 recognized by the canonical role-family mapping**.
- Permissions: **9** total / **0 of 33 canonical recovery permissions present**.
- Existing role-permission rows: **32**.
- Sessions: **0** total / **0 live**.
- Live credential-action tokens: **0**.
- Active memberships assigned to an unrecognized role family: **1**.

The active user's role must be explicitly classified or remapped by an authorized owner before release. The additive migration intentionally will not infer grants for it.

## Aggregate integrity checks

- Membership-to-organization tenant mismatches: **0**.
- Membership-to-operational-user tenant mismatches: **0**.
- Orphan role-permission rows: **0**.

These checks establish only the queried referential conditions. They are not a backup, full data-quality assessment, penetration test, or proof of production behavior.

## Release conclusion

Target connectivity and basic referential integrity are adequate for planning, but authorization is not release-ready. Production remains **NO-GO** until the six migrations and the active unrecognized role are handled through a reviewed, reversible database-change gate and the resulting authorization behavior is verified in a protected preview.
