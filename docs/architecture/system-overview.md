# System overview (as built)

What the running system is, with paths. Each section is marked
**Implemented** (code and tests exist) or **Proposed** (agreed direction,
no code; the linked ADR governs). Product direction: `docs/product/vision.md`.
Decisions: `docs/recovery/decisions/DECISION-LOG.md`.

## Stack — Implemented

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Node 22 (`engines`), TypeScript strict | |
| Framework | Next.js 16.3 App Router, React 19.2 | Breaking changes from older Next: read `node_modules/next/dist/docs/` before writing framework code (AGENTS.md) |
| Styling | CSS Modules + CSS custom properties | No Tailwind. MUI 9 is installed; only its theme provider is mounted. See `docs/design-system/` |
| Database | PostgreSQL (Neon, PG 18 in production; PG 16 in CI) via Prisma 6 | Row-level security on tenant tables |
| Files | Vercel Blob, private store, SHA-256 verified | `src/lib/controlled-storage.ts` |
| Auth | Own IAM: Argon2id passwords, TOTP MFA, opaque sessions | `src/lib/iam/` |
| Email | Resend HTTP API (invitations, password setup) | Sending domain not verified yet (VER-00) |
| PDF | `pdf-lib` (stamping, audit export), `pdf-parse` (tests) | |
| Tests | Vitest 4: unit (`npx vitest run`), database (`npm run test:db`) | |
| Hosting | Vercel; production deploys from `main`, owner-controlled | |

## Request flow

```
Browser ──HTTPS──▶ Next.js (Vercel)
  │                 ├─ src/app/(marketing)/      public landing + sign-in (/)
  │                 ├─ src/app/(app)/layout.tsx  server: getContext() or redirect('/')
  │                 │    └─ app/page.tsx         client workspace (/app), fetches /api/*
  │                 ├─ src/app/auth/setup-password/
  │                 ├─ src/app/dev/design-system/ development only (404 in production)
  │                 └─ src/app/api/**/route.ts   route handlers (JSON)
  │                          │ getContext(req) ─▶ iam session ─▶ UserContext{tenantId, permissions}
  │                          │ hasPermission(user, 'x.y')
  │                          ▼
  │                  tenantRead / tenantTransaction(tenantId, tx => …)
  │                          │ SET LOCAL app.tenant_id  ─▶ PostgreSQL RLS policies
  │                          │ writeMandatoryAudit(tx, …)  (same transaction)
  │                          ▼
  │                  PostgreSQL (role veritas_app: no DDL, audit INSERT/SELECT only)
  └──presigned PUT──▶ Vercel Blob (staging key) ─▶ server re-reads, verifies SHA-256, stores controlled key
```

## Repository structure

| Path | Contents |
| --- | --- |
| `src/app/(marketing)/` | Landing page and sign-in (public) |
| `src/app/(app)/layout.tsx` | Server-side session gate for the workspace |
| `src/app/(app)/app/` | The workspace: `page.tsx` (state, data loading, dialogs) and one component per section (`Dashboard`, `Documents`, `Training`, `People`, `AuditTrail`, `ActionForm`) with its CSS Module |
| `src/app/api/` | Route handlers, one folder per resource; `[id]/<action>/route.ts` for workflow actions |
| `src/app/dev/design-system/` | Component showcase (development only) |
| `src/lib/` | Domain logic, each with a `*.test.ts`: lifecycle, signatures, audit, storage, training, permissions → UI actions |
| `src/lib/iam/` | Identity: sessions, sign-in, MFA, passwords, provisioning, credential tokens, login throttle |
| `src/ui/paper/` | Shared paper components (design system) |
| `src/ui/components/layout/` | `AppShell`, `Sidebar`, `Header`, `Wordmark` |
| `src/ui/` (other) | Theme provider; legacy components (unused, scheduled for deletion) |
| `src/db-tests/` | Database tests against a real PostgreSQL with two tenants |
| `src/test-support/` | Test doubles and helpers |
| `prisma/schema.prisma`, `prisma/migrations/` | Schema and SQL migrations (RLS policies, triggers live in migrations) |
| `prisma/maintenance/` | Reviewed one-off production SQL scripts (owner runs them) |
| `docs/` | Product, roadmap, architecture, features, design system, validation, decision log |

## Routing conventions — Implemented

- Pages: route groups `(marketing)` and `(app)`; the workspace is one page
  with client-side sections. Moving to URL-per-section/record
  (`/app/documents/[id]`) is **proposed** and a shared change owned by Claude
  (it touches the shell).
- API: `src/app/api/<resource>/route.ts` for `GET` list / `POST` create;
  `[id]/route.ts` for read/update; one folder per workflow action
  (`documents/[id]/submit-review`, `…/approve`, `…/release`,
  `…/withdraw-revision`). Handlers take `params: Promise<{ id: string }>`.
- Disabled capabilities answer `503` with a code
  (`src/lib/recovery-disabled.ts`: change control, deviations/CAPA, user
  role change). A module replaces its disabled handler; it does not add a
  parallel route.

## API conventions — Implemented

- JSON in, JSON out. Errors: `{ error: { code, message } }` with status
  400 `ValidationFailed`, 401 `Unauthorized`, 403 `Forbidden`, 404 `NotFound`,
  403 or 429 `SignatureFailed` (wrong password / too many attempts),
  409 `InvalidTransition` / `StaleWorkflowAction` / `SegregationOfDuties`,
  503 `…Disabled`, 500 `InternalError`.
- Unexpected errors: `reportServerError(event)` logs a structured line with an
  `errorId` and no exception text; `unexpectedErrorResponse` returns the
  `errorId` in body and `X-Error-Id` (`src/lib/server-errors.ts`). Add new
  event names to `ServerErrorEvent`.
- Responses select explicit fields (`select:`), never whole user or IAM rows.
- Regulated reads send `Cache-Control: no-store`.
- Input is validated by hand into typed values (no schema library);
  never pass a request body to Prisma.

## Database and Prisma patterns — Implemented

- Every tenant-owned model has `tenantId`, `@@unique([id, tenantId])`, and
  composite foreign keys `(xId, tenantId)` so a row cannot reference another
  tenant's row (DEC-059).
- Row-level security: policy `tenantId = current_setting('app.tenant_id', true)`
  for `USING` and `WITH CHECK` (migration `20261007140000_…`). The setting is
  transaction-local, set by `tenantRead` / `tenantTransaction`
  (`src/lib/tenant-db.ts`). Outside them the application role sees no rows.
- Still without RLS/composite keys: `Deviation`, `CAPA` and the dormant
  tables (equipment, supplier, regulation, audit plan). **No code may read
  them** until a reviewed migration brings them to standard (RISK-027).
- State changes: status-guarded `updateMany` and a check that `count` is as
  expected, else 409 `StaleWorkflowAction`.
- Migrations: `prisma/migrations/<timestamp>_<name>/migration.sql`; CI fails
  when migrations and `schema.prisma` drift. A new tenant table ships its RLS
  policy in the same migration and a two-tenant test in `src/db-tests/`.
- Never `prisma db push`, never edit an applied migration, never write
  production data without the owner.

## Authentication and sessions — Implemented

- Sign-in: email + password (Argon2id, `src/lib/iam/password.ts`), then TOTP
  (`src/lib/iam/mfa.ts`, `totp.ts`); enrolment at first sign-in. Secrets
  encrypted with `MFA_ENCRYPTION_KEY` (AES-256-GCM). Throttle: 5 failures per
  email / 20 per address in 15 min (DEC-079).
- Session: 32 random bytes, stored as SHA-256, cookie `iam-access-token`
  (`httpOnly`, `secure` in production, `sameSite=lax`), 12 h lifetime
  (`src/lib/iam/session.ts`). Pending-MFA cookie limited to `/api/auth/mfa`.
- `getContext(req?)` (`src/lib/auth.ts`) resolves the session to a
  `UserContext` (operational user, tenant, membership, persisted
  permissions) or `null`; an inactive or expired user gets `null`.
- Not built (VER-00): password recovery, administrator session revocation,
  revocation on role change/deactivation, multi-organisation choice.

## Authorisation (RBAC) — Implemented

- Permissions are persisted strings (`documents.release`, `change.approve`, …)
  on roles (`IamRole` → `IamRolePermission` → `IamPermission`), loaded into the
  session. `hasPermission(user, 'x.y')` (`src/lib/rbac.ts`) is the only check.
  The static map in `rbac.ts` is a migration contract, not runtime policy.
- Seeded permission names: `users.{read,create,update,deactivate}`,
  `documents.{read,create,update_draft,submit_review,review,approve,release,obsolete}`,
  `training.{read_own,complete_own,read_all,assign}`,
  `change.{read,create,review,approve}`,
  `nonconformance.{read,create,investigate,close}`,
  `capa.{read,create,update,approve_close}`, `audit.{read,export}`.
  A new permission needs a migration that inserts it (see
  `20261007200000_documents_release_permission`).
- Per-record assignment (assigned reviewer/approver/trainee) is checked in
  addition to the permission. Segregation of duties (author ≠ approver /
  releaser) is enforced in the route.
- The UI derives offered actions from the same permissions
  (`src/lib/document-actions.ts`, `document-panel.ts`, `workspace-access.ts`);
  **never** from `User.role`, department or a role name (DEC-058).

## Audit trail — Implemented

- `writeMandatoryAudit(tx, { context, action, objectType, objectId, payload, requestUrl })`
  (`src/lib/audit.ts`) inside the same transaction as the change; payload
  carries `before`/`after` and the reason where one is required.
- `AuditLog` is append-only: a trigger rejects UPDATE/DELETE/TRUNCATE for
  every role (DEC-057). Review screen with field diffs (`src/lib/audit-review.ts`)
  and PDF export (`GET /api/audit/export`, itself audited).
- Security events outside a tenant transaction (failed signing, sign-in):
  `logSecurityEventBestEffort` (`src/lib/auth.ts`).
- Action names are `UPPER_SNAKE` past tense, prefixed by record
  (`DOCUMENT_RELEASED`, `SIGNATURE_APPLIED`, `TRAINING_SIGNED`). New modules
  use `CHANGE_*`, `DEVIATION_*`, `CAPA_*`, `LINK_*`.

## Electronic signatures — Implemented for document versions

- `verifySignerOrRecordFailure` re-checks the signer's password and the
  attempt limit (5 per 15 min), auditing failures; `recordSignature(tx, …)`
  writes an append-only `SignatureManifest` row (signer name and role at the
  time, meaning, SHA-256 signed, IP, comment) plus `SIGNATURE_APPLIED`, inside
  the caller's transaction (`src/lib/signatures.ts`, DEC-062, DEC-072).
- Meanings: `REVIEWED`, `APPROVED`, `RELEASED`, `RETIRED`, `READ_AND_UNDERSTOOD`.
- **Limitation:** `SignatureManifest.documentVersionId` is required, so only
  document versions (and training via the document version) can be signed.
  Signing a change control, deviation, CAPA or impact assessment needs a
  generalised signature target. **Proposed:** Claude delivers it as a VER-02
  shared primitive (a signed-record reference and per-module meanings, with
  the hash of a canonical record snapshot). Modules must not add their own
  signature tables.

## File storage — Implemented

Browser → presigned write-only PUT to a tenant-prefixed staging key
(`/api/documents/uploads`) → the create/revise request sends the key and the
browser-computed SHA-256 → the server reads the object back, refuses a hash
mismatch, stores it under a controlled key and deletes the staging object.
Reads re-verify the hash (`verifyControlledObject`). Copies of non-effective
versions are stamped "uncontrolled" (`src/lib/controlled-copy.ts`). Blob I/O
stays outside database transactions. Max 25 MB; allowed types in
`src/lib/document-file-types.ts`.

## Background jobs — none

There are no scheduled jobs, queues or workers. Everything happens in the
request that causes it (training assignment runs inside the release
transaction). Overdue detection, reminders and abandoned-upload cleanup are
open items; a scheduler (e.g. Vercel Cron) needs a decision-log entry first.

## Notifications — Partial

`Notification` table (tenant-scoped, per user) read by `GET /api/notifications`;
the overview's "records routed to you" is computed from documents and
training, not from notifications. Email only for invitations and password
setup (Resend). No push, no digest.

## Testing

| Suite | Command | What |
| --- | --- | --- |
| Unit | `npx vitest run` | Libraries, route handlers with a tenant-db double (`src/test-support/tenant-db-double.ts`), rendered components (`react-dom/server`), design-system gates |
| Database | `TEST_DATABASE_URL=… npm run test:db` | Real routes and sessions against PostgreSQL with two tenants, the application role and RLS (`src/db-tests/`) |
| Types, lint | `npx tsc --noEmit`, `npx eslint .` | |
| Validation pack | CI job | URS, risk, traceability and executed OQ from `docs/validation/requirements.json` and both test reports (DEC-081) |

Test IDs (`LIFE-T003`, `DS-T012`…) are cited by `docs/validation/requirements.json`.
Unit tests run without the `@/` alias: files rendered by unit tests import
with relative paths.

## Deployment — Implemented

GitHub `main` → Vercel production (owner merges; nobody else deploys).
Pull requests get Vercel previews. CI (`.github/workflows/ci.yml`): unit +
types + lint; migration drift + database suite on PostgreSQL 16; validation
pack. Production migrations are applied by Claude only with the owner's
explicit yes (`docs/FEATURES.md`). Environment variables:
`DATABASE_URL`, `MFA_ENCRYPTION_KEY`, `BLOB_STORE_ID` (+ Vercel OIDC),
`RESEND_API_KEY`, `EMAIL_FROM`, `APP_ORIGIN`; never committed.

## Proposed (not built) — governed by

| Capability | Document |
| --- | --- |
| Quality relationship graph | `docs/architecture/quality-relationship-graph.md` (ADR-001) |
| Shared workflow primitives, change control, deviation, CAPA | `docs/architecture/quality-workflows.md` (ADR-002) |
| Quality Impact Map | `docs/features/quality-impact-map.md` (ADR-003) |
| Evidence readiness | `docs/features/evidence-readiness.md` (ADR-004) |
| Human accountability | `docs/architecture/human-accountability.md` (ADR-005) |
| Guided setup | `docs/features/guided-setup.md` |
