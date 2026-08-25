# Phase 0.2 Self-Audit — Disable Unsafe Enterprise Onboarding

Date: 2026-08-23
Decision: DEC-006
Risk: RISK-001
Result: PASS — containment exit criteria satisfied

## Approved scope

Disable `POST /api/onboarding/initialize` so it cannot parse user input or
create tenants, users, administrators, files, documents, training assignments,
knowledge-base records, or audit records. Add focused regression tests. Secure
provisioning redesign is explicitly out of scope for this step.

## Change and diff review

- Replaced the provisioning handler with a deterministic, non-cacheable `503`
  response using error code `ProvisioningDisabled`.
- Removed all route imports for Prisma, audit logging, controlled storage,
  knowledge-base seeding, cryptography, and `NextRequest`.
- Added two colocated containment tests.
- Changed recovery decisions and risk evidence only in addition to the route
  and its new test.
- `git diff --check` passed.
- No unrelated source file was edited by this step.

## Security and tenant-isolation review

- The handler accepts no request parameter and reads no body, headers, cookies,
  query string, origin, identity, tenant, or client-supplied data.
- It has no reachable database, storage, outbound network, or audit dependency.
- Unknown callers and authenticated callers receive the same closed result.
- The response is marked `Cache-Control: no-store`.
- No credentials, internal errors, tenant information, or user information are
  returned.

Result: PASS.

## GxP and data-integrity review

- No regulated record can be created, changed, signed, completed, or falsely
  represented as effective through this endpoint.
- No best-effort audit event is needed for a deterministic endpoint that has no
  regulated operation or authenticated actor. Rejected-request security-event
  monitoring may be added later as an operational control, but must not restore
  a provisioning dependency here.
- Previously created database and object-storage records are intentionally not
  modified or deleted by this containment step.

Result: PASS.

## Verification evidence

### Focused test

Command: `npx vitest run src/app/api/onboarding/initialize/route.test.ts`

- 1 test file passed
- 2 tests passed

### Full regression suite

Command: `npx vitest run`

- 18 test files passed
- 174 tests passed

### Static checks

- `npm run lint`: PASS with the same three pre-existing warnings and zero errors
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS

The production build was not rerun because Phase 0.1 already established that
it is blocked by external Google Font retrieval. This step adds no font,
bundling, layout, or runtime dependency.

## Traceability

- Decision added: DEC-006
- Risk updated: RISK-001 contained, with redesign residual risk retained
- Tests: ONBOARDING-T001 and ONBOARDING-T002

## Residual risks

1. The public onboarding UI may still offer the action and will receive the
   closed response. UI claim and flow removal is a separate containment step.
2. Secure provisioning does not yet exist and must not be re-enabled without
   verified ownership, tenant-bound IAM, idempotency, rate limiting, mandatory
   audit evidence, and transactional failure behavior.
3. Existing records created by the former endpoint have not yet been inventoried
   in deployed environments because no production-system access was in scope.

These residual risks do not defeat this step's objective: the endpoint no
longer exposes provisioning capability.
