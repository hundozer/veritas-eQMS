# IAM Permission Migration Runbook

Status: execution pending
Migrations: `20260824130000_seed_canonical_iam_permissions`, `20260824140000_add_equipment_read_permission`, `20260824150000_add_supplier_read_permission`, `20260824160000_add_notification_read_own_permission`, and `20260824170000_add_audit_plan_read_permission`

## Preconditions

1. Resolve and verify the PostgreSQL baseline status described in `prisma/README.md`; never apply the baseline to the existing database as a new migration.
2. Use a disposable PostgreSQL database to execute the complete active migration lineage and run the repository test/build gate.
3. Export an inventory of `IamRole`, `IamPermission`, `IamRolePermission`, active memberships, and active sessions from the target environment. Store it as controlled release evidence with restricted access.
4. Confirm each role intended for automatic mapping has an approved normalized identity: tenant administrator/administrator/owner/organization owner, quality manager, document owner, approver, employee, auditor/external auditor.
5. Stop if an intended role is ambiguous, duplicated unexpectedly, or uses an unrecognized name. Do not rename or infer it during deployment.
6. Obtain product/security/quality approval for the canonical P0 assignments and additive equipment, supplier, notification, and audit-plan read permissions. Confirm `PLATFORM_ADMIN` receives no tenant permission through these migrations.
7. Take and verify a recoverable database backup or provider point-in-time recovery position.

## Execution and verification

1. Deploy the application and data migration through the approved release mechanism. The migration encloses its changes in one PostgreSQL transaction.
2. Verify exactly 33 canonical permission names exist and are unique: the 29 P0 namespace keys plus equipment, supplier, own-notification, and audit-plan recovery reads.
3. For each mapped role, compare canonical assignments to the approved matrix. The migration is additive: separately identify and review pre-existing noncanonical assignments rather than assuming they were removed.
4. Confirm unknown/custom roles received no automatic assignment.
5. Confirm platform-administrator roles received no assignment.
6. Start fresh sessions for test identities in every mapped role; existing sessions reload permissions on each validated request, but fresh-session testing avoids stale client assumptions.
7. Execute positive and negative checks for users, documents, training, change, nonconformance, CAPA, audit, equipment, supplier, and notification routes, including missing-permission and cross-tenant identifiers. Verify notification reads require both the current operational user ID and tenant ID.
8. Record migration output, row counts, role/permission comparison, test evidence, deviations, approvals, and release decision.

## Failure and rollback

- A SQL error before `COMMIT` must roll back the whole migration transaction.
- If post-deployment verification fails, stop traffic/promotion and follow the approved database recovery procedure. Do not improvise deletion of permission rows because assignments or later records may reference them.
- Rolling application code back to the static role-name implementation is prohibited as a security workaround. Restore the last approved application/database release pair or correct the migration under change control.
- Preserve evidence needed for incident assessment without exporting credentials, session tokens, regulated records, or unnecessary personal data.

## Known limitation

This migration does not remove pre-existing permissions or role assignments. That avoids destructive assumptions about customer-defined roles, but requires an explicit excess-assignment review before release and before any future route begins checking a newly introduced permission key.

## Target-specific recovery disposition (2026-08-25)

The read-only target inventory found one active membership on the system role `System Administrator`, which has four legacy uppercase grants and is intentionally outside every canonical alias. Do not broaden that role. Follow `TARGET-DATABASE-CHANGE-PLAN-2026-08-25.md`: obtain owner attestation, reassign the membership to an existing least-privileged recognized tenant role in a separate reviewed transaction, and revoke sessions. The target migration and membership change remain unauthorized until backup restore and protected-preview gates pass.
