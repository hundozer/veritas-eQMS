# Phase 0.14 Self-Audit — API Internal-Error Disclosure Containment

Date: 2026-08-24

## Scope and intended outcome

Prevent unexpected server exception details from being serialized to API clients. Preserve explicitly modeled, fixed messages for expected application conditions so containment does not erase useful conflict behavior.

## Change review

- Inventoried all API route references to caught exception messages and stacks.
- Replaced 32 leaking `500` responses across 21 route files with the fixed message `An unexpected error occurred`.
- Changed the PDF failure response from interpolated plain text to the same structured JSON error envelope used by other routes.
- Retained two internal comparisons against stale-workflow sentinel messages; their client responses are fixed `409` messages and do not serialize the exception.
- Added a repository-wide route contract that rejects response serialization of exception messages, stacks, or exception objects.
- Added an exact-count contract covering all 32 contained responses.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Architecture:** the change is deliberately mechanical and does not introduce a new error abstraction during containment. A typed error taxonomy and correlation layer remain future architecture work.
- **Security/privacy:** database, storage, provider, configuration, identifier, and stack details can no longer escape through the identified unexpected-error responses.
- **Authentication/tenancy:** authorization and tenant selection are unchanged; sanitization applies after route-specific processing fails.
- **Expected errors:** fixed validation, not-found, authorization, and stale-state responses remain distinct and actionable. Only unexpected `500` details were removed.
- **Logging:** server-side `console.error` calls remain so failures are not silently swallowed, but they lack structured redaction, access control evidence, retention policy, and correlation identifiers.
- **UI:** clients now receive a stable generic message; the PDF endpoint also receives JSON rather than raw error text on unexpected failure. No visible success path changed.
- **Legal/privacy:** response containment reduces accidental disclosure, but server logs may still contain personal or confidential data and require a separate retention/access/redaction control.
- **GxP/data integrity:** no record mutation, lifecycle transition, or audit behavior changed. Sanitized responses must eventually be paired with traceable incident identifiers so support can investigate failures without exposing internals.

## Verification evidence

- Focused containment tests: **2 passed**.
- TypeScript after focused changes: **passed**.
- Full Vitest suite: **222 passed** in 28 test files.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Final disclosure scan: **passed**; no API response serializes an exception message, stack, or exception object.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; Phase 0.14 changes are limited to 32 response substitutions, one PDF error-envelope correction, the containment contract, and recovery traceability. Pre-recovery and prior-phase changes remain untouched.

## Traceability

- Decision: `DEC-018`.
- Risk: `RISK-008`.
- Tests: `ERROR-T001` and `ERROR-T002`.

## Residual risk and closure judgment

- Deployed versions may still expose the former exception text.
- Server logs are unstructured and may retain secrets, personal data, or regulated content.
- No correlation/error identifier connects a safe client response to controlled operational evidence.
- Error envelopes still use both `InternalError` and `InternalServerError`; compatibility should be assessed before future normalization.
- Non-route surfaces, logs, generated files, and infrastructure error pages were not proven free of disclosure in this step.

Closure status: **closed for repository API response containment**. Deployment replacement, controlled structured logging, correlation identifiers, and non-route disclosure review remain open.
