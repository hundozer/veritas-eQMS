# Phase 0.23 Self-Audit — Fabricated Intelligence Containment

Date: 2026-08-24

## Scope and intended outcome

Contain the remaining `/api/intelligence` endpoint and its authenticated UI because its output is not calculated from tenant data and cannot support a truthful or validated compliance conclusion.

## Change review

- Replaced the authenticated intelligence handler with the shared no-argument, non-cacheable `503 FeatureDisabled` handler.
- Removed the hard-coded compliance-health implementation that returned 94 and grade A for every tenant.
- Removed automatic dashboard fetching of `/api/intelligence`.
- Removed the role-name-driven Regulatory Intelligence navigation and module mount.
- Replaced the fabricated score, A+ fallback, “100% Audit Ready” statement, and active regulatory-engine claim with an explicit unavailable/recovery notice.
- Prevented creation of misleading `Intelligence.CalculateHealth` audit entries.
- Extended shared disabled-route coverage to the main intelligence GET and added dedicated UI/source containment contracts.
- Reduced the pinned unexpected-error helper inventory from 34 to 33 because the executable scoring path no longer exists.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Architecture:** a fail-closed boundary is appropriate because there is no real scoring implementation to authorize. `intelligence.read` remains a future permission, not a false signal that the feature is ready.
- **Authorization:** the disabled handler intentionally accepts no request and performs no authentication or role evaluation. It exposes no data and makes no capability available.
- **Tenant isolation:** no tenant input or tenant data is read. Re-enablement must calculate only from server-scoped tenant records.
- **Data integrity/audit:** the endpoint no longer writes invented scores into the audit log. Historical `Intelligence.CalculateHealth` entries may remain and require investigation before reliance or migration.
- **UI/claims:** the dashboard no longer displays a fabricated numeric score, grade, audit-readiness claim, or active-regulation claim. The intelligence module is no longer imported or reachable through navigation.
- **Legal/GxP:** compliance scoring can influence regulated decisions and marketing reliance. Intended use, model definition, source traceability, explainability, validation, change control, monitoring, and approved claims are prerequisites for re-enablement.
- **Operational behavior:** the response is `503`, `Cache-Control: no-store`, and `Retry-After: 86400`, consistent with the other contained intelligence surfaces.

## Verification evidence

- Focused intelligence, shared-disabled-route, and error-containment tests: **21 passed** in three test files.
- Focused TypeScript validation: **passed**.
- Focused Prisma schema validation: **passed**.
- Full Vitest suite: **258 passed** in 36 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Containment scans: **passed**; the route uses only the disabled handler, fabricated page symbols/claims are absent, and the hard-coded scoring library is removed.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; no permission migration was added, no external system changed, and the endpoint/UI now fail closed without score or audit side effects.

## Traceability

- Decision: `DEC-027`.
- Risks: `RISK-003`, `RISK-013`, `RISK-017`, and `RISK-020`.
- Requirement/matrix: `/api/intelligence` in `API-AUTHORIZATION-MATRIX.md`.
- Tests: `INTELLIGENCE-T001`, `INTELLIGENCE-T002`, expanded `STUB-T001`/`STUB-T002`, and the unexpected-error inventory contract.

## Residual risk and closure judgment

- Deployed copies, caches, screenshots, sales materials, exports, and historical audit events were not available for verification.
- `src/ui/components/RegulatoryIntelligenceModule.tsx` remains dormant source but is no longer imported or bundled through the application page; its future workflow is not approved.
- Re-enablement requires a separately approved product specification, validated algorithm and data lineage, `intelligence.read`, tenant isolation, negative tests, UI evidence, controlled claims, and independent quality/legal review.

Closure status: **closed for repository fabricated-intelligence containment**. Deployment and historical-evidence review remain pending.
