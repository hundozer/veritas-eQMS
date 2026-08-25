# Phase 0.7 Self-Audit — Dormant Provisioning UI Removal

Date: 2026-08-23

## Scope and intended outcome

Remove dormant self-service organization-registration and enterprise-onboarding implementations from the client bundle. Preserve the demonstration-request and existing-member password-login paths. Server registration and onboarding routes remain fail-closed as defense in depth.

## Change review

- Removed the `OnboardingWizardModal` import and standalone component.
- Removed registration/onboarding visibility state and six registration form state variables.
- Removed the live `/api/auth/register` fetch handler.
- Removed duplicate landing and authenticated registration modals.
- Removed both enterprise-onboarding wizard mounts and the client fetch path to `/api/onboarding/initialize`.
- Extended the public-entry contract to reject the endpoints, state/handler/component symbols, and provisioning CTA text.

## Architecture, security, UI, and data-integrity audit

- **Architecture:** dead provisioning behavior is no longer bundled into the 5,000-line client page; no replacement architecture was introduced in this containment step.
- **Security/privacy:** browsers can no longer render these forms or submit credentials and organization data through their handlers.
- **Tenant isolation:** there is no client path capable of asking either fail-closed provisioning endpoint to create or select a tenant.
- **UI integrity:** demonstration request and member password sign-in remain the supported public actions.
- **Defense in depth:** `/api/auth/register` and `/api/onboarding/initialize` still independently return non-cacheable `503` responses.
- **Data integrity:** no database, storage, audit, or migration behavior changed.

## Verification evidence

- Focused entry-contract tests: **5 passed** in 1 test file.
- Full Vitest suite: **187 passed** in 22 test files.
- TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Diff whitespace check (`git diff --check`): **passed**.
- Static symbol/reference scan: **passed**; prohibited symbols and endpoints occur only as negative assertions in the contract test.
- React review: **passed for this removal**; no new hooks, components, event handlers, props, or render branches were introduced, and deleting the imported wizard removes it from the client module graph.
- Rendered Next.js UI: **passed**; landing rendered, member sign-in modal opened with email/password fields, walkthrough-request modal opened, and no registration/onboarding control or modal appeared.

## Traceability

- Decision: `DEC-011`.
- Risk: `RISK-012`.
- Test: `ENTRY-T005`, with existing `ENTRY-T001` and `ENTRY-T004` protecting supported public actions.

## Residual risk and closure judgment

- The large client page continues to couple many product domains and remains an architectural risk (`RISK-007`).
- Disabled API route files remain intentionally present and tested; they must not be re-enabled without approved provisioning requirements and validation.
- Deployed bundles and browser/CDN caches are outside this repository-only step.
- A future controlled onboarding experience has not been designed.

Closure status: **closed for repository UI containment**. Deployed bundle/cache verification and design of any future controlled onboarding remain open.
