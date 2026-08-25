# Phase 0.37 Self-Audit — Equipment and Supplier Client/Read Containment

Date: 2026-08-25

## Scope and outcome

Remove dormant equipment and supplier execution workflows from the browser and minimize the retained permission-controlled recovery reads.

## Change and control review

- Removed maintenance, supplier registration, attachment mutation, supplier-audit, and material-receipt handlers.
- Removed their form state, password/file collection, action controls, and four modal implementations.
- Retained read-only equipment and supplier history views.
- Replaced broad person relation loads with explicit projections containing only `fullName`.
- Added explicit projections to list/detail queries and `Cache-Control: no-store` to successful reads.
- Strengthened non-core regression contracts for UI absence, projection boundaries, minimized people, and private caching.

## Architecture, security, privacy, UI, and React audit

- Disabled server methods can no longer be invoked by shipped client code.
- The browser no longer collects invalid electronic-signature passwords, supplier files, audit findings, or receipt decisions for unavailable operations.
- Operational user credentials, membership data, roles, tenant data, and account metadata are no longer embedded through maintenance/auditor/inspector relations.
- Read-only histories remain available only through persisted `equipment.read` or `supplier.read` and tenant-scoped queries.
- Qualification attachment bytes remain in the supplier list response because the current read-only UI downloads them directly; moving them to a separately authorized streaming route is residual redesign work.
- No database migration or external system was executed.

## Verification evidence

- Focused TypeScript compilation and Prisma schema validation: **passed**.
- Dormant workflow, broad-relation, and diff whitespace scans: **passed**.
- Focused containment/signature suite: **22 passed** in **2 files**.
- Full repository suite: **292 passed** in **52 files**.
- Prisma schema validation and TypeScript compilation: **passed**.
- ESLint: **passed with 0 errors and 3 pre-existing warnings** (`AppShell` image usage and two unused suppression comments in `ModalProvider`).
- Production build: **passed**, including generation of **38 static pages**.
- Final dormant-workflow, broad-relation, and diff whitespace scans: **passed**.

## Traceability and residual risk

- Decision: `DEC-041`; updated risk: `RISK-015`; prior server decisions: `DEC-014` and `DEC-015`.
- Residual work includes controlled migration/deployment evidence, historical data review, attachment streaming authorization, pagination/retention, and validated redesign of any future mutation.

Closure status: **closed**.
