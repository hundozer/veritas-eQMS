# Canonical Authorization Model

Status: canonical runtime permission foundation and P0 data migration implemented in repository; controlled execution and route migration remain open
Date: 2026-08-23

## Decision

IAM organization membership is the sole tenant and role authority. Effective permission grants derive from that active membership's IAM role. The operational `User.role`, `User.department`, and `User.clearance` fields may support workflow attribution or approved attribute rules, but they must not independently grant a capability.

## Evaluation sequence

Every protected request must pass these controls in order:

1. Validate the hashed-token IAM session, expiry, and revocation state.
2. Load the exact membership named by the session; require active IAM user, membership, organization, and operational user.
3. Require agreement among session membership, IAM organization tenant, membership tenant, and operational-user tenant.
4. Resolve effective permission keys from the membership's `IamRolePermission` assignments.
5. Require the route/method permission before parsing mutation data or loading regulated content.
6. Scope every resource query or mutation to `context.tenantId`; return `404` for foreign-tenant identifiers.
7. Apply resource attributes and segregation-of-duties rules as additional restrictions, never as permission grants.
8. Reauthenticate the current IAM identity for electronic-signature actions; bind identity, meaning, resource hash/version, time, and result to mandatory audit evidence.
9. Execute regulated state changes and their mandatory audit record atomically where the data model permits.

## Authority boundaries

| Concern | Canonical authority | Explicitly non-authoritative |
| --- | --- | --- |
| Identity | Active `IamUser` validated through `IamSession` | Email headers, client state, operational-user email |
| Tenant | Active `IamMembership` plus matching `IamOrganization.tenantId` | Request tenant ID, first tenant, operational role |
| Role | Membership's `IamRole` | `User.role`, UI role selection |
| Permission | `IamRolePermission` → `IamPermission.name` | Role-name conditionals, department checks, UI visibility |
| Resource scope | Server-side tenant predicate and relationship verification | Client-supplied storage key or tenant ID |
| E-sign identity | Reauthentication of the current IAM credential plus session/membership binding | Shared constants, role passwords, client-generated signature IDs |
| Platform administration | Separate platform-operator identity and policy plane | Tenant roles such as OWNER or ADMIN |

## Canonical permission namespace

Keep the existing P0 keys for users, documents, training, change, nonconformance, CAPA, and audit-trail access. Add explicit keys before migrating currently auth-only domains:

- `audit_plan.read`, `audit_plan.create`, `audit_plan.update`, `audit_plan.close`
- `equipment.read`, `equipment.create`, `equipment.maintain`, `equipment.retire`
- `supplier.read`, `supplier.create`, `supplier.update`, `supplier.audit`, `supplier.receive_material`
- `intelligence.read`
- `notification.read_own`
- Platform-only keys in a separate policy plane, not tenant RBAC

Permission names must be versioned and seeded idempotently. Role display names and aliases are presentation/migration concerns; authorization must evaluate permission assignments, not role-name maps.

## Route contract

- Public routes are an explicit allowlist with abuse, privacy, validation, and rate controls appropriate to their purpose.
- Disabled routes return non-cacheable `503` without parsing the request or invoking dependencies.
- Protected routes return `401` for no valid context, `403` for missing permission, and `404` for absent or foreign-tenant resources.
- Reads must not cause regulated mutations. Detection jobs and deadline transitions belong in authorized, idempotent background workflows.
- Raw internal errors and regulated content are never returned from authorization failures.

## Migration gates

1. Contain hard-coded e-signature mutation paths.
2. **P0 repository migration implemented 2026-08-24; execution pending:** seed 29 canonical permissions and 73 approved assignments for six tenant-role families. New auth-only domain permissions remain for later migrations.
3. **Implemented 2026-08-24:** validated sessions and `getContext` load effective permission names from the active membership role's persisted assignments; runtime `hasPermission` no longer grants from role names.
4. **In progress:** equipment, supplier, notification, and minimized audit-plan reads are migrated; unsafe audit-plan creation and misleading intelligence remain disabled; continue one domain at a time from role/department or auth-only checks.
5. Add negative tests for unauthenticated, insufficient-permission, and cross-tenant requests for every method.
6. **Partially completed 2026-08-24:** static role-policy presentation and the `/api/roles` registry are removed/disabled; the remaining P0 map is migration-contract-only. Continue removing `User.role` authorization branches after route parity is proven.
7. Independently review and validate the final policy, seed data, and production migration.

This document is an engineering control specification, not a claim of regulatory compliance or legal advice.
