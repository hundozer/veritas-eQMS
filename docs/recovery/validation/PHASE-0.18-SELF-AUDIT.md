# Phase 0.18 Self-Audit — Canonical Persisted-Permission Foundation

Date: 2026-08-24

## Scope and intended outcome

Replace static role-name runtime grants with permissions loaded from the exact active IAM membership role validated for the session. Establish the foundation required before migrating auth-only equipment, supplier, intelligence, notification, and audit-plan routes.

## Change review

- Extended the validated session query through `IamMembership.role.permissions.permission`.
- Added the resulting immutable permission-name list to `ValidatedIamSession` and `UserContext`.
- Changed `hasPermission` to evaluate only `context.permissions` and optional tenant agreement.
- Removed role-name normalization and the P0 static permission namespace from runtime grant evaluation.
- Retained static role definitions temporarily for the existing role-view/seed compatibility surface; they no longer authorize requests.
- Added tests proving persisted grants work for existing and new domain keys, missing grants deny, tenant mismatch denies, and administrator-like operational/membership role names cannot grant access.
- Added route-level proof that a `TENANT_ADMIN`-named membership with no persisted `users.read` assignment receives `403` before data access.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Architecture:** session validation is the authoritative permission-loading boundary. Routes retain the existing `hasPermission` contract while its authority changes beneath them.
- **Authentication:** permission assignments are loaded only after opaque token validation and active user/membership/organization checks.
- **Authorization:** arbitrary persisted permission names can be evaluated, enabling new domain keys without expanding a code allowlist. Empty/unassigned roles fail closed.
- **Tenant isolation:** `getContext` still requires operational-user tenant agreement with the validated IAM organization tenant; `hasPermission(..., tenantId)` retains explicit cross-tenant denial.
- **Privilege escalation:** neither `membershipRole`, `User.role`, department, nor clearance can independently satisfy `hasPermission`.
- **Availability/release:** no IAM permission seed/data migration exists. Current deployments whose roles lack persisted assignments will correctly deny protected capabilities; this is a release blocker, not a reason to restore static fallback grants.
- **UI:** no UI changed. The roles endpoint still presents static definitions and is explicitly residual migration work.
- **Legal/GxP:** least-privilege authority is improved, but production assignments, approvals, periodic review, and validated migration evidence are not yet available.

## Verification evidence

- Focused session, authentication, RBAC, and user-route tests: **49 passed** in four test files.
- TypeScript after focused changes: **passed**.
- Full Vitest suite: **223 passed** in 30 test files.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Runtime-authority static scan: **passed**; `hasPermission` contains no membership-role normalization, static role map, operational role, department, or clearance reference.
- Persisted-assignment loading scan: **passed**; validated sessions map permission names from the membership role relation.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; session/context changes add permission data only, runtime checks preserve tenant denial, and no fallback role grant or database mutation was introduced.

## Traceability

- Decision: `DEC-022`.
- Risk: `RISK-013`.
- Requirements: `AUTHORIZATION-MODEL.md`, evaluation steps 1–6 and migration gate 3.
- Tests: `SESSION-T011`, `AUTH-T007`, canonical RBAC tests, and user-administration negative permission/cross-tenant tests.

## Residual risk and closure judgment

- No idempotent migration currently creates the canonical permission namespace or assigns approved permissions to existing IAM roles.
- Existing deployed roles may therefore have zero effective permissions after this code is deployed.
- Auth-only equipment, supplier, intelligence, notification, and audit-plan reads remain to be migrated after their permission keys are seeded.
- `getP0RoleDefinitions`, role aliases, and static maps remain for presentation/migration compatibility and must not regain runtime authority.
- `checkAbac` still contains operational-role branches; it is an additional restriction helper and requires separate audit/removal to ensure it cannot be used as a grant path.

Closure status: **closed for the canonical persisted-permission code foundation**. Release remains blocked until controlled permission data migration and route-by-route negative tests are complete.
