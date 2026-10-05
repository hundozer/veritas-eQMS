# Phase 0.3 Self-Audit — Disable Unsafe Microsoft SSO

Date: 2026-08-23
Decision: DEC-007
Risk: RISK-002
Result: PASS — containment exit criteria satisfied

## Approved scope

Disable Microsoft SSO initiation and callback execution. Prove the endpoints
cannot redirect to Microsoft, consume callback input, exchange authorization
codes, retrieve profiles, choose tenants, create users, write audit events, or
create sessions. UI removal and secure SSO redesign are separate steps.

## Change and diff review

- Replaced both Microsoft SSO handlers with deterministic `503 SsoDisabled`
  responses.
- Removed `NextRequest`, environment, Prisma, audit, redirect, callback, and
  external-network logic from both handlers.
- Added three colocated containment tests.
- Updated the recovery decision log and risk register.
- `git diff --check` passed.
- No unrelated application file was edited by this step.

## Security and tenant-isolation review

- Both handlers accept no request parameter and read no URL, code, state,
  origin, cookie, header, environment variable, or tenant identifier.
- Neither handler can redirect to an authorization server or another local
  route.
- The callback has no `fetch`, Prisma, audit, credential, membership, or
  session dependency.
- Tests verify that outbound fetch, first-tenant lookup, user lookup,
  provisioning, and audit mocks remain untouched.
- Responses expose no secret, provider configuration, identity, tenant, or
  internal error and are marked `Cache-Control: no-store`.

Result: PASS.

## GxP and data-integrity review

- Unknown external identities cannot be attributed to operational users or
  tenant records through the disabled flow.
- No authentication success or regulated user event can be recorded without a
  valid IAM session because the disabled flow creates none.
- Existing identities and historical audit data are not mutated.

Result: PASS.

## Verification evidence

### Focused test

Command: `npx vitest run src/app/api/auth/sso/microsoft/route.test.ts`

- 1 test file passed
- 3 tests passed

### Full regression suite

Command: `npx vitest run`

- 19 test files passed
- 177 tests passed

### Static checks

- `npm run lint`: PASS with three pre-existing warnings and zero errors
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS

The production build was not rerun because its known external-font blocker is
unrelated to these dependency-reducing route changes.

## Traceability

- Decision added: DEC-007
- Risk updated: RISK-002 contained, with redesign residual risk retained
- Tests: SSO-T001, SSO-T002, and SSO-T003

## Residual risks

1. The sign-in UI still presents Microsoft and Google buttons that imply SSO is
   available. These must be removed or clearly disabled in the UI containment
   step.
2. Secure Microsoft SSO does not exist. Re-enablement requires per-request
   state and nonce validation, PKCE where applicable, trusted issuer/audience,
   explicit organization configuration, tenant-bound membership, and normal
   IAM session issuance.
3. Existing users formerly created through this flow have not been inventoried
   in any deployed database because production access is outside this step.

These residual risks do not defeat the endpoint-containment objective.
