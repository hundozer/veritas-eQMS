# API Authorization Recovery Matrix

Date: 2026-08-23
Inventory: 49 `route.ts` files

Legend: **permission** = persisted active-membership role-permission check; **auth-only** = valid context but no capability check; **legacy** = operational role/department grants access; **fail-closed** = deliberate denial; **public stub** = no data action but unauthenticated `200`; **public** = intentionally unauthenticated.

| Route | Methods | Current boundary | Required disposition |
| --- | --- | --- | --- |
| `/api/admin/regulations/import` | GET, POST | disabled (`503`) | Keep disabled until platform policy and canonical administration permissions exist. |
| `/api/admin/regulations` | GET, POST | disabled (`503`) | Keep disabled until platform policy and canonical administration permissions exist. |
| `/api/admin/stats` | GET | disabled (`503`) | Keep disabled until platform policy and canonical administration permissions exist. |
| `/api/admin/tenants` | GET, POST | disabled (`503`) | Preserve disabled without identity processing until separate platform identity and policy exist. |
| `/api/admin/updates/publish` | GET, POST | disabled (`503`) | Keep disabled until platform policy and canonical administration permissions exist. |
| `/api/admin/users` | GET, POST | disabled (`503`) | Preserve disabled without identity processing until separate platform identity and policy exist. |
| `/api/audit/export` | GET | disabled (`503`) | Preserve disabled until export purpose, fields, row limits, spreadsheet-injection defense, privacy/retention controls, and mandatory export evidence are approved. |
| `/api/audit` | GET | persisted `audit.read`; tenant-scoped, field-minimized, capped, non-cacheable | Retain bounded operational event index; do not claim completeness, immutability, retention, or Part 11 compliance without deployment evidence. |
| `/api/audits` | GET, POST | GET persisted `audit_plan.read`, tenant-scoped and field-minimized; POST disabled (`503`) | Retain restricted recovery read. Keep scheduling disabled until `audit_plan.create`, validated workflow rules, and mandatory transactional audit evidence exist. |
| `/api/auth/login` | POST | public credential entry; generic failures; minimized non-cacheable success response | Retain; add deployment-backed abuse/rate controls, MFA, and multi-membership selection. |
| `/api/auth/logout` | POST | public/idempotent token revocation; non-cacheable | Retain; verify deployed cookie and server-session revocation behavior. |
| `/api/auth/register` | POST | fail-closed 503 | Preserve disabled. |
| `/api/auth/session` | GET | authenticated, minimized browser identity; non-cacheable | Retain as authenticated self-service; never expose IAM IDs, grants, or session internals. |
| `/api/auth/sso/microsoft/callback` | GET | fail-closed 503 | Preserve disabled. |
| `/api/auth/sso/microsoft` | GET | fail-closed 503 | Preserve disabled. |
| `/api/capas/[id]` | PUT | disabled (`503`) | Preserve disabled until lifecycle transitions, same-tenant relations, SoD, reauthentication, and mandatory audit evidence are validated. |
| `/api/capas` | GET, POST | disabled (`503`) | Preserve disabled until historical relation integrity is assessed and tenant-safe projections and creation rules exist. |
| `/api/change-requests/[id]/approve` | POST | disabled (`503`) | Preserve disabled until change requests are tenant-owned and approval uses validated IAM reauthentication, lifecycle/SoD rules, and mandatory transactional audit evidence. |
| `/api/change-requests` | GET, POST | disabled (`503`) | Preserve disabled until the model has a required tenant owner and database-enforced tenant-safe document relationships. |
| `/api/demo-request` | POST | fail-closed 503 without request processing | Preserve disabled until approved notice, retention, abuse controls, and one explicitly configured processor exist. Public UI uses a direct user-initiated email link instead. |
| `/api/deviations/[id]` | GET, PUT | disabled (`503`) | Preserve disabled until investigator/equipment relationships are tenant-enforced and lifecycle/closure rules are validated. |
| `/api/deviations` | GET, POST | disabled (`503`) | Preserve disabled until historical relation integrity, minimized reads, and controlled creation behavior are approved. |
| `/api/documents/[id]/approve` | POST | permission `documents.approve` | Retain; validated IAM reauthentication required. |
| `/api/documents/[id]/effective` | POST | disabled (`503`) | Preserve disabled until a distinct persisted release permission, assigned authority/SoD, release meaning, effective-date policy, reauthentication decision, and mandatory transactional evidence are approved. |
| `/api/documents/[id]/pdf` | GET | permission `documents.read` | Retain; current server metadata and tenant checks are the target pattern. |
| `/api/documents/[id]/review` | POST | permission `documents.review` | Retain. |
| `/api/documents/[id]/revision` | POST | permission `documents.update_draft` | Retain. |
| `/api/documents/[id]` | GET, PUT, DELETE | permissions `documents.read/update_draft/obsolete`; GET tenant-predicate/minimized/no-store | Retain; preserve method-specific checks and never return assessment answers, signature internals, or full user relations. |
| `/api/documents/[id]/submit-review` | POST | permission `documents.submit_review` | Retain. |
| `/api/documents` | GET, POST | permissions `documents.read/create`; GET tenant-scoped/minimized/no-store | Retain explicit read projection and controlled create workflow. |
| `/api/equipment/[id]/logs` | POST | fail-closed 503 without request processing | Preserve disabled; redesign with `equipment.maintain` and IAM reauthentication. |
| `/api/equipment/[id]` | GET | persisted permission `equipment.read`; tenant predicate in lookup | Retain for recovery access; keep foreign-tenant identifiers indistinguishable from missing records. |
| `/api/equipment` | GET, POST | GET persisted permission `equipment.read` and tenant-scoped; POST fail-closed 503 | Retain restricted recovery read; keep creation disabled until `equipment.create` and mandatory audit exist. Move monitoring to an authorized idempotent workflow. |
| `/api/intelligence/import` | GET, POST | disabled (`503`) | Keep disabled until a tenant and platform authorization policy exists. |
| `/api/intelligence/relationships` | GET, POST | disabled (`503`) | Keep disabled until a tenant and platform authorization policy exists. |
| `/api/intelligence/requirements` | GET, POST | disabled (`503`) | Keep disabled until a tenant and platform authorization policy exists. |
| `/api/intelligence` | GET | disabled (`503`) | Preserve disabled until an intended-use-approved, traceable, tenant-scoped, validated scoring model and `intelligence.read` policy exist. |
| `/api/intelligence/updates` | GET, POST | disabled (`503`) | Keep disabled until a tenant and platform authorization policy exists. |
| `/api/notifications` | GET | persisted permission `notification.read_own`; user-and-tenant scoped | Retain as authorized self-service; preserve the 20-item newest-first bound. |
| `/api/onboarding/initialize` | POST | fail-closed 503 | Preserve disabled. |
| `/api/reports/export` | GET | disabled (`503`) | Preserve disabled until every dataset has a distinct permission, approved schema, row/size bounds, privacy policy, spreadsheet-injection defense, and mandatory export evidence. |
| `/api/roles` | GET | disabled (`503`) | Preserve disabled until role ownership, tenant visibility, a distinct policy-view permission, and authorized administration are implemented. Never expose the migration-only static map as effective policy. |
| `/api/suppliers/[id]/audits` | POST | fail-closed 503 without request processing | Preserve disabled; redesign with `supplier.audit` and IAM reauthentication. |
| `/api/suppliers/[id]/receipts` | POST | fail-closed 503 without request processing | Preserve disabled; add `supplier.receive_material` before redesigning receipt/deviation transaction and audit. |
| `/api/suppliers/[id]` | GET | persisted permission `supplier.read`; tenant predicate in lookup | Retain for recovery access; keep foreign-tenant identifiers indistinguishable from missing records. |
| `/api/suppliers` | GET, POST, PUT, DELETE | GET persisted permission `supplier.read` and tenant-scoped; POST/PUT/DELETE fail-closed 503 | Retain restricted recovery read; keep mutations disabled until method-specific membership permissions and mandatory audit exist. |
| `/api/trainings` | GET, POST | GET persisted `training.read_own/read_all`, user/tenant scoped and field-minimized; POST disabled (`503`) | Retain summary reads. Keep quiz/sign-off disabled until server-only answer keys, controlled version binding, IAM reauthentication, attempt rules, and mandatory audit evidence are validated. |
| `/api/users/[id]` | PUT, DELETE | disabled (`503`) | Preserve disabled until IAM membership role/status, operational user, active sessions, and mandatory audit evidence change atomically under approved administration policy. |
| `/api/users` | GET, POST | GET persisted `users.read`, tenant-scoped, field-minimized, non-cacheable; POST disabled (`503`) | Retain roster read. Keep provisioning disabled until IAM identity, verified credential activation, membership, operational user, role, and mandatory audit form one controlled workflow. |

## Priority summary

1. **Contained in repository:** shared hard-coded e-sign passwords were removed from CAPA close, equipment maintenance, and supplier audit; the signature paths remain unavailable pending validated IAM reauthentication.
2. **Equipment and supplier read/mutation boundaries contained in repository:** GET routes require their persisted domain permissions and tenant predicates; mutations remain fail-closed.
3. **Runtime foundation contained in repository:** authorization now loads persisted permission assignments from the validated active membership role and role names no longer grant runtime capabilities. Equipment, supplier, and notification reads have domain migrations; controlled migration execution and remaining auth-only domains are still required before release.
4. **Contained in repository:** all regulatory-intelligence API methods, including the fabricated compliance-health endpoint, return the shared non-cacheable `503`; authenticated navigation and fabricated score/readiness claims were removed.
5. **Contained in repository:** public demo-request collection and multi-processor forwarding are disabled; the UI no longer collects contact fields and instead offers a direct email link.

This is a repository-static inventory. Deployment middleware, gateway policy, CDN behavior, production roles, and database grants were not available for verification.
