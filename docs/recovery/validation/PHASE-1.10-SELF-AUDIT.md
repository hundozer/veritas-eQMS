# Phase 1.10 Self-Audit — Production Containment Cutover

Date: 2026-08-26
Result: **PASS for containment deployment; NO-GO remains for regulated use**

## Scope and diff

The phase performed the authorized production cutover: pause, recovery
checkpoint, migration, attested IAM reassignment, staged deployment, promotion,
smoke verification, and evidence updates. Application source was not edited.
The deployed application tree remains the reviewed candidate tree
`6de6f86983a193735526ddfd0be143204b46338d`.

## Security and tenancy

- Persistent database work ran only after quiescence and a fresh recovery
  checkpoint.
- IAM reassignment used exact-count assertions, row locks, a single transaction,
  session revocation, and post-commit checks.
- The final state has one active Owner membership, no active System
  Administrator membership, eight Owner canonical grants, no System
  Administrator canonical grants, and no live sessions.
- Unauthenticated protected endpoints fail closed with `401`.
- No secret values were printed or committed. A redacted-placeholder prebuild
  was detected by self-audit, rejected, and never promoted.

## GxP and data integrity

The migration post-state has 12 successful migrations and no drift. Document
and version counts remained three each. No regulated capability was re-enabled,
and this deployment does not establish validation or compliance readiness.

## Verification

- Production-clone rehearsal: nine migrations, idempotency, zero drift, stable
  data, and rolled-back IAM transaction passed before live work.
- Vercel remote build: Next.js 16.2.11 compilation and TypeScript passed; 38
  application routes were generated.
- Production smoke: root `200`; session/documents without authentication `401`;
  invalid login `401`; HSTS present; no candidate error-log entries.
- Neon post-audit: 12/0 migrations, 1/0 Owner/System Administrator active
  memberships, 33 canonical permissions, 8/0 canonical grants, 0 live sessions,
  and 3/3 documents/versions.

## Deviations and corrections

1. Vercel Sensitive values pulled locally were nested quoted placeholders. The
   initial parser missed this; a corrected parser proved the artifact unsafe.
   The artifact was rejected and replaced with a remote build.
2. Vercel project pause blocked production-target deployment creation. A bounded
   unpause with an exit trap created the remote candidate and restored pause.
3. Promotion implicitly resumed the project, so the custom domain returned
   `200` instead of the expected paused `503`. Immediate smoke and error-log
   gates passed; no rollback was required.
4. A first grant-count query included legacy permissions. The corrected
   canonical-ID query produced the expected 33, 8, and 0 counts.

## Documentation and residual risk

The cutover record, decision log, risk register, checklist, and recovery status
were updated. The rollback checkpoint remains time-limited. Security, privacy,
legal, validation, observability, operations, historical-data review, and
independent approval work still prevents regulated or general-availability use.
