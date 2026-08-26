# Veritas Recovery Programme

This directory contains the controlled planning and evidence records for the
Veritas product recovery. Recovery work is performed in numbered phases. A
phase is complete only when its documented exit criteria are satisfied.

## Working rules

1. Preserve pre-recovery work and identify it separately from recovery changes.
2. Address security, tenant isolation, data integrity, and regulatory claims
   before expanding product functionality.
3. Link requirements, risks, implementation changes, tests, deviations, and
   release decisions.
4. Keep regulated controls server-side and fail regulated mutations when their
   mandatory audit evidence cannot be persisted.
5. Do not describe the product as certified, verified, immutable, or
   inspection-ready without approved, objective evidence supporting the exact
   claim.
6. Complete and record a self-audit before closing every recovery step.

## Mandatory step self-audit

Every recovery step must include the following checks:

1. **Scope:** confirm the change addresses only the approved step and identify
   any incidental changes.
2. **Diff:** inspect every changed line and confirm pre-existing work was not
   overwritten or silently reformatted.
3. **Security and tenancy:** assess authentication, authorization, tenant
   isolation, input handling, secrets, and failure behavior affected by the
   change.
4. **GxP and data integrity:** assess attribution, auditability, record history,
   lifecycle sequencing, retention, and failure atomicity where applicable.
5. **Verification:** run proportionate automated tests, lint, type/build checks,
   and focused negative tests. Record commands and results.
6. **Documentation and traceability:** update decisions, risks, requirements,
   tests, deviations, and evidence affected by the change.
7. **Residual risk:** state what remains unresolved and whether it prevents the
   step's exit criteria from being satisfied.

A step may be marked complete only when all applicable checks pass or a failed
check is documented as an approved deviation. Codex self-audit is an internal
quality control and does not replace required independent legal, security, or
GxP review.

## Evidence structure

- `baseline/`: repository and verification state at recovery entry.
- `decisions/`: product and architecture decision log.
- `risks/`: product, security, privacy, and GxP risk records.
- `requirements/`: intended use, scope, and traceable requirements.
- `validation/`: protocols, results, deviations, and summary reports.
- `releases/`: controlled release records and approvals.

## Current phase

Phase 0 repository containment is complete as of 2026-08-25. See
`validation/PHASE-0.38-SELF-AUDIT.md` and
`releases/CONTAINMENT-EXIT-CHECKLIST.md`.

The containment candidate was deployed to production on 2026-08-26 after the
controlled migration, IAM, rollback, remote-build, and smoke gates passed. See
`releases/PRODUCTION-CUTOVER-2026-08-26.md` and
`validation/PHASE-1.10-SELF-AUDIT.md`.

Regulated customer use, a customer pilot, general availability, and compliance
claims remain **NO-GO** until the checklist's historical-review,
infrastructure, legal/privacy, security, validation, operational, and
independent-approval gates have objective evidence.
