<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working on Veritas

Shared instructions for every coding agent (Claude, Codex) and for human
developers. Agent-specific notes live in `CLAUDE.md`.

## What Veritas is becoming

A connected quality management platform for 10–100-person European biotech,
CRO, GMP manufacturing and supplier organisations. Promise: **know what
changed, know what it affects, know what to do next.** Differentiators: the
Quality Impact Map, continuous evidence readiness and guided setup, built on a
typed quality relationship graph. Foundations that are never traded away:
security, tenant isolation, traceability, validation support and human QA
accountability.

The promise is direction, not a current capability; never present it as one.
Authoritative sources (read the one your task touches; do not copy them here):

| Topic | File |
| --- | --- |
| Vision and product principles | `docs/product/vision.md` |
| Customers, positioning, order of work | `docs/product/strategy.md` |
| MVP scope and release gate | `docs/product/mvp-scope.md` |
| Roadmap V3 (VER-00 … VER-07) | `docs/ROADMAP.md` |
| What exists vs. the roadmap | `docs/product/current-state.md`, `docs/FEATURES.md` |
| Relationship graph (ADR-001) | `docs/architecture/quality-relationship-graph.md` |
| Workflows (ADR-002), human accountability (ADR-005) | `docs/architecture/` |
| Impact map, evidence readiness, guided setup | `docs/features/` |
| Decisions (`DEC-nnn`, ADRs included) | `docs/recovery/decisions/DECISION-LOG.md` |
| Review checklist | `docs/REVIEW.md` |

## Start of every task

1. Find the GitHub issue for the work (`VER-nn` phase issues and their
   sub-issues); work only on open items of the current phase, and claim the
   issue so two people never change the same capability.
2. Read the relevant files above and `docs/REVIEW.md`.
3. `git fetch` and branch from `main`.

## Rules

- One capability per pull request. Never push to `main` or deploy to
  production; the owner merges and releases. No production schema change or
  data change without the owner's explicit approval.
- Every fix ships with a test that fails without it. Prefer behavioural tests
  over assertions on source text.
- Regulated mutations: permission check, tenant-scoped predicate,
  status-guarded `updateMany`, and `writeMandatoryAudit` in the same
  `tenantTransaction` (`src/lib/tenant-db.ts`).
- Tenant-owned tables have row-level security: read and write them only
  through `tenantRead` / `tenantTransaction`; a new tenant-owned table gets a
  policy and a two-tenant case in `src/db-tests/`.
- Relationships between quality records use the relationship graph and its
  taxonomy (ADR-001); never ad-hoc ID columns or an unrestricted polymorphic
  table.
- Nothing automated approves, closes, signs or sets a controlled status;
  suggestions stay suggestions until a person decides (ADR-005). Every
  insight shows its rule and relationship path.
- No graph database, vector database, new service or workflow engine without
  a decision-log entry. No AI features in the MVP.
- No compliance claims ("compliant", "validated", "inspection-ready") in UI,
  docs or copy.
- No containment stubs or self-audit files; delete unused code instead of
  disabling it. No new modules outside the roadmap.
- Before opening a PR: `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`.
  Changes to queries, routes, migrations or database roles also need
  `npm run test:db` against a disposable PostgreSQL (`TEST_DATABASE_URL`).
- In the same PR: tick `docs/ROADMAP.md`, update `docs/product/current-state.md`
  and `docs/FEATURES.md` when a capability changes status.

## Key places

- `src/lib/auth.ts`, `src/lib/rbac.ts`: session context and permission checks.
- `src/lib/tenant-db.ts`: `tenantRead` / `tenantTransaction`.
- `src/lib/audit.ts`: transactional audit writes.
- `src/lib/document-lifecycle.ts`: allowed status transitions (the pattern for
  every lifecycle).
- `src/lib/signatures.ts`: electronic signatures.
- `src/lib/controlled-storage.ts`: Blob storage with SHA-256 verification.
- `docs/recovery/`: history of the August containment programme (read-only
  reference; decision log and risk register are still maintained).
