# Production Readiness Preflight — Vercel

Date: 2026-08-25
Mode: read-only
Decision: **NO-GO**

## Executive finding

The linked Vercel project is not running the contained recovery repository in production. The public production aliases serve an older pre-containment deployment. Direct promotion or deployment is prohibited until the source, database, environment, preview, and rollback gates below are satisfied.

## Verified deployment state

- Vercel project: `veritas-e-qms`, Next.js, Node.js 24.x.
- Project status returned `live: false`.
- Latest deployment was a ready preview created 2026-08-14; it was not a production target.
- Current ready production deployment was created 2026-07-27 from commit `4d75353`.
- Public aliases include `veritas.simpleafied.eu` and Vercel project aliases.
- A direct read of the current production alias returned HTTP 200 and visibly contained pre-containment onboarding, verified/compliant, real-time latency, immutable-ledger, inspection-ready, guarantee, electronic-signature, and export claims.
- A 2026-08-12 production attempt from commit `2514bbf` failed during `npm install`: `prisma generate` imported `prisma.config.ts`, which rejected missing `DATABASE_URL`.
- Seven-day grouped runtime evidence contained nine historical Prisma initialization failures on `/api/users`, affecting seven users; the database endpoint was unreachable. The last recorded occurrence was 2026-08-23 on the July 27 production deployment.
- Recent ready previews are not proven to contain the final recovery working tree.

## Repository/release state

- Recovery branch: `codex/veritas-recovery`.
- HEAD is still the 2026-08-14 commit `ad7d0a1`; recovery work is uncommitted.
- Working tree preflight count: 69 modified, 56 untracked, and 5 deleted paths.
- `package-lock.json` is tracked; environment and `.vercel` files are correctly ignored.
- No committed GitHub Actions workflow, `vercel.json`, deployment script, preview test gate, promotion gate, or rollback evidence exists.
- No `.env.example` existed; Phase 1.1 adds a secret-free contract.

## Environment contract

| Variable | Classification | Production requirement |
| --- | --- | --- |
| `DATABASE_URL` | secret | Required for build-time Prisma configuration and runtime PostgreSQL access. Preview/staging/production must use separate databases. |
| `BLOB_READ_WRITE_TOKEN` | secret | Required for controlled document storage. Must be environment-scoped and private. |
| `APP_ORIGIN` | sensitive configuration | Required only if credential setup/reset email delivery is enabled; production must be HTTPS and exact-origin approved. |
| `RESEND_API_KEY` | secret | Conditional with credential email delivery; currently no active route invokes delivery. |
| `EMAIL_FROM` | configuration | Conditional with credential email delivery; domain ownership and processor approval required. |
| `NODE_ENV` | platform | Supplied by runtime/build; controls secure cookies and database logging behavior. |
| `VERCEL_OIDC_TOKEN` | platform/local ephemeral | Not an application requirement; do not store as a long-lived application secret. |

Variable names were inspected; secret values were not printed, copied, or changed. The connected project capability did not expose environment-variable inventory, so target-environment presence/scope remains unverified.

## Cheapest safe release sequence

1. Preserve and review the recovery working tree, then create one controlled commit (or a small reviewed commit series) on `codex/veritas-recovery`.
2. Fix the build/install configuration so `npm ci` and `prisma generate` have a documented, reproducible configuration boundary without requiring production database access.
3. Execute the full active migration lineage on disposable PostgreSQL and retain output; do not touch production yet.
4. Inventory Vercel production/preview environment variable names and scopes without retrieving values; correct missing or cross-environment bindings under approval.
5. Deploy the exact reviewed commit to a protected preview, never directly to production.
6. Run browser/API negative authorization, disabled-route, storage, migration, and smoke tests against preview.
7. Establish a rollback candidate and database rollback/recovery decision; promotion must use the already-tested preview artifact.
8. Only after independent release approval, promote the tested artifact and immediately verify aliases, runtime errors, database connectivity, caches, and kill switches.

## Immediate containment recommendation

Because an old unsafe build remains publicly reachable, the owner should decide under change control whether to temporarily disable or restrict public production traffic before the recovery release. This preflight did not alter traffic, aliases, protection, or deployments.
