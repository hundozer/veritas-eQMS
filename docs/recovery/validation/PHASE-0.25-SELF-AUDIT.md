# Phase 0.25 Self-Audit — Role Registry and Policy-Truth Containment

Date: 2026-08-24

## Scope and intended outcome

Prevent the product from exposing static or globally persisted role definitions as tenant-effective authorization policy until role ownership, visibility, and administration have a safe canonical design.

## Change review

- Replaced `/api/roles` with the shared no-argument, non-cacheable `503 FeatureDisabled` boundary.
- Removed the endpoint's authentication, `users.read` check, static P0 role response, and unexpected-error path.
- Removed the authenticated UI's separate 13-role permission matrix and the legacy `permissions.ts` registry.
- Replaced the matrix with an explicit notice that persisted IAM assignments enforce access and policy presentation is unavailable during recovery.
- Marked `P0_PERMISSIONS` and `getP0RoleDefinitions` as migration-contract-only; `hasPermission` continues to consult only context permissions loaded from persistence.
- Added the roles endpoint to shared disabled-route behavioral/source contracts and added dedicated policy-truth tests.
- Removed the dormant `role.list` server event and reduced the unexpected-error path inventory from 32 to 31.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Canonical authority:** runtime access remains based solely on persisted permission names from the validated membership. No static role or permission list grants access.
- **Tenant isolation:** current `IamRole` records are global and have no tenant/organization foreign key. Disabling the endpoint avoids disclosing global/custom role metadata through a tenant permission.
- **Least privilege:** `users.read` is not treated as permission to inspect the authorization policy. A future registry needs a distinct policy-view capability and explicit scope.
- **Data minimization:** the endpoint reads and returns no role, permission, membership, identity, or tenant data.
- **UI/truthfulness:** the UI no longer claims 13 configurable system roles or displays permission keys that do not match the canonical namespace.
- **Migration safety:** the static P0 map remains only because the canonical seed migration contract compares exact intended assignments. It is explicitly labeled and is not an application policy source.
- **Legal/GxP:** an inaccurate access-control matrix undermines security review, validation, customer administration, and audit evidence. This containment does not establish compliant role administration.
- **Operational behavior:** GET returns `503`, `Cache-Control: no-store`, and `Retry-After: 86400` without accepting a request or invoking dependencies.

## Verification evidence

- Focused role-registry, disabled-route, error, server-event, migration, and RBAC tests: **38 passed** in six test files.
- Focused TypeScript validation: **passed**.
- Focused Prisma schema validation: **passed**.
- Full Vitest suite: **270 passed** in 40 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Registry containment scans: **passed**; the legacy policy module/static page symbols are absent and `/api/roles` contains only the shared disabled handler dependency.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; no persisted-role query or migration was introduced, runtime permission evaluation is unchanged, and no external system was modified.

## Traceability

- Decision: `DEC-029`.
- Risks: `RISK-005`, `RISK-013`, and `RISK-022`.
- Requirement/matrix: `/api/roles` and canonical authority in `API-AUTHORIZATION-MATRIX.md` and `AUTHORIZATION-MODEL.md`.
- Tests: `ROLE-REGISTRY-T001`, `ROLE-REGISTRY-T002`, expanded `STUB-T001`/`STUB-T002`, error/server-event contracts, and P0 migration/RBAC contracts.

## Residual risk and closure judgment

- Deployed copies and previously exported or captured role matrices were not available for verification.
- IAM roles remain global; safe tenant-scoped or explicitly platform-scoped ownership requires a data-model decision and migration.
- Role viewing, creation, assignment, editing, segregation-of-duties administration, and policy evidence remain unavailable or incomplete.
- Operational `User.role` values still appear in UI/workflow metadata and must not be mistaken for membership authority.

Closure status: **closed for repository role-registry and policy-truth containment**. A canonical scoped role-administration design remains pending.
