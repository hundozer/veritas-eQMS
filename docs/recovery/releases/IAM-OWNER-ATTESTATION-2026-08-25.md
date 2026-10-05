# IAM Owner Attestation

Date: 2026-08-25
Scope: production recovery role disposition

The product owner explicitly attested that the sole active member currently
assigned the platform role `System Administrator` is authorized to be reassigned
to the existing tenant role `Organization Owner` during the controlled production
recovery.

This attestation authorizes only that role disposition within the reviewed,
atomic migration transaction. It does not authorize a production deployment,
database migration, traffic change, unrelated role change, or expansion of
permissions.

Execution remains conditional on all runbook preconditions:

- exactly one active membership is assigned `System Administrator`;
- exactly one existing `Organization Owner` role is available;
- the nine-migration production baseline and data preconditions have not drifted;
- application writers are stopped and a fresh recovery checkpoint is recorded;
- sessions for the affected membership are revoked in the same transaction;
- the transaction changes exactly one membership and results in exactly eight
  canonical grants for that membership;
- `System Administrator` and unknown roles retain zero canonical grants;
- any mismatch causes rollback and stops the release.

No person, tenant, membership, role, or database identifier is stored in this
repository evidence.
