# Veritas

Connected quality management for small and mid-sized regulated
life-sciences organisations. The direction: **know what changed, know what it
affects, know what to do next** (`docs/product/vision.md`). Today Veritas
does document and training control: controlled documents from draft through
review, approval and release, "read and understood" training on every
released version, electronic signatures, and an audit trail that cannot be
edited. Multi-tenant; each customer is one organisation and sees only its own
records.

Production: Vercel, deployed from `main`. Regulated customers will rely on
this code, so correctness beats speed.

## Where to read first

| File | What it tells you |
| --- | --- |
| `docs/product/` | Vision, strategy, MVP scope, current state against the roadmap |
| `docs/USER-MANUAL.md` | Every user flow, step by step, as a user sees it |
| `docs/FEATURES.md` | What is built, live, disabled or dormant, and where it lives |
| `docs/ROADMAP.md` | Roadmap V3 (VER-00 … VER-07); work only on the current phase |
| `docs/architecture/`, `docs/features/` | Relationship graph, workflows, human accountability, impact map, evidence readiness, guided setup |
| `docs/architecture/system-overview.md` | The system as built: stack, request flow, conventions |
| `docs/design-system/` | Tokens, shared components, page patterns, words, accessibility; see them at `/dev/design-system` |
| `CONTRIBUTING.md` | How the two development teams work in parallel |
| `docs/REVIEW.md` | The checklist every pull request must pass |
| `AGENTS.md` | Working rules for every developer and coding agent |
| `docs/recovery/decisions/DECISION-LOG.md` | Why things are the way they are (`DEC-nnn`) |

## How work gets done

- Claude writes most changes and reviews its own pull requests against
  `docs/REVIEW.md`; the product owner reviews, merges and releases.
- One capability per pull request, on a branch from `main`. Never push to
  `main`; merging deploys production.
- Every fix ships with a test that fails without it.
- Regulated changes (anything that changes a document, signature, training
  record or member) follow one pattern: permission check, tenant-scoped
  query, status-guarded `updateMany`, and `writeMandatoryAudit` in the same
  `tenantTransaction` (`src/lib/tenant-db.ts`).
- Tenant-owned tables have row-level security: read and write them only
  through `tenantRead` / `tenantTransaction`. A new tenant-owned table needs a
  policy and a two-tenant test in `src/db-tests/`.
- No compliance claims ("Part 11 compliant", "validated") in the product or
  the docs.
- Nobody touches the production database directly. Migrations and one-off
  maintenance (`prisma/maintenance/`) run only with the owner's explicit
  approval.
- This is Next.js 16 with breaking changes from older versions: read the
  relevant guide in `node_modules/next/dist/docs/` before writing code.

## Local setup

You need Node 22 and a PostgreSQL 16 you can throw away.

```bash
npm ci
cp .env.example .env    # git ignores it; Next and Prisma both read it
```

In `.env` set at least:

```bash
# A disposable local database, never a shared or production one.
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veritas_dev
# 32 random bytes, base64; without it sign-in refuses (two-step verification).
MFA_ENCRYPTION_KEY=   # openssl rand -base64 32
```

Then create the schema, create the local accounts, and start the app:

```bash
npx prisma migrate deploy
VERITAS_ALLOW_DEV_ACCOUNT=local-only npm run dev:account
npm run dev            # http://localhost:3000
```

`npm run dev:account` creates an organisation with three members (an author,
a reviewer and a quality manager), all with every permission, and prints
their email addresses and one shared password. Each sets up two-step
verification at the first sign-in, so keep an authenticator app at hand. The
script refuses to run unless `VERITAS_ALLOW_DEV_ACCOUNT=local-only` is set
and `DATABASE_URL` points at this machine, and never in a deployed
environment (`prisma/dev-account-guard.js`). Run it again for a fresh
organisation.

What does not work locally out of the box:

- **Uploading documents.** Files go to a private Vercel Blob store; without
  `BLOB_READ_WRITE_TOKEN` (or Vercel OIDC) creating a draft fails because
  controlled-record storage is unavailable.
- **Email.** Without `APP_ORIGIN`, `RESEND_API_KEY` and `EMAIL_FROM`,
  invitations and setup links are not sent.

## Tests and checks

Run these before opening a pull request; CI runs the same.

```bash
npx vitest run         # unit and route tests (src/**/*.test.ts)
npx tsc --noEmit
npx eslint .
```

Changes to queries, routes, migrations or database roles also need the
database suite against a disposable PostgreSQL that the connecting role
owns. It applies every migration, creates the least-privileged runtime role
`veritas_app`, and runs `src/db-tests/` as that role with two organisations:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/veritas_test npm run test:db
```

CI (`.github/workflows/ci.yml`) has four checks: unit tests, types and lint;
database and two-tenant isolation tests, including a check that the
migrations match `prisma/schema.prisma`; the validation pack (URS, risk
assessment, traceability matrix and executed OQ built from
`docs/validation/requirements.json` and both test runs); and the Vercel
preview. A requirement without passing tests fails the validation pack.

## Map of the code

| Path | What |
| --- | --- |
| `src/app/(marketing)/` | Public home page and sign-in |
| `src/app/(app)/app/` | The signed-in workspace: `page.tsx` holds state and handlers; one component per tab (`Dashboard`, `Documents`, `Training`, `People`, `AuditTrail`) |
| `src/app/api/` | Route handlers; each checks identity, then a persisted permission |
| `src/lib/` | Domain logic, mostly pure and unit-tested (`document-panel`, `training-record`, `dashboard-summary`, `audit-review`, …) |
| `src/lib/auth.ts`, `src/lib/rbac.ts` | Session context and permission checks |
| `src/lib/tenant-db.ts` | `tenantRead` / `tenantTransaction` |
| `src/lib/audit.ts` | Transactional audit writes |
| `src/lib/document-lifecycle.ts` | Allowed status transitions |
| `src/lib/controlled-storage.ts` | Blob storage with SHA-256 verification |
| `src/lib/iam/` | Passwords, sessions, two-step verification, invitations |
| `prisma/schema.prisma`, `prisma/migrations/` | Schema and migrations |
| `src/db-tests/` | Database tests with two organisations |
