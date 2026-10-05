# Phase 0.12 Self-Audit — Public Demo-Request Privacy Containment

Date: 2026-08-24

## Scope and intended outcome

Stop Veritas from collecting, logging, rendering, or automatically forwarding public demonstration-request personal data until an approved privacy notice, retention policy, abuse controls, and controlled processor configuration exist. Preserve a transparent way to contact the product team without passing contact details through the application.

## Change review

- Replaced `/api/demo-request` with a no-argument, non-cacheable `503 DemoRequestDisabled` handler.
- Removed Resend, arbitrary webhook, and FormSubmit fallback dispatch paths.
- Removed logging of visitor names and email addresses.
- Removed unsafe personal-data interpolation into outbound HTML, subjects, and provider payloads.
- Removed the landing-page name, email, company, and team-size fields, fetch call, and unconditional dispatch-success claim.
- Replaced the form with a direct `mailto:contact@simpleafied.app` link containing only a fixed subject.
- Added UI copy stating that the link opens the visitor's email application and no contact details are submitted through Veritas.
- Added `DEMO-T001`, `DEMO-T002`, and `ENTRY-T006` containment contracts.

## Architecture, security, privacy, UI, GxP, and data-integrity audit

- **Architecture:** public lead capture is removed rather than partially repaired across unapproved processors.
- **Network/data flow:** the API cannot parse or dispatch a request; no lead data leaves through application-controlled fetch calls.
- **Injection:** there is no user-provided subject or HTML content to escape in the disabled route.
- **Abuse:** the disabled API cannot be used as an email relay. Rate limiting remains necessary for any future public endpoint.
- **Privacy:** Veritas does not collect form fields in this flow. A direct email remains subject to the visitor's and recipient's email providers and future organizational retention procedures.
- **UI integrity:** the interface no longer claims a request was dispatched regardless of HTTP outcome.
- **Accessibility:** the modal close button has an explicit accessible label; the contact action is a native link.
- **GxP/data integrity:** no regulated product record behavior changed.

## Verification evidence

- Focused API and public-entry tests: **8 passed** in 2 test files.
- TypeScript after focused changes: **passed**.
- Static provider/personal-data reference scan: **passed** for the product route and landing page.
- Full Vitest suite: **204 passed** in 26 test files.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Diff whitespace check (`git diff --check`): **passed**.
- Final static scan: **passed**; no Resend endpoint, arbitrary webhook, FormSubmit, personal-data demo state, dispatch log, or demo-request fetch remains in the route/page product path.
- Rendered production UI: **passed**; contact modal contained zero forms/inputs, exactly one fixed `mailto:` link, the no-submission disclosure, and an accessible close button.

## Traceability

- Decision: `DEC-016`.
- Risk: `RISK-016`.
- Tests: `DEMO-T001`, `DEMO-T002`, `ENTRY-T006`.
- Route matrix: `API-AUTHORIZATION-MATRIX.md`.

## Residual risk and closure judgment

- Previously deployed code and cached bundles may still expose the former form and endpoint.
- Historical application/platform logs and provider delivery histories may contain submitted personal data.
- The recipient mailbox requires an approved access, retention, deletion, and data-subject-request process.
- There is no privacy notice, processor assessment, consent/legal-basis decision, or lead-retention schedule yet.
- Future application lead capture requires input limits, anti-automation/rate controls, idempotency, one approved processor, safe templates, delivery observability, and honest UI outcomes.

Closure status: **closed for repository collection/dispatch containment**. Deployment replacement, historical-data review, mailbox governance, and future privacy/processor design remain open.
