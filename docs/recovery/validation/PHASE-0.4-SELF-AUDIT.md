# Phase 0.4 Self-Audit — Public Entry and Claims Containment

Date: 2026-08-23
Decision: DEC-008
Risk: RISK-003
Result: PASS — public-entry containment exit criteria satisfied

## Approved scope

Remove visible self-service provisioning triggers and unfinished SSO controls
from the public entry experience, preserve existing-member password login, and
replace categorical regulatory guarantees with evidence-bounded language. Do
not redesign the full application UI or secure provisioning in this step.

## Change and diff review

- Both public onboarding calls to action now open the demonstration-request
  flow instead of the enterprise-onboarding wizard.
- Removed Simpleafied IAM, Microsoft, and Google SSO controls from both login
  presentations and removed their public URL/notice state.
- Password login and its existing API behavior were preserved.
- Changed the password label from `Password / MFA Code` to `Password`; no MFA
  capability is implied.
- Replaced the identified verified, immutable, 100%-ready, inspection-ready,
  guarantee, and zero-orphan claims in the landing experience.
- Added four source-contract tests covering provisioning triggers, SSO,
  categorical claims, and password-login preservation.
- `git diff --check` passed.
- `src/app/page.tsx` contained substantial documented pre-recovery changes; the
  review was limited to intentional entry-flow and claim edits and did not
  reformat the file.

## Security and tenant-isolation review

- The visible public entry experience no longer invokes either disabled
  provisioning flow.
- No visible SSO control can redirect, send credentials, or imply successful
  provider configuration.
- The walkthrough button opens only the existing demonstration-request modal.
- Password login continues through the existing server-side IAM authentication
  route; no client-side identity fallback was introduced.
- No tenant, role, permission, database, storage, or session logic was changed.

Result: PASS for the approved containment scope.

## GxP, legal-claim, and data-integrity review

- Public wording now describes design references, validation support, example
  evidence, attributable audit events, and customer validation responsibility.
- Public wording no longer states that Veritas is verified, certified,
  immutable, universally audit-ready, or guaranteed to prepare a customer for
  inspection within a fixed period.
- Product examples are presented as examples rather than proof of statutory
  compliance.
- This language review is an internal containment control, not legal approval.

Result: PASS for the public landing scope.

## Verification evidence

### Focused contract test

Command: `npx vitest run src/lib/public-entry-contract.test.ts`

- 1 test file passed
- 4 tests passed

### Full regression suite

Command: `npx vitest run`

- 20 test files passed
- 181 tests passed

### Static checks

- `npm run lint`: PASS with three pre-existing warnings and zero errors
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS

### Rendered interaction audit

The Next.js development server was opened at `http://localhost:3000` and the
rendered DOM and viewport were inspected.

- Recovery/validation status is visible in the header.
- Both primary calls to action say `Request a Product Walkthrough`.
- The walkthrough action opens the demonstration-request modal.
- The walkthrough action exposes no onboarding-password field.
- Member Sign In opens a work-email and password form.
- The sign-in modal explains that SSO is unavailable during recovery.
- No Microsoft, Google, or Simpleafied SSO control is rendered.
- Browser console review showed no errors or warnings at the verified localhost
  origin.

The production build was not rerun because its known Google Font retrieval
blocker is unchanged.

## Traceability

- Decision added: DEC-008
- Risk updated: RISK-003 public landing contained; broader claim audit retained
- Tests: ENTRY-T001 through ENTRY-T004

## Residual risks

1. Dormant registration and onboarding component code remains in the client
   source, although no public state transition opens it and both provisioning
   APIs fail closed. Removal will be handled when the entry component is
   decomposed.
2. Authenticated workspace and platform-admin language still require a separate
   claims audit.
3. The external website, sales material, metadata, screenshots, and deployed
   environments were not available for this repository-only step.
4. The landing page still contains illustrative performance values and product
   examples that will need evidence or removal before commercial launch.
5. Legal counsel has not approved the revised wording.

These residual risks do not defeat the public-entry containment objective.
