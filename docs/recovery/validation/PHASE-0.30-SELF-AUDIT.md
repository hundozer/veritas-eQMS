# Phase 0.30 Self-Audit — Deviation and CAPA Containment

Date: 2026-08-24

## Outcome

All deviation and CAPA API methods now return a shared non-cacheable `503 QualityEventsDisabled` before accepting input or reaching identity, data, automation, or audit dependencies. Navigation, automatic loading, quality analytics, the numeric CAPA dashboard assertion, and interactive dashboard panels were withdrawn.

## Architecture, security, UI, legal, and GxP review

- Deviation and CAPA carry tenant IDs, but related users, deviations, and equipment are ordinary ID relations rather than database-enforced same-tenant relations.
- Investigator and CAPA deviation assignment were not tenant-validated; arbitrary lifecycle values were accepted; closure controls were incomplete.
- Deviation creation committed before invoking an automatic mapping/CAPA stub, preventing atomic regulated evidence.
- Full relation includes exposed excessive user and linked-record data and could expose historically malformed relationships.
- Containment prevents new disclosure, mutation, and misleading signature/audit evidence; it does not validate historical quality records or establish a compliant deviation/CAPA system.
- Dormant unreachable client workflow code remains decomposition debt and is not a security boundary.

## Verification evidence

- Focused quality-event, e-signature, authorization, audit-contract, and error tests: **26 passed** in five files.
- Focused TypeScript and Prisma validation: **passed**.
- Full Vitest suite: **276 passed** in 48 test files.
- Final Prisma schema validation and TypeScript validation: **passed**.
- ESLint: **0 errors and 3 pre-existing warnings**.
- Production build: **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and 38 static pages.
- Route dependency, navigation, automatic-load, analytics, and whitespace scans: **passed**.
- Manual scope review: **passed**; all seven methods fail before processing and no database migration or external system was changed.

## Traceability and residual risk

- Decision: `DEC-034`; risk: `RISK-027`; authorization matrix: deviation and CAPA entries.
- Re-enable only after historical integrity review, tenant-composite relations, controlled lifecycle/SoD, IAM reauthentication, atomic audit/automation, minimized reads, privacy/retention approval, migration evidence, and validation.

Closure status: **closed for repository deviation/CAPA containment**. Historical integrity review and redesign remain pending.
