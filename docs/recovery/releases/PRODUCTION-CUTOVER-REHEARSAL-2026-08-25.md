# Production Cutover Rehearsal

Date: 2026-08-25
Decision: `DEC-050`
Mode: read-only live discovery plus isolated production-clone execution

## Target correction

The earlier configured target was Neon `staging`. Vercel production-variable
values are intentionally non-decryptable after being stored as Sensitive, so
target identity was established without exposing a secret: Neon branch topology,
endpoint metadata, a single nonexistent-user production request, and read-only
transaction deltas correlated the public application with Neon `production`.
The request returned HTTP 500; production increased by five transactions while
staging increased only by the two expected probe connections.

Actual production had 43 public tables, 3 applied migrations, 0 failed
migrations, 3 documents, 3 versions, 1 active IAM user, 1 active membership,
9 permissions, 32 grants, 0 sessions, and 1 active membership on an unrecognized
role family. It was nine migrations behind the repository.

## Isolated rehearsal

- Parent: Neon `production`; immutable parent checkpoint LSN `0/2D999C0` at
  `2026-08-25T20:12:05Z`.
- Child: `cutover-rehearsal-1413fa2`, auto-expiring
  `2026-08-26T20:30:00Z`.
- Baseline: 3 migrations, 3 documents, 1 user, 1 membership.
- Applied the exact nine pending migrations in repository order using the direct
  endpoint.
- A second deploy reported no pending migrations.
- Prisma schema comparison reported no difference.
- Post-state: 12 migrations, 0 failed; 42 permissions including exactly 33
  canonical keys; 90 grants including 58 canonical grants; zero canonical grants
  for `System Administrator` or unknown roles.
- Document counts remained 3/3; all document numbers and version authors were
  backfilled; effective document/version counts remained 2/2.
- Reassignment from `System Administrator` to `Organization Owner` changed one
  membership and produced eight canonical grants inside a transaction that was
  explicitly rolled back. Zero sessions were present or retained.

## Recovery and cutover gate

The child branch proves an immediately usable copy-on-write recovery checkpoint
and migration compatibility. Before live execution, create a fresh checkpoint
immediately after traffic is stopped, record its LSN/timestamp, and retain it
through the rollback window. The application rollback unit is the prior Vercel
production deployment plus that database checkpoint; application-only rollback
after irreversible data use is prohibited.

Use a staged production deployment created with `--prod --skip-domain`, because
the tested Preview deployment contains Preview-scoped environment variables and
must never be promoted as if they were Production-scoped. Test the staged URL
under protection, then use `vercel promote` only after database postconditions
and explicit approval. Retain the previous production deployment identifier for
`vercel rollback`.

## Remaining blockers

- Accountable-owner attestation for the membership's least-privileged tenant role.
- Fresh live recovery checkpoint after writer quiescence.
- Production database migration and attested membership transaction.
- Staged Production-environment deployment and protected smoke tests.
- Explicit product/security/quality approval and promotion authorization.

Production remains **NO-GO**.
