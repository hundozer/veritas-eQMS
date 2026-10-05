# Phase 1.6 Self-Audit — Isolated Neon Migration Rehearsal

Date: 2026-08-25

## Scope and outcome

Create a cost-contained isolated branch of the configured target, apply the exact recovery candidate migrations, verify postconditions and idempotency, and rehearse the IAM membership transaction with rollback. Outcome: passed; source `staging` remains unchanged.

## Self-audit

- **Correct target:** mapped the configured endpoint to Neon project `veritasems`, branch `staging`; the branch was explicitly parented from `staging`, not the default `production` branch.
- **Isolation:** Neon confirmed a child branch and displayed its parent, unique endpoint, zero initial delta, and automatic deletion deadline.
- **Cost:** account is Free and branch use moved within the included 10-branch allowance. No upgrade or billing control was touched. Compute/storage consumption remains subject to Free-plan quotas, so no claim is made about future provider policy.
- **Secrets:** neither connection URL nor password was printed, committed, copied into a repository file, or retained in evidence. Migration used the direct endpoint required by Neon guidance.
- **Migration integrity:** the six reviewed migrations applied in order; idempotent redeploy and zero-drift comparison passed.
- **Authorization:** exactly 33 canonical keys and 58 canonical assignments exist; platform/unknown roles received zero. The active system membership remains unchanged after the rollback-only rehearsal.
- **Data integrity:** source counts matched before migration; document backfill, tenant-link, and author postconditions passed.
- **Deviation handling:** the invalid aggregate-lock query failed before mutation. The corrected row-lock CTE pattern succeeded and was explicitly rolled back.
- **Source safety:** all writes were confined to the auto-expiring recovery branch. No write command used the `staging` URL.
- **Production safety:** no application deployment, Vercel environment, domain, public alias, storage, or production database was changed.

## Evidence summary

- Clone: 43 tables, 6 migrations, 3 documents, 1 IAM membership, 9 permissions, 32 grants.
- Migrated: 12 migrations, 33/33 canonical keys, 58 canonical assignments, 0 platform/unknown grants.
- Rehearsal: 1 membership changed, 8 resulting grants, explicit rollback, original state restored.
- Detailed evidence: `ISOLATED-NEON-MIGRATION-REHEARSAL-2026-08-25.md`.

## Decision and residual risk

- Decision: `DEC-048`; updated risks: `RISK-013` and `RISK-032`.
- Next phase: push the exact candidate and create a protected Vercel preview connected only to this recovery branch, then execute browser/API/database negative authorization tests. Owner attestation remains required before retaining any membership reassignment or touching the live target.

Closure status: **closed for isolated migration rehearsal**. Production remains **NO-GO**.
