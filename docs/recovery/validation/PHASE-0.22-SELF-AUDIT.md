# Phase 0.22 Self-Audit — Notification Self-Read Authorization

Date: 2026-08-24

## Scope and intended outcome

Migrate notification listing from authentication-only access to canonical persisted `notification.read_own`, while retaining self-service availability for all approved tenant role families and enforcing user-and-tenant data isolation.

## Change review

- Added an atomic, idempotent migration for `notification.read_own`.
- Assigned the permission to the six approved tenant role families and their established aliases; platform and unknown roles receive no assignment.
- Added the permission check immediately after authentication and before notification data access.
- Strengthened the query from user-only to combined authenticated user-and-tenant scope.
- Preserved newest-first ordering and the 20-record response bound.
- Added behavioral, migration, and repository route-contract tests.
- Updated the authorization matrix, migration runbook, decision log, and risk register.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Authorization:** only persisted `notification.read_own` grants runtime access; the membership role name does not.
- **Failure ordering:** missing identity returns `401`, and missing permission returns `403`, before notification database access.
- **Least privilege:** this is an own-record self-service permission available to the six approved tenant-role families. Global IAM role records mean the migration affects every membership using a mapped role after execution.
- **Tenant isolation:** the database predicate requires both `userId` and `tenantId` from the validated context; neither value comes from the client.
- **Data minimization:** the route remains limited to the 20 newest records. No write or state transition occurs.
- **Content risk:** notification titles, messages, and links can reveal personal or regulated workflow context. This phase controls access but does not validate content generation, link authorization, retention, or deletion.
- **Auditability:** routine own-notification reads do not create audit events. Whether particular notification categories require access evidence remains an intended-use and risk decision.
- **UI:** no UI changed. A client that receives `403` may need a permission-aware empty/error state in a later UI phase.
- **Legal/GxP:** this implementation is an access-control improvement, not evidence of compliance. Privacy notice, retention, data-subject handling, validation, deployment, and independent approval remain required.

## Verification evidence

- Focused notification route, migration, and route-contract tests: **26 passed** in three test files.
- Focused Prisma schema validation: **passed**.
- Focused TypeScript validation: **passed**.
- Full Vitest suite: **255 passed** in 35 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Permission and platform-role scope scans: **passed**; the route and migration contain `notification.read_own`, and the migration does not map `PLATFORM_ADMIN`.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; the route adds only persisted authorization and stronger tenancy scope, the migration is additive, and no external database migration was executed.

## Traceability

- Decision: `DEC-026`.
- Risks: `RISK-013` and `RISK-019`.
- Requirement/matrix: `notification.read_own` and `/api/notifications` in `API-AUTHORIZATION-MATRIX.md`.
- Tests: `NOTIFICATION-T001` through `NOTIFICATION-T003`, `NOTIFICATION-PERM-T001` through `NOTIFICATION-PERM-T003`, and the central route authorization contract.

## Residual risk and closure judgment

- The notification permission migration has not been executed on disposable or target PostgreSQL.
- Existing pre-created assignments are additive/not removed and require target review.
- Notification producers, content classification, destination-link authorization, retention/deletion, and UI denial behavior require separate review.
- Historical/deployed code and data access require separate verification.

Closure status: **closed for repository notification self-read authorization**. Deployment remains pending controlled migration execution and evidence.
