@AGENTS.md

# Working on Veritas

Veritas is a multi-tenant document and training control system for EU GMP
companies. Claude develops it and reviews its own pull requests against
`docs/REVIEW.md`; the product owner approves and merges. Regulated customers
will rely on this code, so correctness beats speed.

## Start of every session

1. Read `docs/ROADMAP.md` and work only on the current phase's open items.
2. Read `docs/REVIEW.md`; every pull request must pass it before you open it.
3. `git fetch` and branch from `main`.

## Rules

- One capability per pull request, as a branch named `claude/<short-topic>`.
- Never push to `main` or deploy to production; the owner merges and releases.
- Every fix ships with a test that fails without it. Prefer behavioural tests
  over assertions on source text.
- Regulated mutations: permission check, tenant-scoped predicate,
  status-guarded `updateMany`, and `writeMandatoryAudit` in the same transaction.
- Do not add containment stubs, self-audit files, or new modules outside the
  roadmap. Delete unused code instead of disabling it.
- Make no compliance claims ("Part 11 compliant", "validated") in UI or docs.
- Before opening a PR: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`.
- Changes to queries, routes, migrations or database roles also need
  `npm run test:db` against a disposable PostgreSQL (`TEST_DATABASE_URL`); add a
  two-tenant case in `src/db-tests/` for every new tenant-owned read or write.
- Tick roadmap items in `docs/ROADMAP.md` in the same PR that completes them.

## Key places

- `src/lib/auth.ts`, `src/lib/rbac.ts`: session context and permission checks.
- `src/lib/audit.ts`: transactional audit writes.
- `src/lib/document-lifecycle.ts`: allowed status transitions.
- `src/lib/controlled-storage.ts`: Blob storage with SHA-256 verification.
- `docs/recovery/`: history of the August containment programme (read-only
  reference; decision log and risk register are still maintained).
