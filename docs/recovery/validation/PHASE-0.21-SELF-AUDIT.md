# Phase 0.21 Self-Audit — Supplier Read Authorization Migration

Date: 2026-08-24

## Scope and intended outcome

Migrate supplier list and detail reads from authentication-only access to canonical persisted `supplier.read`, while preserving fail-closed supplier mutations and tenant isolation. Supplier management remains outside the narrowed product scope and is retained only for controlled recovery access.

## Change review

- Added an atomic, idempotent migration for `supplier.read`.
- Assigned the permission only to normalized Quality Manager, Auditor, and External Auditor roles.
- Explicitly excluded tenant administrators/owners, platform administrators, employees, approvers, and document owners.
- Added permission checks to both supplier GET routes immediately after authentication and before parameters/data access.
- Kept list lookup tenant-scoped.
- Replaced detail `findUnique` plus post-load tenant comparison with one `findFirst({ id, tenantId })` predicate.
- Corrected detail read-audit attribution from operational `User.role` to membership role.
- Reused the correlated, non-cacheable unexpected-error response for supplier list failure and updated its pinned inventory to 34.
- Kept supplier registration, attachment mutation, audit/e-signature, and receipt mutations disabled.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Authorization:** only persisted `supplier.read` grants route access; role names do not grant at runtime.
- **Least privilege:** recovery access is limited to quality/audit roles. Because IAM roles are global, the migration affects all memberships using mapped roles after execution.
- **Tenant isolation:** list/detail queries include the authenticated tenant. Foreign IDs return the same `404` as missing records without loading foreign data.
- **Failure ordering:** `401` and `403` occur before supplier parameters or database access.
- **Data integrity:** supplier GET routes do not mutate records. All supplier mutation methods remain disabled.
- **Auditability:** successful detail access uses membership-role attribution. Read audit remains best-effort and is not authoritative regulated audit evidence.
- **UI:** no UI changed; role-based visibility may not match persisted permission denial and requires later cleanup.
- **Legal/GxP:** supplier qualification and receipt histories may be regulated records; migration execution, access approval, and validation require independent review.

## Verification evidence

- Focused supplier/equipment route, migration, route-contract, and error-contract tests: **42 passed** in four test files.
- Prisma schema validation: **passed**.
- TypeScript after focused changes: **passed**.
- Full Vitest suite: **248 passed** in 33 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Route permission scan: **passed**; both supplier GET routes contain `supplier.read` enforcement.
- Migration role-scope scan: **passed**; no tenant-admin/owner, platform-admin, employee, approver, or document-owner assignment exists.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; supplier mutations remain disabled, reads add only authorization/tenant hardening and audit attribution correction, and no external migration was executed.

## Traceability

- Decision: `DEC-025`.
- Risks: `RISK-013` and `RISK-015`.
- Requirement/matrix: `supplier.read` and both supplier rows in `API-AUTHORIZATION-MATRIX.md`.
- Tests: `SUPPLIER-T001` through `SUPPLIER-T004`, `SUPPLIER-PERM-T001` through `SUPPLIER-PERM-T003`, route authorization, and error containment contracts.

## Residual risk and closure judgment

- The supplier permission migration has not been executed on disposable or target PostgreSQL.
- Existing pre-created `supplier.read` assignments are additive/not removed and require target review.
- Supplier registration, updates, attachments, audits/e-signatures, receipts, and related deviation transactions remain unavailable pending separate permissions, atomic audit, reauthentication where applicable, and validation.
- Whether supplier read access needs mandatory audit evidence remains an intended-use/risk decision.
- UI visibility and error presentation are not permission-driven.
- Historical/deployed code and data access require separate verification.

Closure status: **closed for repository supplier read authorization**. Deployment remains pending controlled migration execution and evidence.
