# Isolated Neon Migration Rehearsal

Date: 2026-08-25
Candidate commit: `0d4442af30bde2c69b7087fdd7597aa14f8766f1`
Decision: `DEC-048`

## Isolation and cost controls

- Neon organization plan: **Free**.
- Project usage before creation: 2/10 branches, 0.04/0.5 GB storage, 1.49/100 CU-hours.
- Created `recovery-0d4442a` from the configured `staging` branch, not from `production`.
- Branch type: data and schema, current parent state.
- Auto-deletion: 2026-08-26 at 08:12 Europe/Prague time.
- Initial branch usage: 0 CU-hours, 0 kB storage delta, 0 kB network transfer as displayed immediately after creation.
- No paid plan, billing setting, production branch, Vercel resource, or application environment was changed.

## Clone baseline

The direct, non-pooled recovery endpoint was derived without printing or persisting a credential. A startup-enforced read-only transaction confirmed the clone matched the previously inventoried target:

- 43 public tables.
- 6 applied migrations.
- 3 documents.
- 1 IAM user and 1 membership.
- 9 permissions.
- 32 role-permission rows.

## Migration result

Applied only the six pending migrations from candidate `0d4442a`, in the checksum-fixed order from `TARGET-DATABASE-CHANGE-PLAN-2026-08-25.md`.

- All six applied successfully; total applied migration count is 12.
- Failed migrations: 0.
- Second `prisma migrate deploy`: no pending migrations.
- Prisma schema drift comparison: no difference detected.
- Permissions: 42 total, comprising 9 inherited legacy keys and all 33 canonical recovery keys.
- Role-permission rows: 90 total, comprising 32 inherited rows and 58 canonical assignments.
- `System Administrator` canonical assignments: 0.
- All other unrecognized/custom-role canonical assignments: 0.

## Document and tenant post-checks

- Null document numbers: 0.
- Null document-version authors: 0.
- Effective versions: 2, matching the two effective documents in preflight.
- IAM membership-to-organization and membership-to-operational-user tenant mismatches: 0.

## Membership-change rehearsal

The planned `System Administrator` to recognized tenant-administrator reassignment was rehearsed on the isolated branch inside one explicit transaction:

- Locked and matched active system memberships: exactly 1.
- Memberships changed: exactly 1.
- Sessions revoked: 0, matching the inventory.
- Resulting active canonical grants: 8.
- Transaction ended with `ROLLBACK`.
- Post-rollback system memberships: 1.
- Post-rollback active canonical grants: 0.

The first rehearsal query attempted to combine an aggregate with `FOR SHARE`; PostgreSQL rejected it before any update. The corrected version locks rows in a CTE and counts outside it. This corrected form is the only approved basis for the future controlled transaction.

## Remaining release gate

This proves branch isolation, migration compatibility with production-like data, idempotency, schema agreement, authorization exclusion, and transaction rollback. It does not prove a point-in-time restore of the live target, authorize the membership reassignment, or authorize live target migration. Owner attestation, protected application preview, negative end-to-end tests, environment-scope checks, and a live recovery-point/restore decision remain required.

Production remains **NO-GO**.
