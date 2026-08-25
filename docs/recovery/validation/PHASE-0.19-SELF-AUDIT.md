# Phase 0.19 Self-Audit — Canonical P0 Permission Data Migration

Date: 2026-08-24

## Scope and intended outcome

Provide the idempotent persisted permission and role-assignment migration required by the Phase 0.18 runtime authorization foundation. Do not execute it against an external database in this repository step.

## Change review

- Added a PostgreSQL migration that seeds the exact 29-name canonical P0 namespace.
- Used deterministic text IDs because the database permission ID column has no SQL-side UUID default.
- Added exact assignments for six approved tenant-role families: tenant administrator, quality manager, document owner, approver, employee, and auditor.
- Recognized controlled aliases including `Organization Owner` and `External Auditor` after whitespace/hyphen normalization.
- Explicitly excluded platform administrators and all unknown/custom roles.
- Used name and composite-key conflict handling for repeat-safe seeding/assignment.
- Wrapped the migration in an explicit transaction.
- Kept the migration additive: it does not create roles or delete permissions/assignments.
- Added SQL contract tests comparing all 29 permissions and all 73 assignments against the approved code matrix.
- Added a deployment runbook covering baseline resolution, inventory, approvals, backup, execution, negative testing, evidence, failure, and rollback.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Architecture:** database assignments now have a repository migration aligned with the runtime permission authority. The older UI permission vocabulary is deliberately not seeded.
- **Least privilege:** automatic grants are limited to the previously approved P0 role matrix. `PLATFORM_ADMIN` receives no tenant grant.
- **Custom roles:** unknown roles receive nothing automatically. This fails closed and requires explicit review rather than name inference.
- **Existing data:** the migration does not remove pre-existing excess/noncanonical assignments. A target-environment excess-assignment review is mandatory before release.
- **Atomicity/idempotency:** seed and assignment statements run in one transaction and tolerate repeated existing names/links.
- **Tenancy:** roles are global in the current schema; assignments affect every membership using a mapped role. Target role inventory and approval are therefore release-critical.
- **UI:** no UI changed.
- **Legal/GxP:** role design, grant approval, deployment evidence, periodic access review, and validation remain organizational controls requiring independent approval.

## Verification evidence

- Focused migration/session/RBAC tests: **32 passed** in three test files.
- Focused migration contract after exact-assignment strengthening: **3 passed**.
- Prisma schema validation: **passed**.
- TypeScript after focused changes: **passed**.
- Full Vitest suite: **226 passed** in 31 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Migration safety scan: **passed**; no platform-admin grant, role creation, deletion, or table drop exists.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; SQL is limited to canonical permission upsert and approved assignment insertion, the runbook warns against baseline misuse, and no external database command was run.

## Traceability

- Decision: `DEC-023`.
- Risk: `RISK-013`.
- Requirements: authorization migration gate 2 and `IAM-PERMISSION-MIGRATION-RUNBOOK.md`.
- Tests: `IAM-PERM-T001` through `IAM-PERM-T003`.

## Residual risk and closure judgment

- The SQL has not been executed against disposable or target PostgreSQL in this phase; repository contracts do not replace execution evidence.
- Prisma baseline resolution for the existing database remains a prerequisite.
- Existing extra assignments are not removed and must be reviewed.
- Deterministic permission IDs are intentionally non-UUID text; downstream code must continue treating IDs as opaque.
- Global roles can affect multiple tenants simultaneously; per-tenant custom-role architecture remains unresolved.
- New `audit_plan`, `equipment`, `supplier`, `intelligence`, and notification permissions are not part of this P0 migration and must be introduced only with their route phases.

Closure status: **closed for the repository migration artifact and execution runbook**. Deployment authorization remains blocked until the runbook is executed and approved evidence exists.
