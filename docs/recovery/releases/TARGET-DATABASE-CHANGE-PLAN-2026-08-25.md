# Target Database Change Plan

Date: 2026-08-25
Status: corrected after live-target discovery; planned, not authorized for execution
Decision: `DEC-046`, superseded in target selection and migration count by `DEC-050`

> **Production-target correction (Phase 1.8):** the database originally inventoried
> here was the configured `staging` branch. Read-only Vercel/Neon correlation later
> established that the public production application uses Neon's distinct
> `production` branch. That live branch has 3 applied migrations, not 6. The
> controlled production change therefore consists of the 9 migrations below.
> Earlier six-migration evidence remains valid for staging only and must not be
> used to authorize production.

## Objective

Move the actual production target from its three-migration baseline to the reviewed 12-migration repository lineage without losing recoverability or granting tenant access to platform/unknown roles. This plan does not itself authorize a database write.

## Fixed migration artifact

Apply only these pending migrations, in this order, from a reviewed commit:

| Order | Migration | SHA-256 |
| --- | --- | --- |
| 1 | `20260813000000_link_iam_membership_operational_user` | `35b2c206cdeef326e7b7381418096fa08c0450e6efee90ad925bb08fbef821c1` |
| 2 | `20260813213000_add_audit_actor_attribution` | `c25cad70c7a7e48b8438a92a6a0ebb00abaf44e2b1987dc250885aad18851a79` |
| 3 | `20260813224500_add_controlled_record_storage` | `b5092341e99a51b6f79b1ab7ad6f9922c4b469dd679782ecc7c80dea69a4f6a3` |
| 4 | `20260814060000_add_document_lifecycle` | `9004972bed90bdbae929ba1754cf1cc6ed00517ceed9fc6c0e945aaeeffb650c` |
| 5 | `20260824130000_seed_canonical_iam_permissions` | `34d2f79c2a6f32288b99288ed32e6ea42c9c44c88e913bb7199f925bcbe138dd` |
| 6 | `20260824140000_add_equipment_read_permission` | `e50819280517490a4c4454c0b4dc0aa8b7d35deb7c4b36dc412b9d3dabd2b9e7` |
| 7 | `20260824150000_add_supplier_read_permission` | `873b959002c593a2736277444e0af942ab8b5ef2822654d12e607fe520f46f35` |
| 8 | `20260824160000_add_notification_read_own_permission` | `c9809b7f96a514ac5562c67f4fa32069e9c653f690fa09fa017d7c8d3a6050d2` |
| 9 | `20260824170000_add_audit_plan_read_permission` | `37b67a3bc361661e5a7a3412b3af875471c2ba04085fbc779d5cb01a2b77c5da` |

Stop if any checksum, migration name, ordering, reviewed commit, or target baseline differs.

## Target preflight evidence

- Actual production registered state: 3 applied, 0 failed, 0 rolled back; latest is `20260812184058_add_iam_credential_action_tokens`.
- Document backfill population: 3 documents, 3 versions, 0 approval steps.
- Backfill collision/orphan/current-version checks: all zero.
- Effective documents: 2; neither has multiple versions.
- IAM: 33 canonical keys absent; 32 legacy grants exist.
- Active membership: one, assigned to system role `System Administrator`, with four legacy uppercase grants.
- Recognized role families already available: tenant administrator, quality manager, employee, and auditor.

## IAM disposition

1. Do **not** add `System Administrator` to any migration alias and do not assign it canonical tenant permissions. A platform role must not become tenant authority by name inference.
2. **Attested 2026-08-25:** the accountable product owner confirmed that the sole active member is authorized for the existing `Organization Owner` tenant role. Evidence: `IAM-OWNER-ATTESTATION-2026-08-25.md`.
3. Reassign the existing membership to the existing `Organization Owner` role in one controlled transaction. No other target role is authorized by this attestation.
4. Record old/new role identifiers only in restricted change evidence. Do not store user identity or database identifiers in this repository.
5. Revoke existing sessions in the same transaction. The current inventory shows zero sessions, but the execution must recheck under lock.
6. Do not delete the platform role or its legacy grants in this release. Quarantine and redesign global/platform role ownership separately.

## Gate A — recoverability

All items must be evidenced before execution:

1. Identify the database owner and authorized executor.
2. Establish the provider's current backup/PITR retention and the exact recovery timestamp or immutable backup identifier immediately before change.
3. Restore that backup to an isolated database and prove it opens, has the expected 3 applied migrations and 43 tables, and passes the aggregate tenant/IAM integrity checks.
4. Record restore duration and set the maintenance/rollback window longer than that measured duration.
5. Confirm the application can be pointed back to the restored database without rebuilding a different artifact.

A backup without a successful isolated restore test does not pass this gate.

## Gate B — exact release candidate

1. Preserve the recovery working tree in a reviewed `codex/` commit; record commit SHA.
2. Re-run the full test, schema, type, lint, build, disposable-migration, and checksum gates from that commit.
3. Create a protected preview using the exact commit and an isolated restored/branched database—not the live target.
4. Apply the nine fixed migrations to that isolated database.
5. Execute the approved membership disposition there.
6. Verify positive access for the approved tenant role and negative access for platform, unknown, missing-permission, unauthenticated, and cross-tenant cases.
7. Obtain product/security/quality release approval on the evidence.

## Gate C — controlled target execution

1. Announce a maintenance window and stop application traffic/background writers.
2. Re-run the minimized read-only baseline; stop on drift, failed migrations, active sessions, changed IAM population, or changed document preconditions.
3. Capture and verify the recovery point.
4. Verify the executor is connected to the intended target without printing credentials.
5. Apply only the reviewed commit's migrations through `prisma migrate deploy`; capture sanitized output and timestamps.
6. In a separate reviewed transaction, lock the exact membership and role rows, verify the attested pre-state, perform the approved role reassignment, and revoke sessions. Stop and roll back on any mismatch.
7. Run post-change checks before restoring traffic.

## Required post-change checks

- Exactly 12 migrations applied; zero failed or rolled back.
- Exactly 33 canonical permission names, each unique.
- Exactly one each of the document lifecycle columns/indexes/foreign key created by migration 1.
- Document counts unchanged; all 3 versions have an author; exactly 2 effective documents produce exactly 2 effective versions.
- No generated document-number collisions and no tenant-link/orphan-grant mismatches.
- `System Administrator` has zero canonical tenant grants.
- Unknown/custom roles gained zero canonical grants.
- The approved tenant role matches the canonical matrix; all legacy/excess grants are reported separately.
- No live pre-change sessions remain.
- Protected smoke tests and negative authorization tests pass before public traffic.

## Rollback decision

Stop traffic and restore the captured database/application pair if any migration fails ambiguously, post-check count differs, role disposition differs from attestation, platform/unknown role gains a canonical permission, tenant isolation fails, or the application cannot complete login and permitted document reads.

Do not manually drop the new columns/indexes or delete permission rows as an emergency rollback. Migration 1 backfills regulated record metadata, and IAM assignments may become referenced operational state. Database restore is the approved rollback. Preserve the failed database for restricted investigation.

## Current gate status

- Artifact definition and preconditions: **complete**.
- IAM disposition policy and owner attestation: **complete**.
- Verified backup/PITR restore: **pending**.
- Reviewed recovery commit: **pending**.
- Isolated migrated preview and authorization evidence: **pending**.
- Target execution: **not authorized**.

Production remains **NO-GO**.
