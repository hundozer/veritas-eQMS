# Phase 1.11 Self-Audit — Production Infrastructure Controls

Date: 2026-08-26
Result: **COMPLETE audit; FAIL release gate**

## Scope

Read-only audit of Vercel environment scoping, deployment protection, runtime,
headers and telemetry, plus Neon branch, checkpoint, network, connection,
database-role and controlled-content state. No production setting, credential,
database row, infrastructure object, or application source was changed.

## Security and tenancy

The generic Vercel alias is SSO-protected and protected APIs on the custom
domain require authentication. Remaining failures are an unverified generic
Preview database target, shared Preview credentials, missing global browser
security headers, public database reachability, unprotected production branch,
and an over-privileged application database role. No secret value was retrieved
or printed.

## GxP and data integrity

The database metadata remains intact, but all three document versions lack
controlled content. Production also lacks the Blob credential required for new
controlled-file writes. The product must not be represented as an operational
document-control system until storage is restored and verified.

## Verification

- Vercel environment names/types/scopes listed without values.
- Selected Vercel project settings and deployment targets inspected through the
  read-only API.
- Custom and generic production aliases checked externally for status and
  security headers.
- Neon projects/branches and checkpoint state listed read-only.
- Production database aggregate storage state, current role flags, and client
  transport parameters inspected without mutations.
- Source environment references and runtime contract inspected locally.

## Self-audit corrections

1. A shell glob in the first environment-reference scan had no matches and
   aborted that read-only command. It was rerun from `rg`'s repository file list.
2. The installed Neon CLI does not expose the older `endpoints list` command.
   Endpoint claims were limited to evidence available through branch/project
   metadata and the actual connection contract.
3. `SHOW ssl=off` was not misclassified as an unencrypted client connection;
   the URL independently proved `sslmode=require` and
   `channel_binding=require` through the Neon proxy.

## Traceability and residual risk

Decision `DEC-053`, risks `RISK-033`/`RISK-034`, the containment exit checklist,
and the infrastructure audit capture the findings. The phase is complete as an
audit, but its release gate fails. The next approved implementation step should
resolve the controlled-file dependency without incurring an unapproved cost.
