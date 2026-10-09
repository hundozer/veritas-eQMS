# Veritas feature inventory

What the product does today, what is switched off, and where each piece lives.
Keep this file current: a pull request that adds, removes, enables or disables
a capability updates it in the same pull request. Status words:

- **Live**: built, tested, and reachable in production.
- **Built, not live**: code is merged but something outside the code is missing.
- **Disabled**: the route exists but always answers `503` (fail-closed); its
  client code was removed during the August containment programme.
- **Dormant data**: tables kept for history; no code reads or writes them.

Decisions are referenced as `DEC-nnn` (`docs/recovery/decisions/DECISION-LOG.md`);
the plan is `docs/ROADMAP.md`; review rules are `docs/REVIEW.md`.

Last updated: 9 Oct 2026 (route groups, DEC-070).

## Platform

| Area | What it is |
| --- | --- |
| Application | Next.js 16 (App Router; read `node_modules/next/dist/docs/` before coding), React 19, MUI 9 with `@mui/material-nextjs` so server-rendered styles hydrate cleanly. Static landing page and sign-in at `/` (`src/app/(marketing)`); signed-in workspace at `/app` (`src/app/(app)`), whose server layout redirects to `/` without a valid session; `/auth/setup-password` for invited people. |
| Database | PostgreSQL on Neon (project `steep-meadow-61507302`), Prisma 6.19. Migrations in `prisma/migrations/`; production migrations are applied by Claude with the owner's explicit yes, plus a `_prisma_migrations` row with the file's SHA-256. |
| Runtime role | The app connects as `veritas_app` (`prisma/maintenance/2026-10-06-app-role.sql`): data privileges only, no DDL, no migration ledger, no UPDATE/DELETE on audit tables (DEC-057). |
| Hosting | Vercel Hobby (project `prj_tyJHLF7LPckLMOk9aw7vFY2BNRhQ`). Merging to `main` deploys production. Free plans only (owner decision). |
| File storage | Private Vercel Blob store (Frankfurt), reached with Vercel OIDC in production (DEC-054/055). `src/lib/controlled-storage.ts`. |
| Email | Resend, via `src/lib/iam/credential-email.ts`. Not configured in production (see Backlog). |
| Security headers | CSP, HSTS, frame and referrer policies in `next.config.ts`; the PDF viewer route may be framed by the same origin only. |
| CI | `.github/workflows/ci.yml`: unit tests, `tsc`, `eslint`; and a PostgreSQL 16 job that checks migration drift and runs `npm run test:db`. |

## Multi-tenancy and isolation (Live)

- Every tenant-owned row carries `tenantId`; links between tenant-owned rows are
  composite `(id, tenantId)` foreign keys with `ON UPDATE RESTRICT` (DEC-059, DEC-061).
- Row-level security: a policy `tenantId = current_setting('app.tenant_id', true)`
  on `Tenant`, `User`, `IamOrganization`, `IamMembership`, `Document`,
  `DocumentVersion`, `ApprovalRoute`, `ApprovalRouteStep`, `SignatureManifest`,
  `TrainingRequirement`, `TrainingAssignment`, `QuizResult`, `Notification`,
  `AuditLog`, `ChangeRequest`, `ChangeRequestDocument` (DEC-060, DEC-061, DEC-069).
- Application code touches those tables only inside `tenantRead` /
  `tenantTransaction` (`src/lib/tenant-db.ts`), which set the tenant for one
  transaction. Without it the app role sees nothing.
- Read before the tenant is known, by design: `IamSession` (looked up by the hash
  of its token; it names its tenant) and the `veritas_identity_memberships`
  function (ids of one identity's active memberships, for sign-in) (DEC-069).
- Identity-level tables with no tenant data: `IamUser`, `IamSession`,
  `IamCredentialActionToken`, `IamAuditTrail`; shared catalogue: `IamRole`,
  `IamPermission`, `IamRolePermission`.
- Tests: `src/db-tests/` (two seeded tenants, real routes, real sessions, the
  app role): `tenant-isolation`, `tenant-scoped-keys`, `row-level-security`,
  `identity-row-level-security`, `audit-immutability`, `provisioning`.

## Identity, sign-in and access

| Capability | Status | Where |
| --- | --- | --- |
| Email + password sign-in, Argon2id hashes | Live | `POST /api/auth/login`, `src/lib/iam/password.ts` |
| Opaque session cookie (`iam-access-token`, 12 h, only its SHA-256 stored), revocation on logout | Live | `src/lib/iam/session.ts`, `POST /api/auth/logout` |
| Session context for the UI (user, tenant, persisted permissions) | Live | `GET /api/auth/session`, `getContext` in `src/lib/auth.ts` |
| Choosing between several organisations at sign-in | Not built (answers `409 MembershipSelectionRequired`) | login route |
| Permission checks from persisted role permissions only, never job titles | Live | `hasPermission` in `src/lib/rbac.ts`; UI gating in `src/lib/document-actions.ts` (DEC-058) |
| Invite a person into your organisation with one role (holder of `users.create`); identity, user, membership and both audit rows in one transaction | Built, not live (needs email) | `POST /api/users`, `src/lib/iam/provisioning.ts` (DEC-063) |
| Set your own password from a single-use 30-minute link; request a fresh link | Built, not live (needs email) | `/auth/setup-password`, `POST /api/auth/setup-password`, `POST /api/auth/setup-password/request` |
| Resend an invitation | Built, not live | `POST /api/users/[id]/invitation` |
| Member list with "invitation pending" | Live | `GET /api/users` (`users.read`) |
| Assignable roles for invitations (no platform roles) | Live | `GET /api/roles` (`users.create`) |
| Edit or deactivate a member, change roles | Disabled | `PUT/DELETE /api/users/[id]` |
| Self-service organisation sign-up | Disabled | `POST /api/auth/register` |
| Onboarding initialisation | Disabled | `POST /api/onboarding/initialize` |
| Password reset links (for active accounts) | Library only, no route or UI | `src/lib/iam/credential-action-token.ts` |
| MFA, login rate limiting, SSO | Not built (Phase 2 / 4) | — |

Persisted permissions: `users.read/create/update/deactivate`,
`documents.read/create/update_draft/submit_review/review/approve/release/obsolete`,
`training.read_own/complete_own/read_all/assign`, `audit.read/export`,
`notification.read_own`, plus `change.read`, `nonconformance.read`,
`capa.read/approve_close` for disabled modules. Roles live in `IamRole`; the
owner's account holds "Quality Manager" (DEC-058). `documents.release` is
granted to Quality Manager roles only (DEC-064).

## Document control (Live)

Lifecycle: `DRAFT → IN_REVIEW → APPROVED → EFFECTIVE → SUPERSEDED / OBSOLETE`,
plus `WITHDRAWN` for an abandoned revision. Allowed transitions are enforced by
`assertTransition` (`src/lib/document-lifecycle.ts`). Every state change is a
status-guarded `updateMany` with its `writeMandatoryAudit` row in one tenant
transaction.

| Capability | Permission | Where |
| --- | --- | --- |
| List and open documents, version history, review steps, signatures | `documents.read` | `GET /api/documents`, `GET /api/documents/[id]` |
| Create a draft with a source file (PDF, Word, Excel, PowerPoint, text; 25 MB) and a document number | `documents.create` | `POST /api/documents` |
| Edit draft metadata or replace the draft file (new immutable object) | `documents.update_draft` | `PUT /api/documents/[id]` |
| Upload files straight from the browser to private storage; server re-reads and re-hashes them; inline Base64 fallback up to 3 MB | `documents.create` or `documents.update_draft` | `POST /api/documents/uploads`, `src/lib/document-file-upload.ts` (DEC-068) |
| Submit for review with an assigned reviewer and approver (approver may not be the author) | `documents.submit_review` | `POST /api/documents/[id]/submit-review` |
| Complete the assigned review (signed `REVIEWED`) or return for changes | `documents.review` + assignment | `POST /api/documents/[id]/review` |
| Approve (signed `APPROVED`) | `documents.approve` + assignment | `POST /api/documents/[id]/approve` |
| Release to effective (signed `RELEASED`, never by the author); supersedes the previous effective version atomically | `documents.release` | `POST /api/documents/[id]/release` (DEC-064) |
| Start a revision of an effective document; numbers never reused | `documents.update_draft` | `POST /api/documents/[id]/revision` |
| Withdraw an open revision (reason; review route cancelled; effective version stays in force) | `documents.update_draft` | `POST /api/documents/[id]/withdraw-revision` (DEC-065) |
| Retire an effective document (signed `RETIRED`, reason required) | `documents.obsolete` | `DELETE /api/documents/[id]` (DEC-066) |
| Controlled copy viewer: effective version by default, served exactly as stored; every other version stamped "UNCONTROLLED COPY - status - NOT FOR USE" (PDF pages, text header, Office file name) | `documents.read` | `GET /api/documents/[id]/pdf`, `src/lib/controlled-copy.ts` (DEC-067) |
| Every stored file is SHA-256 verified on read; a mismatch is refused | — | `verifyControlledObject` in `src/lib/controlled-storage.ts` |

## Electronic signatures (Live)

- Password re-entry by the signer; checked against their own identity
  (`src/lib/signatures.ts`, DEC-062).
- Meanings: `REVIEWED`, `APPROVED`, `RELEASED`, `RETIRED`.
- Each signature row stores signer, printed name and role at that moment,
  meaning, server time, client IP, optional comment (the reason for
  retirement) and the SHA-256 of the signed file. It is written with its
  `SIGNATURE_APPLIED` audit row in the same transaction as the state change.
- Signature rows are append-only by trigger. A failed attempt changes nothing
  and leaves a `SIGNATURE_FAILED` audit row.
- UI: one signing dialog for all four meanings (`src/lib/signing-request.ts`).
- After five wrong passwords within 15 minutes, a signer's next attempts are
  refused with HTTP 429 without checking the password, until the oldest falls
  out of the window. Counted per signer from their own `SIGNATURE_FAILED`
  audit rows; each refusal is audited too (DEC-072).

## Audit trail

| Capability | Status | Where |
| --- | --- | --- |
| Mandatory tenant audit rows for every regulated mutation, in the same transaction | Live | `src/lib/audit.ts`, table `AuditLog` |
| Identity audit rows (invitations, password set, setup links) | Live | table `IamAuditTrail` |
| Append-only: UPDATE, DELETE and TRUNCATE rejected by trigger for every role | Live | migration `20261006120000_audit_append_only` (DEC-057) |
| Audit log screen with filters (action, object, user, dates) | Live | `GET /api/audit` (`audit.read`), "Compliance Audit Logs" in the UI |
| Audit export | Disabled | `GET /api/audit/export` |
| Field-level diffs and PDF export | Not built (Phase 2) | — |

## Training

| Capability | Status | Where |
| --- | --- | --- |
| Training requirements attached to documents; assignments per person | Live (read) | tables `TrainingRequirement`, `TrainingAssignment` |
| Training Hub: own assignments, or the tenant matrix with `training.read_all`, each with the version to train on | Live (read) | `GET /api/trainings` |
| Completing training / quizzes | Disabled | `POST /api/trainings` |
| Training departments set on a new document (comma-separated; blank for none) | Live | `POST /api/documents` |
| Training assigned on release: active members of the training departments get the new effective version; open assignments on earlier versions become `SUPERSEDED`; `TRAINING_ASSIGNED` audit row | Live | `POST /api/documents/[id]/release`, `src/lib/training-assignment.ts` (DEC-073) |
| "Read and understood" signature, training matrix screen | Not built (Phase 2) | — |

## Other screens and routes

| Capability | Status | Where |
| --- | --- | --- |
| Dashboard with document counts | Live | `src/app/(app)/app/page.tsx` |
| Own notifications | Live | `GET /api/notifications` (`notification.read_own`) |
| Public landing page and sign-in form; a visitor with a session is sent on to `/app` | Live | `src/app/(marketing)/` |
| Workspace sections offered by persisted permission (`users.read` → user access, `audit.read` → audit log) | Live | `src/lib/workspace-access.ts` |
| Demo request form | Disabled | `POST /api/demo-request` |
| Report export | Disabled | `GET /api/reports/export` |

## Disabled quality modules

Change control (`/api/change-requests`), deviations (`/api/deviations`) and
CAPA (`/api/capas`) answer `503`; their client code was removed (DEC-039,
DEC-040). `ChangeRequest` tables are tenant-scoped with row-level security,
ready for Phase 3. Deviations and CAPA return in Phase 3 on the shared
signature, audit and isolation services.

## Dormant data

Kept for history, no code reads or writes them, retired later by a reviewed
migration: `Equipment`, `MaintenanceLog`, `Supplier`, `SupplierAttachment`,
`SupplierAudit`, `MaterialReceipt`, `AuditPlan`, `AuditFinding`, `Regulation`,
`RegulationVersion`, `SourceDocument`, `Chapter`, `Section`, `Requirement`,
`TenantRequirementAssessment`, `TenantRequirementMapping`,
`IamProductSubscription`. Production also holds the demo tenants "Acme
Biotech" and "BioLabs Inc" as read-only history (DEC-056).

## Backlog and known gaps

- Invitation email in production: `EMAIL_FROM` is set (`contact@simpleafied.app`);
  the administrator account is created by a reviewed maintenance step
  (DEC-071). Live once both are in place and `simpleafied.app` is verified in
  Resend (see `docs/ROADMAP.md` Backlog).
- Abandoned direct-upload staging objects are not cleaned up (DEC-068).
- Office files cannot be stamped as uncontrolled copies; only their file name
  is marked (DEC-067).
- Numbered, tracked paper copies are not built.
- Organisation selection at sign-in for people with several memberships.
- Rate limiting for login and signing; MFA; external penetration test (Phase 2).

## Testing

- `npx vitest run`: unit and route tests (`src/**/*.test.ts`); route tests
  mock every `@/lib/...` module, and `src/test-support/tenant-db-double.ts`
  stands in for `tenant-db`.
- `npm run test:db` with `TEST_DATABASE_URL`: applies all migrations to a
  disposable PostgreSQL, creates `veritas_app`, and runs `src/db-tests/` as
  that role with two tenants.
- Requirement-style test ids (`LIFE-T003`, `COPY-T007`, `IDRLS-T002`, …) are
  cited from decisions and pull requests.
