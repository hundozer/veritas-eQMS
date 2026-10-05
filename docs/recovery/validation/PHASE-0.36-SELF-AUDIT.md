# Phase 0.36 Self-Audit — Quality-Event Client and Alternate-Read Containment

Date: 2026-08-25

## Scope and outcome

Remove all dormant deviation/CAPA execution and presentation code from the browser and close the equipment-read path that still exposed quality-event records.

## Change and control review

- Removed Deviation/CAPA client types, collections, selections, forms, investigation state, password state, and modal state.
- Removed create/investigate/CAPA/sign-off handlers, header branch, complete Quality Events tab, hidden dashboard panels, and four modals.
- Removed the quality-events navigation union member.
- Removed the equipment-linked deviation display and the deviation property from the client Equipment type.
- Removed deviation/detector relation includes from both equipment GET queries.
- Strengthened the quality-event containment contract to reject dormant implementation tokens and equipment relation re-exposure.

## Architecture, security, privacy, UI, and React audit

- Disabled quality-event APIs can no longer be invoked by shipped client code.
- Equipment reads no longer act as an alternate API for deviation descriptions, classifications, status, dates, or detector user records.
- Removing hidden rendered branches reduces client state, bundle code, repeated array scans, password collection, and accidental reactivation risk.
- The first focused compile found that a removed hidden dashboard block shared two structural closing tags with its parent branch; only those parent closings were restored, then TypeScript and focused tests passed.
- Equipment maintenance logs and supplier workflows remain separate containment/read-minimization candidates.
- No database or external system was modified.

## Verification evidence

- Focused quality-event and non-core containment tests: **28 passed** in two files.
- Focused TypeScript and Prisma validation: **passed**.
- Zero-reference, alternate-relation, and diff whitespace checks: **passed**.
- Full repository suite: **290 passed** in **52 files**.
- Prisma schema validation and TypeScript compilation: **passed**.
- ESLint: **passed with 0 errors and 3 pre-existing warnings** (`AppShell` image usage and two unused suppression comments in `ModalProvider`).
- Production build: **passed**, including generation of **38 static pages**.
- Final dormant-token, alternate-equipment-relation, and diff whitespace scans: **passed**.

## Traceability and residual risk

- Decision: `DEC-040`; updated risk: `RISK-027`; prior server decision: `DEC-034`.
- Residual work is historical integrity review and a future tenant-composite, validated quality-event redesign.

Closure status: **closed**.
