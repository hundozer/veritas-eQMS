# Phase 0.17 Self-Audit — Complete Server Event Boundary

Date: 2026-08-24

## Scope and intended outcome

Route every remaining application server signal through the controlled event interface and define the deployment access, retention, privacy/security, monitoring, incident, and GxP requirements needed before operational reliance.

## Change review

- Added 11 typed error event names for the remaining fixed failure signals.
- Added three typed informational event names for regulatory-rebuild stub notices.
- Added `reportServerNotice`, which accepts one allow-listed notice event and emits only timestamp, `info` level, event name, and random event ID.
- Migrated all 14 remaining direct server console call sites.
- Tightened the static contract to reject every direct console call outside `server-errors.ts`.
- Added notice behavior/schema testing.
- Defined 12 deployment observability control requirements and their required evidence.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Architecture:** one module is now the complete application server-event boundary. Error and notice callers accept only literal-union event names.
- **Security/privacy:** callers cannot attach runtime metadata. The emitted schemas contain no identity, tenant, record, request, payload, file, storage, exception, credential, or token fields.
- **Tenancy:** events are deliberately tenant-neutral. Future tenant-aware operational analysis must not bypass the approved schema/privacy design.
- **Severity:** failures use `error`; inactive rebuild-stub execution uses `info`. Event and error IDs are random UUIDs without encoded meaning.
- **UI/API:** API response behavior is unchanged in this phase. No UI changed.
- **Legal/privacy:** requirements now demand processor/location, access, retention/deletion, historical-log, and incident review; they do not claim those deployment controls already exist.
- **GxP/data integrity:** the event stream is explicitly non-authoritative and cannot replace mandatory transactional audit evidence. Delivery failure must not change regulated outcomes.

## Verification evidence

- Focused error/logging contracts: **7 passed** in three test files.
- TypeScript after focused changes: **passed**.
- Direct-console scan outside the controlled module: **passed with zero matches**.
- Full Vitest suite: **227 passed** in 30 test files.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Final direct-console scan: **passed with zero matches** outside `server-errors.ts`.
- Controlled-adapter count: **passed**; the module contains exactly one `console.error` and one `console.info` transport call.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; the 14 call sites only replace fixed console messages with typed events, response/business behavior is unchanged, and the requirement document does not claim unimplemented deployment controls.

## Traceability

- Decision: `DEC-021`.
- Risk: `RISK-018`.
- Requirements: `OBS-001` through `OBS-012`.
- Tests: `ERROR-T001` through `ERROR-T004`, `LOG-T001` through `LOG-T003`.

## Residual risk and closure judgment

- The application boundary is implemented, but no deployment transport/access/retention control has been configured or evidenced.
- Historical logs may contain sensitive pre-containment data.
- The current runtime console adapter offers no application-level delivery guarantee or tamper evidence.
- Event IDs for non-response failure paths are not presented to users; they support only platform-side event distinction.
- Legal, privacy, security, quality, and operations owners must approve the deployment control package; Codex self-audit cannot provide those independent approvals.

Closure status: **closed for repository server-event centralization and deployment requirement definition**. Deployment observability remains unapproved until `OBS-001`–`OBS-012` evidence exists.
