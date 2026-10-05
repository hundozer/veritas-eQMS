# Phase 0.15 Self-Audit — Sensitive Server-Log Containment

Date: 2026-08-24

## Scope and intended outcome

Stop application server logs from receiving runtime exception objects, record identifiers, storage keys, payloads, or interpolated values until a controlled observability design exists. This phase covers `src/app/api` and server library code under `src/lib`; browser-console diagnostics are outside this server-log boundary.

## Change review

- Inventoried 46 server console calls: 43 error paths and three fixed regulatory-rebuild stub notices.
- Removed raw exception arguments from all 43 server error calls.
- Removed document ID and version ID metadata from controlled-document retrieval failure logging.
- Removed storage object keys from orphan-cleanup failure logging.
- Preserved one fixed, code-authored event string at each site so failures are not silently swallowed.
- Added repository contracts requiring exactly one fixed string argument for every server console call and explicitly rejecting the former high-risk identifiers/error arguments.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Architecture:** containment uses the existing console transport and deliberately avoids treating it as the permanent observability architecture. Structured events and correlation IDs require an approved schema, transport, access model, and retention policy.
- **Security/privacy:** exception messages, stacks, database/provider details, record identifiers, storage keys, and accidental payload fields are no longer passed at the audited server log sites.
- **Tenancy:** tenant and record identifiers are not emitted. This limits leakage but also means current logs cannot support tenant-specific investigation.
- **Availability/support:** fixed event text preserves a coarse failure signal. Diagnostic detail is intentionally reduced until a controlled channel exists.
- **UI:** browser-console calls were not changed; no product UI or success behavior changed.
- **Legal/privacy:** future logging requires documented purposes, data minimization, access, retention/deletion, processor assessment, incident handling, and data-subject considerations where applicable.
- **GxP/data integrity:** no regulated record or audit event behavior changed. The current coarse logs are not validation evidence and do not provide attributable failure correlation.

## Verification evidence

- Focused logging contracts: **2 passed**.
- TypeScript after focused changes: **passed**.
- Full Vitest suite: **224 passed** in 29 test files.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Final server-log scan: **passed**; no console call under the audited server roots contains a second argument, object literal, or runtime value.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; changes remove only data-bearing log arguments and preserve the fixed event text and surrounding failure behavior.
- Verification deviation: the first combined final-gate command did not start because an unescaped backtick in its shell pattern caused a shell parse error. No repository action occurred. The scan was rewritten with safe quoting and the complete gate then passed.

## Traceability

- Decision: `DEC-019`.
- Risk: `RISK-018`.
- Tests: `LOG-T001` and `LOG-T002`.

## Residual risk and closure judgment

- Previously deployed application/platform logs may retain sensitive historical entries and require inventory, access review, retention decisions, and deletion where lawful/appropriate.
- Console output has no approved structured schema, tamper protection, severity taxonomy, correlation identifier, alert routing, or controlled retention.
- Removing exception details reduces support diagnostics; a safe correlation design is the next recovery step.
- Browser-console diagnostics and infrastructure/provider-generated logs remain outside this phase.
- The test count is intentionally pinned to 46 so every new server console call requires explicit review; an approved structured logger should replace this temporary rule.

Closure status: **closed for repository raw-value server-log containment**. Deployment/historical-log review and controlled observability design remain open.
