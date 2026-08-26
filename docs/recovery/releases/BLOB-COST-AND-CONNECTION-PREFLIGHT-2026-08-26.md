# Blob Cost and Connection Preflight

Date: 2026-08-26
Decision: `DEC-054`
Mode: read-only

## Decision

**GO for a controlled OIDC-based repair using the existing store.** Do not
create a second store and do not copy the legacy long-lived Preview token into
Production.

## Cost evidence

The Vercel project reports the Hobby plan. Vercel's current Blob pricing states
that Hobby usage is free within its included limits and cannot incur additional
usage charges; Blob becomes unavailable after the limit is exceeded until the
usage window resets. Current included Blob limits are 1 GB-month storage,
10,000 simple operations, 2,000 advanced operations, and 10 GB data transfer.

This is a **zero-billing guarantee, not an availability guarantee**. Controlled
production use must monitor quota and fail closed when unavailable.

Official sources:

- https://vercel.com/docs/vercel-blob/usage-and-pricing
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/vercel-blob/private-storage

## Existing resource inventory

- Store: `veritas-controlled-records-staging`
- ID: `store_Q3WJg4gh8DDGzGT2`
- State: active
- Region: `fra1`
- Access: private
- Size/files: `0 B` / `0`
- Connected project: `veritas-e-qms`
- Production credential: absent
- Preview credential: Sensitive `BLOB_READ_WRITE_TOKEN`

The empty store can be reused without content migration. Its staging-oriented
name must not be treated as environment isolation; the project connection and
authentication scope are the actual controls.

## Authentication design

Vercel Blob supports short-lived Vercel OIDC authentication for newly connected
projects. The project has OIDC enabled and `@vercel/blob` is version `2.8.0`,
above the documented OIDC-capable minimum.

The application currently blocks OIDC before the SDK runs:
`requireStorageToken()` requires `BLOB_READ_WRITE_TOKEN` explicitly. The repair
must remove that long-lived-token-only assumption while retaining fail-closed
SDK errors and server-only storage access.

## Controlled implementation plan

1. Update the storage adapter and tests to permit Vercel Blob's OIDC path without
   weakening private access, tenant-scoped keys, integrity checking, or cleanup.
2. Run focused storage, document-route, full test, lint, and production-build
   gates.
3. Connect or upgrade the existing store/project relationship to OIDC for
   Production; do not expose or copy the Preview token.
4. Deploy a staged Production artifact and exercise a uniquely named disposable
   private object through put, head/get integrity, and delete.
5. Promote only if the disposable object is removed and the store returns to
   zero files; verify production error logs and database invariants.
6. Record quota monitoring and the Hobby exhaustion failure mode.

## Stop conditions

Stop before changing production if Vercel requires a paid plan, the store cannot
use private OIDC authentication, regional/data-processing approval is missing,
or verification would require customer data.
