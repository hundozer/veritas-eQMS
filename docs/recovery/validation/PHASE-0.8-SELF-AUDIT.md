# Phase 0.8 Self-Audit — Reproducible Font Build

Date: 2026-08-23

## Scope and intended outcome

Remove the production build's dependency on downloading Google font assets. Preserve readable sans-serif and monospace typography without introducing unlicensed or externally hosted files. Prove the application completes a production build in the restricted recovery environment.

## Change review

- Removed `Geist` and `Geist_Mono` imports, loader calls, and generated HTML classes from the root layout.
- Replaced the unresolved `--font-geist-mono` dependency with an explicit monospace stack.
- Replaced the unbundled `Plus Jakarta Sans` preference with an explicit Arial/Helvetica/system sans stack.
- Reconciled the AppShell CSS, its legacy stylesheet copy, and the UI theme typography so none can override the network-independent stack with an unbundled face.
- Added `BUILD-T001` and `BUILD-T002` to prevent restoration of the remote loader or unresolved Geist variable.

## Architecture, security, privacy, UI, and operational audit

- **Build architecture:** compilation no longer invokes the Google font loader.
- **Runtime privacy:** the former `next/font/google` design would self-host after build, but required Google access during build; the replacement makes no font network request at either stage.
- **Supply chain/licensing:** no new binary font or package was introduced.
- **UI:** typography remains a conventional sans/monospace design, but metrics can differ from Geist and across operating systems.
- **Operations:** this removes one external availability dependency from CI and release builds.
- **Data integrity/tenancy:** no data, authentication, authorization, storage, audit, or tenant behavior changed.

## Verification evidence

- Focused build-contract tests: **2 passed** in 1 test file.
- Production build (`npm run build`): **passed twice**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Full Vitest suite after the final CSS reconciliation: **189 passed** in 23 test files.
- TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Diff whitespace check (`git diff --check`): **passed**.
- Static reference scan: **passed**; no `next/font/google`, `font-geist`, or `Plus Jakarta Sans` dependency remains in product source.
- Rendered production UI: **passed**; body computed to `Arial, Helvetica, system-ui, sans-serif`, the HTML had no generated font class, no Google Fonts link was present, and member sign-in/walkthrough controls remained available.

## Traceability

- Decision: `DEC-012`.
- Risk: `RISK-006`.
- Tests: `BUILD-T001`, `BUILD-T002`.

## Residual risk and closure judgment

- System font metrics differ by platform; pixel-identical rendering is not guaranteed.
- A future brand-font choice requires license review, repository ownership, performance review, and visual regression evidence.
- A passing build is necessary release evidence but does not establish validated production deployment.
- Other build inputs, package registries, and platform services are outside this font-specific step.

Closure status: **closed for the font-related repository build blocker**. Cross-platform font metrics and wider release/deployment reproducibility remain explicit residual work.
