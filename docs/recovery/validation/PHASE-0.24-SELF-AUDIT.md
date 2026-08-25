# Phase 0.24 Self-Audit — Audit-Plan Read and Mutation Containment

Date: 2026-08-24

## Scope and intended outcome

Replace authentication-only audit-plan reads and operational-role scheduling with a least-privilege recovery read, fail-closed mutation boundary, minimized response, and truthful UI status.

## Change review

- Added an atomic, idempotent `audit_plan.read` migration for Quality Manager, Auditor, and External Auditor role identities only.
- Required persisted `audit_plan.read` immediately after authentication and before database access.
- Preserved tenant scoping and replaced full relation includes with six explicit summary fields used by the UI.
- Disabled POST scheduling with a no-argument, non-cacheable `503` before authentication, body parsing, database, transaction, or audit processing.
- Removed operational `User.role` authorization, implicit current-date scheduling, and non-atomic best-effort audit writing from the executable mutation path.
- Removed UI claims of automated audit readiness, verified Annex 11 readiness, immutable audit logging, and universal checksum verification.
- Renamed the export link from an audit-readiness report to the CAPA report it actually requests.
- Removed dormant `auditPlan.create` and `intelligence.calculate` controlled event names and reduced the unexpected-error path inventory from 33 to 32.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Authorization:** only persisted `audit_plan.read` grants the recovery read. Operational role names no longer grant either method.
- **Least privilege:** only Quality Manager/Auditor role families receive the additive permission; tenant administrators/owners, document roles, employees, platform administrators, and unknown roles do not.
- **Tenant isolation:** the query predicate uses only the validated context tenant. No client tenant value is accepted.
- **Data minimization:** responses contain `id`, `title`, `scope`, `auditType`, `status`, and `scheduledDate`; lead-auditor personal/account attributes and detailed findings/CAPA relations are excluded.
- **Mutation integrity:** audit-plan creation is unavailable until the lifecycle, allowed values, lead-auditor relationship, scheduling rules, segregation of duties, and plan-plus-audit transaction are specified and validated.
- **Auditability:** GET creates no read-audit event. Whether audit-plan access itself needs mandatory evidence is an intended-use/risk decision. POST creates neither plan nor misleading partial audit evidence.
- **UI/claims:** plans remain visible to authorized users, but the page no longer converts their presence into inspection-readiness or integrity conclusions. UI permission-aware navigation/error handling remains future work.
- **Legal/GxP:** audit plans, findings, identities, and readiness statements can be regulated records or induce customer reliance. This phase is containment, not compliance certification or legal advice.

## Verification evidence

- Focused audit-plan route, migration, UI, authorization, error, and server-event tests: **34 passed** in six test files.
- Focused TypeScript validation: **passed**.
- Focused Prisma schema validation: **passed**.
- Full Vitest suite: **267 passed** in 39 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Permission/role and UI-claim scans: **passed**; `audit_plan.read` is enforced and seeded only for approved recovery roles, while prohibited readiness/integrity claims are absent.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; GET is permission-controlled/minimized, POST is inert, the migration is additive, and no external migration was executed.

## Traceability

- Decision: `DEC-028`.
- Risks: `RISK-003`, `RISK-004`, `RISK-013`, and `RISK-021`.
- Requirement/matrix: `audit_plan.read` and `/api/audits` in `API-AUTHORIZATION-MATRIX.md`.
- Tests: `AUDIT-PLAN-T001` through `AUDIT-PLAN-T004`, `AUDIT-PLAN-PERM-T001` through `AUDIT-PLAN-PERM-T003`, `AUDIT-PLAN-UI-T001`, central route authorization, error containment, and server-event contracts.

## Residual risk and closure judgment

- The permission migration has not been executed on disposable or target PostgreSQL.
- Existing pre-created assignments remain additive/not removed and require target review.
- Historical/deployed audit-plan access, mutations, audit entries, exports, and UI claims require separate investigation.
- Audit scheduling and lifecycle management remain unavailable pending a controlled redesign and validation.
- The UI still fetches audit plans for all authenticated sessions and silently ignores `403`; permission-aware navigation and error presentation remain open.

Closure status: **closed for repository audit-plan read and mutation containment**. Deployment remains pending controlled migration execution and evidence.
