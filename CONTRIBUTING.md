# Contributing: two teams, one product

Veritas is built by two development teams in parallel: **Claude** (core
architecture and shared technical foundations) and **Száva** (`maczikasz`)
with his coding agent (independently assigned product modules and frontend
work). The product owner approves, merges and releases. This file is the
collaboration protocol; the working rules are in `AGENTS.md` and the review
checklist in `docs/REVIEW.md`.

## Rules

1. **GitHub is the source of truth.** Issues, pull requests and the files on
   `main` decide. Chat transcripts, archives and local notes do not. The
   handover package (`docs/handover/szava/`) is a snapshot; when it and
   `main` disagree, `main` wins.
2. **One accountable owner per task.** Every piece of work is a GitHub issue
   (`VER-nn` phase issue or sub-issue) assigned to one person before work
   starts. Nobody changes a capability another person has claimed.
3. **Separate branches.** Claude: `claude/<topic>`. Száva: `szava/<topic>`.
   Branch from current `main`; never push to `main` or to the other team's
   branch.
4. **Contracts before code.** A shared contract (a table, an API shape, a
   relationship type, a shared component, a permission, a signature meaning,
   a record-number format) is agreed in its issue, in writing, before either
   side implements against it. The governing documents are the ADRs in
   `docs/architecture/` and `docs/design-system/components.md`; a contract
   change updates them in the same PR.
5. **No conflicting migrations.** Only one open PR at a time may add a
   migration. Announce it on the issue ("migration in flight: <name>") and
   rebase after the other team's migration merges; never edit a merged
   migration. Migration timestamps must be later than every migration on `main`.
6. **The application shell is shared.** `AppShell`, `Sidebar`, `Header`,
   `src/app/(app)/app/page.tsx` structure, tokens and `src/ui/paper/` change
   only through a design-system PR (`docs/design-system/contributing.md`).
7. **No duplicate shared components.** Use `@/ui/paper`; extend it by
   proposal; never copy a shared pattern into a module.
8. **Everything through pull requests**, using `docs/handover/szava/ACCEPTANCE_CHECKLIST.md`
   as the PR checklist.
9. **Shared components and shared libraries need the other team's review**:
   any change to `src/ui/`, `src/lib/{auth,rbac,tenant-db,audit,signatures,controlled-storage}.ts`,
   `src/lib/iam/`, `prisma/schema.prisma`, `prisma/migrations/`, the token
   files, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` or `docs/design-system/`.
10. **Both teams run the full suite** before asking for review:
    `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, and
    `npm run test:db` for any query, route, migration or role change.
11. **Production needs the owner.** Only the owner merges and releases.
    Production migrations and data changes run only with the owner's
    explicit yes, by Claude (`docs/FEATURES.md`); Száva's team never runs
    anything against production.

## Ownership map

| Area | Owner | The other team |
| --- | --- | --- |
| Tenant isolation, RLS, migrations framework, IAM, sessions, permissions catalogue | Claude | Reviews; requests changes by issue |
| Audit, electronic signatures (incl. the generalised signature target), controlled storage | Claude | Reviews |
| Relationship graph (VER-01): tables, taxonomy, traversal API | Claude | Consumes through the API; proposes new link types by issue |
| Shared workflow primitives (VER-02): record numbering, `QualityTask`, signature meanings | Claude | Consumes |
| Design system: tokens, `src/ui/paper/`, shell | Shared; changes by proposal | Both review |
| Modules assigned to Száva by issue (screens, module routes, module lifecycle) | Száva | Claude reviews |
| `docs/ROADMAP.md`, `docs/product/current-state.md`, `docs/FEATURES.md` | Whoever completes the item, in the same PR | |

The owner assigns modules by issue; this file does not pre-assign them.

## Day-to-day

1. Pick or receive an issue; comment "claimed" with your branch name.
2. If the work needs a contract that does not exist, propose it on the issue
   and wait for agreement.
3. Build on a branch from current `main`; keep the PR to one capability.
4. Before opening the PR: the full suite, the checklist, screenshots for UI.
5. Request review from the other team for anything in rule 9.
6. After merge, rebase any open branch onto `main` before continuing.

## Changing the design system

Proposal issue labelled `design-system` → agreement → one PR with
component, test, showcase specimen, docs and a migrated screen → review by
the other team → owner merges. Details: `docs/design-system/contributing.md`.
