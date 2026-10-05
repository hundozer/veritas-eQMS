# Phase 1.2 Self-Audit — Reproducible Build and Disposable Migration Lineage

Date: 2026-08-25

## Scope and outcome

Repair the Prisma package-install boundary and verify the full active migration lineage on isolated local PostgreSQL without contacting a target or production resource.

## Changes

- Made `prisma.config.ts` conditionally configure the classic schema engine only when `DATABASE_URL` is non-empty.
- Added a static regression contract for generation/build configuration behavior.
- Retained `src/lib/db.ts` fail-closed behavior when application build/runtime lacks database configuration.
- Added controlled disposable-database evidence and traceability.

## Self-audit

- **Security:** no target credential or secret value was read or used. The successful build URL pointed to unreachable localhost; the database used trust only inside a temporary localhost-bound cluster.
- **Data integrity:** all migrations applied once, a second deploy was idempotent, status was current, and schema drift was zero.
- **IAM:** zero assignments on a clean database is expected and prevents inferred grants. Target roles/assignments require the next read-only inventory phase.
- **Availability:** the Vercel install failure cause is removed without masking missing runtime database configuration.
- **Scope:** no cloud database, Vercel environment, deployment, domain, production data, or external storage was changed.
- **Cost:** used installed local PostgreSQL; no Docker image, cloud branch, integration, or paid resource was created.

## Verification evidence

- Credential-empty Prisma generation: **passed**.
- Missing-database application build: **failed closed as intended**.
- Unreachable-localhost configured production build: **passed**, 38 static pages.
- Disposable PostgreSQL migration/deploy/status/drift gate: **passed**, 12 migrations, 43 tables, 33 permissions, 0 inferred assignments.
- Focused build and IAM migration contracts: **17 passed** in 6 files.
- TypeScript and diff whitespace checks: **passed**.
- Full repository suite: **300 passed** in **54 files**.
- Prisma schema validation and TypeScript compilation: **passed**.
- ESLint: **passed with 0 errors and 3 pre-existing warnings** (`AppShell` image usage and two unused suppression comments in `ModalProvider`).
- Final diff whitespace check: **passed**.

## Decision and residual risk

- Decision: `DEC-044`; updated risk: `RISK-032`.
- Next phase: read-only target database baseline, migration, IAM role/assignment, and session inventory under a least-privilege connection. No target migration execution is authorized.

Closure status: **closed for reproducible generation/build configuration and disposable migration-lineage verification**. Production remains **NO-GO**.
