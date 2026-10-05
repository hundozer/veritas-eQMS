# Phase 0.9 Self-Audit — Authorization Architecture and Route Inventory

Date: 2026-08-23

## Scope and intended outcome

Define one authorization authority and inventory every API route before altering access behavior. Identify immediate containment priorities and produce an implementable migration sequence. This step changes documentation and traceability only.

## Change review

- Inspected session-to-membership context construction, static RBAC, UI permission definitions, IAM schema relationships, and all 49 API route files.
- Defined active IAM membership plus persisted IAM role-permission assignments as the canonical tenant/capability authority.
- Recorded a route-by-route method, current-boundary, and target-disposition matrix.
- Separated tenant authorization from future platform-operator authorization.
- Added explicit target permissions for audit plans, equipment, suppliers, intelligence, and own notifications.
- Identified hard-coded signature credentials as a separate critical containment risk.

## Architecture, security, tenancy, GxP, UI, and legal-readiness audit

- **Architecture:** the target removes static role-name and operational-role grants, but no runtime migration has yet occurred.
- **Authentication:** current IAM sessions bind a membership and operational user with tenant agreement; this is a sound identity anchor to retain.
- **Authorization:** database `IamRolePermission` assignments currently do not drive runtime route decisions.
- **Tenant isolation:** many routes scope or post-check tenant IDs, but capability checks are inconsistent; both controls are required.
- **Least privilege:** equipment, supplier, audit-plan, intelligence, and notification domains lack complete explicit permissions.
- **Electronic records/signatures:** shared constants cannot establish signer identity; three affected mutation paths are critical and open.
- **Data integrity:** equipment GET causes status/deviation mutations, violating a clean read boundary and complicating attribution/idempotency.
- **UI:** UI role definitions are not an authorization authority and currently use a second permission namespace.
- **Legal readiness:** the model supports future access-control and signature traceability, but counsel/quality approval and formal regulatory traceability remain required.

## Verification evidence

- Matrix completeness script: **passed**; 49 route files equal 49 unique matrix routes with no missing or extra entry.
- Static credential scan: **passed as an inventory control**; exactly the three documented affected routes were returned.
- Persisted-permission usage scan: **confirmed the documented gap**; no route/runtime evaluator loads `IamRolePermission` assignments.
- Diff whitespace check (`git diff --check`): **passed**.
- Full Vitest suite: **189 passed** in 23 test files.
- TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.

## Traceability

- Decision: `DEC-013`.
- Risks: `RISK-013`, `RISK-014`, `RISK-015`.
- Requirements: `AUTHORIZATION-MODEL.md`.
- Inventory: `API-AUTHORIZATION-MATRIX.md`.

## Residual risk and closure judgment

- This phase specifies and inventories; it does not reduce the open runtime risks in `RISK-013` through `RISK-015`.
- Static analysis cannot prove gateway, deployment, database-role, or production IAM configuration.
- Permission-role assignment design still requires product/quality ownership decisions and independent review.
- The public demo-request privacy/abuse issue is recorded in the route matrix and needs its own containment step.

Closure status: **closed for architecture specification and repository inventory only**. Runtime containment is not closed; `RISK-014` and `RISK-015` are the next implementation priorities.
