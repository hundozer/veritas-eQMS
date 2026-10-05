# Phase 0.20 Self-Audit — Equipment Read Authorization Migration

Date: 2026-08-24

## Scope and intended outcome

Migrate equipment list and detail reads from authentication-only access to canonical persisted `equipment.read`, while preserving fail-closed mutations and tenant isolation. Equipment remains outside the narrowed product scope and is retained only for controlled recovery access.

## Change review

- Added an atomic, idempotent migration for `equipment.read`.
- Assigned the permission only to normalized Quality Manager, Auditor, and External Auditor roles.
- Explicitly excluded tenant administrators/owners, platform administrators, employees, approvers, and document owners.
- Added permission checks to both equipment GET routes immediately after authentication and before parameters/data access.
- Kept list lookup tenant-scoped.
- Replaced detail `findUnique` plus post-load tenant comparison with one `findFirst({ id, tenantId })` predicate.
- Corrected detail read-audit attribution from operational `User.role` to the membership role.
- Reused the correlated, non-cacheable unexpected-error response for list failures.
- Kept equipment POST and maintenance/e-signature mutations disabled.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Authorization:** only persisted `equipment.read` grants access; role names in context do not grant at runtime.
- **Least privilege:** recovery access is limited to quality/audit roles. The global-role schema means the assignment affects all memberships using those roles after migration execution.
- **Tenant isolation:** list and detail queries include the authenticated tenant. A foreign ID yields the same `404` as a missing record without first loading foreign data.
- **Failure ordering:** unauthenticated requests receive `401`; missing permission receives `403`; both occur before equipment database access.
- **Data integrity:** GET remains read-only and does not update equipment, create deviations, or start transactions.
- **Auditability:** successful detail access records membership-role attribution. Read logging is still best-effort and is not authoritative GxP audit evidence.
- **UI:** no UI changed; existing role-based visibility may expose controls that the server denies and requires later cleanup.
- **Legal/GxP:** equipment records may be regulated; permission design and migration execution still need independent quality/security approval and validation evidence.

## Verification evidence

- Focused equipment, permission-migration, and route-contract tests before positive detail addition: **31 passed** in three test files.
- Prisma schema validation: **passed**.
- TypeScript after focused changes: **passed**.
- Full-suite, lint, production-build, final static-scan, and diff results are recorded after the final gate below.
- Focused verification deviation: direct Vitest route imports could not resolve newly added `@/lib/rbac` imports because this repository has no Vitest alias configuration. The two route adapters were changed to explicit relative imports; the complete focused gate then passed.
- Full-suite verification deviation: the pinned unexpected-error helper inventory expected 32 paths; equipment list migration intentionally increased it to 33. The contract was updated to the reviewed count before rerunning the complete gate.
- Full Vitest suite: **237 passed** in 32 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Route permission scan: **passed**; both equipment GET routes contain `equipment.read` enforcement.
- Migration role-scope scan: **passed**; no tenant-admin/owner, platform-admin, employee, approver, or document-owner assignment exists.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; mutations remain disabled, reads add only authorization/tenant hardening and audit attribution correction, and no external migration was executed.

## Traceability

- Decision: `DEC-024`.
- Risks: `RISK-013` and `RISK-015`.
- Requirement/matrix: `equipment.read` and both equipment rows in `API-AUTHORIZATION-MATRIX.md`.
- Tests: `EQUIPMENT-T001` through `EQUIPMENT-T004`, `EQUIPMENT-PERM-T001` through `EQUIPMENT-PERM-T003`, and the route authorization contract.

## Residual risk and closure judgment

- The permission migration has not been executed on disposable or target PostgreSQL.
- Existing pre-created `equipment.read` assignments are additive/not removed and require target review.
- Equipment creation, maintenance, calibration transitions, and retirement remain unavailable pending separate permissions, transactional audit, reauthentication where applicable, and validation.
- The read audit is best-effort; whether equipment access requires mandatory audit evidence must be decided in intended-use/risk assessment.
- UI visibility and error presentation are not yet permission-driven.
- Supplier reads remain auth-only and are the next comparable migration candidate.

Closure status: **closed for repository equipment read authorization**. Deployment remains pending controlled migration execution and evidence.
