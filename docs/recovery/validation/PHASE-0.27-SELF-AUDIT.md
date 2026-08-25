# Phase 0.27 Self-Audit — User Administration Identity-Drift Containment

Date: 2026-08-24

## Scope and intended outcome

Prevent operational-user mutations from creating or worsening divergence from authoritative IAM identities, memberships, roles, sessions, and credentials while retaining a minimal authorized tenant roster.

## Change review

- Replaced user POST and user-detail PUT/DELETE with one no-argument, non-cacheable `503 UserAdministrationDisabled` handler.
- Removed executable operational-only provisioning, role/attribute update, deactivation, training auto-assignment, and associated audit paths.
- Retained GET behind persisted `users.read`, tenant scope, explicit ten-field selection, name ordering, and `Cache-Control: no-store`.
- Removed the tenant relation and non-roster user fields from the response.
- Removed invitation and role-reassignment handlers, state, modals, buttons, and action column from the UI.
- Reframed the page as a read-only organization roster with an explicit IAM administration limitation.
- Removed `users.create`, `users.update`, and `users.deactivate` from executable route contracts without deleting their future canonical permission definitions.
- Removed dormant user mutation error events and reduced the unexpected-error path inventory from 29 to 26.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Canonical identity:** no executable path can now create an operational user without `IamUser`/`IamMembership`, change `User.role` as if it were authoritative, or deactivate only one side of the identity.
- **Authorization:** roster GET requires persisted `users.read`. Disabled mutations expose no capability and therefore intentionally perform no identity or permission processing.
- **Tenant isolation:** roster lookup uses only the validated context tenant. No client tenant value or tenant relation is returned.
- **Data minimization/privacy:** the roster returns ID, name, email, account status, operational role/department, site, employment type, clearance, and expiry. Phone, profile, signature/approval attributes, tenant record, and relations are excluded. Email and employment metadata still require a documented purpose and retention policy.
- **Session safety:** deactivation remains unavailable because an approved workflow must update membership/identity status and revoke sessions atomically or with defined failure recovery.
- **Auditability:** disabled methods write neither partial business state nor misleading audit evidence. A future workflow must persist authoritative actor and complete before/after identity state within its controlled transaction strategy.
- **UI/truthfulness:** no invitation, role reassignment, or deactivation control is shown. Operational role remains a displayed workflow attribute, not an access grant.
- **Legal/GxP:** identity lifecycle records are security and potentially regulated evidence. Verification, approval, retention, privacy notice, access review, deprovisioning SLAs, and independent validation remain required.

## Verification evidence

- Focused user route, UI, authorization, error, and server-event tests: **29 passed** in five test files.
- Focused TypeScript validation: **passed**.
- Focused Prisma schema validation: **passed**.
- Full Vitest suite: **270 passed** in 44 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Mutation dependency and UI-control scans: **passed**; detail methods contain only the disabled-handler import/exports and prohibited handlers/modals/controls are absent.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; roster access is narrower, all identity mutations are inert, stale transactional-mutation contracts were removed, and no external system changed.

## Traceability

- Decision: `DEC-031`.
- Risks: `RISK-005`, `RISK-009`, `RISK-013`, and `RISK-024`.
- Requirement/matrix: `/api/users` and `/api/users/[id]` in `API-AUTHORIZATION-MATRIX.md`.
- Tests: `USER-ADMIN-T001` through `USER-ADMIN-T003`, `USER-ADMIN-UI-T001`, central route authorization, error-containment, and server-event contracts.

## Residual risk and closure judgment

- Existing operational users without correct IAM linkage and IAM identities/memberships with inconsistent operational state require controlled inventory and reconciliation.
- User provisioning, role changes, attribute changes, deactivation, session revocation, and recovery remain unavailable.
- The roster still displays operational role/department attributes and the UI still uses operational roles for some visibility decisions; permission-driven UI recovery remains open.
- Deployed copies and historical identity/audit mutations were not available for verification.

Closure status: **closed for repository user-administration identity-drift containment**. IAM lifecycle redesign and historical reconciliation remain pending.
