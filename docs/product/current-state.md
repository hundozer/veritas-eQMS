# Current state against Roadmap V3

Baseline for the V3 roadmap (`docs/ROADMAP.md`), taken 11 Oct 2026 on `main`
at `4c383be`. Each line says what exists and how it was verified. Statuses:

- **Complete**: built, tested, and verified where it runs.
- **Built, not live**: code and tests exist; something outside the code is
  missing in production.
- **Partial**: part of the capability exists; the rest is named.
- **Missing**: nothing usable exists.
- **Unverified**: may work, but no evidence exists yet.

Update this file when a line changes status; link the pull request or
decision that changed it.

## VER-00 Trust and operational foundation

| Capability | Status | Evidence / gap |
| --- | --- | --- |
| Invitation and account activation | Built, not live | `POST /api/users`, `/auth/setup-password`, `src/db-tests/provisioning.dbtest.ts` (DEC-063). Email domain not verified in Resend, so no invitation reaches anyone. |
| Password recovery | Missing | Token library supports `PASSWORD_RESET` for active accounts; no route or UI. On 11 Oct 2026 the owner needed a one-off database fix (DEC-085). |
| Member role changes | Missing | `PUT /api/users/[id]` answers `503`. |
| Member deactivation | Built, not live (merged code awaits release and a production check) | `POST /api/users/[id]/deactivate` suspends the membership, sets the user inactive and revokes every session, audited; `src/db-tests/member-deactivation.dbtest.ts` (#74). No reactivation yet. |
| Session revocation | Partial | A member can end their own session (logout). Deactivation revokes all of the member's sessions. No administrator revocation of single sessions; nothing revokes sessions on role change or password reset (neither exists yet). Sessions expire after 12 h. |
| Multi-organisation membership | Missing | Sign-in answers `409 MembershipSelectionRequired`. |
| Tenant isolation | Complete | Row-level security on tenant tables, composite tenant keys, two-tenant suite in CI (`src/db-tests/`, DEC-059/060/061/069). Not yet covered: `Deviation`, `CAPA` and other dormant tables (no code reads them). |
| Electronic-signature integrity | Complete | Password re-entry, append-only signature rows, SHA-256 of the signed file, attempt limit (DEC-062, DEC-072). |
| Document and training acceptance tests | Complete in CI, gate not run | `LIFE-T003`, training db-tests run in CI. The Phase 1 gate (draft → effective → superseded in production with a second person) has not been run (DEC-074). |
| Audit trail integrity | Complete | Append-only by trigger for every role (DEC-057), `src/db-tests/audit-immutability.dbtest.ts`. No tamper-evidence chain (hashing across rows). |
| Backup and restore | Unverified | Neon point-in-time restore with 6 h history (`history_retention_seconds` 21600). No independent backup, no documented or tested restore. |
| Customer evidence export | Partial | Audit trail PDF export (DEC-078). No per-document, per-training or per-change evidence package. |
| Validation-support documentation | Partial | CI validation pack: URS, risk assessment, traceability, executed OQ (DEC-081). Missing: intended-use statement, supplier assessment pack, customer validation guidance. |
| Authentication findings reconciliation | Partial | Risk register (August containment) lists RISK-001/002/010 (open provisioning, SSO), RISK-013/005 (conflicting authority), RISK-024 (user admin), RISK-028 (response exposure) as contained; later work replaced the contained paths (DEC-058, DEC-063, DEC-079, DEC-080). The register itself has not been reconciled line by line, and the external penetration test has not run. |

## VER-01 Quality relationship graph

| Capability | Status | Evidence / gap |
| --- | --- | --- |
| Typed, tenant-scoped relationship model | Missing | Existing hard relations only: training requirement → document, assignment → document version, change request ↔ document (dormant). |
| Controls, requirements, evidence artifacts | Missing (dormant data) | `Requirement`, `Regulation*`, `TenantRequirementMapping` are dormant; `TenantRequirementMapping` is an unrestricted polymorphic table and must not be reused (ADR-001). |

## VER-02 Connected quality workflows

| Capability | Status | Evidence / gap |
| --- | --- | --- |
| Change control | Missing (table only) | `ChangeRequest` is tenant-scoped with row-level security (DEC-061); routes answer `503`; no lifecycle. |
| Deviations | Missing (table only) | `Deviation` table without composite tenant keys or row-level security; routes answer `503` (RISK-027). |
| CAPA | Missing (table only) | `CAPA` table, same gaps as `Deviation`. |
| Shared primitives | Partial | Lifecycle guard pattern, status-guarded writes, mandatory audit, signatures, notifications, controlled storage exist for documents and training. Missing: per-tenant record numbering for quality events, tasks with due dates. |

## VER-03 to VER-07

| Phase | Status |
| --- | --- |
| VER-03 Quality Impact Map | Missing |
| VER-04 Evidence readiness | Missing. The overview's "records routed to you" covers personal tasks only. |
| VER-05 Guided setup | Missing. Organisations are set up by maintenance SQL. |
| VER-06 Internal audits, supplier quality | Missing (dormant tables `AuditPlan`, `AuditFinding`, `Supplier*`). |
| VER-07 Regulatory intelligence | Missing (dormant tables `Regulation*`, `Requirement`). |

## Operations

| Item | State |
| --- | --- |
| Hosting | Vercel; production deploys from `main`. |
| Database | Neon, PostgreSQL 18 in production; CI tests on PostgreSQL 16. |
| Penetration test | Not run (owner to arrange). |
| Email | Resend configured in code; sending domain not verified. |
