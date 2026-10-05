# Blob OIDC Adapter Candidate

Date: 2026-08-26
Decision: `DEC-055`
Deployment status: not deployed

## Change

The controlled-storage credential gate now accepts either:

1. a non-empty legacy `BLOB_READ_WRITE_TOKEN`; or
2. the complete Vercel OIDC pair: `VERCEL_OIDC_TOKEN` and `BLOB_STORE_ID`.

Missing credentials and either partial OIDC configuration fail before any Blob
SDK operation. Private access, immutable object names, non-overwrite behavior,
tenant/document/version-scoped keys, hash verification, and cleanup behavior are
unchanged.

`BLOB_STORE_ID` is documented in `.env.example`. `VERCEL_OIDC_TOKEN` is not
added to the template because Vercel injects and refreshes it at runtime.

## Verification

- Focused storage/lifecycle/route suites: 35 tests passed.
- Full suite: 304 tests passed across 54 files.
- ESLint: zero errors; three pre-existing unrelated warnings.
- Next.js 16.2.11 production build: compilation and TypeScript passed; 38 routes
  generated.
- Diff check: passed.

## Release gate

The candidate must not be promoted until the existing private store is connected
to the Production environment through OIDC and a staged deployment proves a
synthetic private-object put, read/integrity check, and deletion. Production
currently remains on the prior containment deployment.
