# Phase 0.16 Self-Audit — Controlled Error Correlation

Date: 2026-08-24

## Scope and intended outcome

Restore safe diagnostic correlation for unexpected API failures after Phase 0.15 removed sensitive runtime logging. The interface must not accept an exception, request, tenant, user, record, payload, storage key, or arbitrary metadata.

## Change review

- Added a server-error interface with a compile-time allow-list of 32 operation event names.
- `reportServerError` accepts exactly one allow-listed event and generates a UUID using the platform Web Crypto API.
- Structured logs contain exactly four fields: ISO timestamp, fixed `error` level, allow-listed event, and error ID.
- `unexpectedErrorResponse` returns the same error ID in the JSON error envelope and `X-Error-Id` header.
- Added `Cache-Control: no-store` to every migrated unexpected `500` response.
- Migrated all 32 unexpected API failure paths from duplicated fixed responses/logs to the controlled helper.
- Preserved existing `InternalError`/`InternalServerError` codes and generic message; the error ID and header are additive.
- Updated the Phase 0.14 and 0.15 contracts to enforce the centralized architecture rather than their temporary inline implementation.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Architecture:** unexpected API failure construction and logging now have one boundary. Route files choose only a typed operation event; they cannot pass caught exceptions or metadata.
- **Security/privacy:** log schema excludes exception text/stacks, request data, identity, tenant, record IDs, storage keys, and payloads. UUIDs are random correlation tokens and carry no encoded business meaning.
- **Response safety:** the client still receives only the generic unexpected-error message. The correlation ID is not an authentication credential and grants no access.
- **Caching:** unexpected failures are explicitly non-cacheable.
- **Compatibility:** existing error code/message fields remain. The new `errorId` property and header are additive; clients using strict exact-schema validation require review.
- **UI/support:** no UI was changed. Support can ask for the displayed/network error ID, but no operational console or retention procedure is approved yet.
- **Legal/privacy:** the minimal event excludes direct personal data; platform log processing, location, access, and retention still require governance.
- **GxP/data integrity:** correlation improves failure traceability but the console event is not an audit record, lacks tamper controls, and must not be used as regulated evidence.

## Verification evidence

- Focused helper, response, disclosure, and logging contracts: **6 passed** in three test files.
- TypeScript after focused changes: **passed**.
- Full Vitest suite: **226 passed** in 30 test files.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Exact migration count: **passed**; all 32 unexpected API failure paths call `unexpectedErrorResponse`.
- Final sensitive-argument scan: **passed**; no audited console call passes an exception variable or former document/version/storage metadata object.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; route changes add one helper import and replace only the former log/response pairs. Expected error handling and success paths remain unchanged.
- Focused verification deviation: the first helper test run failed because the optional `server-only` marker package is not installed. The marker was removed; the module remains server-bound through `next/server` and exclusive route-handler imports. No dependency was added. The complete focused gate then passed.
- Final-scan verification deviation: the first broad scan matched the word `error` inside approved fixed log strings after tests, types, lint, and build had passed. The scan was narrowed to runtime arguments/metadata and passed. No product code changed in response to this false positive.

## Traceability

- Decision: `DEC-020`.
- Risk: `RISK-018`.
- Tests: `ERROR-T001` through `ERROR-T004`, `LOG-T001`, and `LOG-T002`.

## Residual risk and closure judgment

- The console is still an unapproved transport without controlled access, retention, deletion, regional processing, alerting, or tamper evidence.
- Historical and deployed logs may contain pre-containment sensitive values.
- Fourteen fixed server console signals remain outside the structured interface; they carry no runtime data but should migrate after event semantics are approved.
- No client UI currently presents the error ID intentionally; it is available in the API response and developer/network tooling.
- Exact-schema API consumers may reject the additive `errorId` field and require compatibility testing before deployment.

Closure status: **closed for repository unexpected-error correlation**. Deployment compatibility, approved observability transport/governance, historical-log review, and remaining fixed-signal migration remain open.
