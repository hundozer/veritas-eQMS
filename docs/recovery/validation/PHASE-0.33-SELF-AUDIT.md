# Phase 0.33 Self-Audit — Document Release Containment

Date: 2026-08-25

## Scope and outcome

Prevent approved document versions from becoming effective through an authorization capability that conflates workflow approval with controlled release.

## Change and control review

- Replaced document effectiveness POST with a no-argument `503 DocumentReleaseDisabled` handler.
- The handler is non-cacheable, provides retry metadata, and cannot accept request, identity, parameter, body, database, integrity, mutation, or audit dependencies.
- Removed the Make Effective handler and button from the UI and added an explicit distinct-release-authority limitation.
- Removed the now-unreachable `document.makeEffective` server event and updated lifecycle contracts.
- Retained assigned review and approval; approval remains explicitly described as non-signature evidence and does not make a version effective.
- Retained obsolescence behind its separate persisted permission and existing tenant, transition, concurrency, reason, and transactional-audit controls.

## Architecture, security, UI, and GxP audit

- Approval and release have different meanings and must not share an undifferentiated capability.
- Re-enablement requires a distinct persisted permission plus an approved assignment/SoD model; merely renaming the existing permission is insufficient.
- Effective-date rules, scheduling, supersession, retraining triggers, reauthentication/signature meaning, and atomic evidence require validation.
- The UI no longer offers an action the server cannot safely authorize.
- This phase prevents new effectiveness records; it does not validate historical releases or establish a compliant document-release process.

## Verification evidence

- Focused release, lifecycle-route, lifecycle-contract, and error-containment tests: **16 passed** in four files.
- Focused TypeScript and Prisma validation: **passed**.
- The first focused run correctly failed one inventory assertion because the removed route used `reportServerError`, not `unexpectedErrorResponse`; the expected helper count was restored to 15 and the complete focused gate passed.
- Full Vitest suite: **283 passed** in 51 test files.
- Final Prisma schema validation and TypeScript validation: **passed**.
- ESLint: **0 errors and 3 pre-existing warnings**.
- Production build: **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and 38 static pages.
- Release dependency/UI scan and diff whitespace check: **passed**.
- Manual scope review: **passed**; no database migration or external system was changed.

## Traceability and residual risk

- Decision: `DEC-037`; risk: `RISK-030`; API matrix: document effectiveness entry.
- Residual work: historical release review, distinct permission and assignment, SoD, effective-date policy, supersession/retraining, reauthentication decision, deployment evidence, and validation.

Closure status: **closed for repository document-release containment**. Distinct release design, historical review, deployment evidence, and validation remain pending.
