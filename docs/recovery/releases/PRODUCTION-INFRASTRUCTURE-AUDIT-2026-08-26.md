# Production Infrastructure Controls Audit

Date: 2026-08-26
Decision: `DEC-053`
Mode: read-only

## Decision

**FAIL for general availability and regulated use.** The containment deployment
may remain online for controlled internal recovery, but infrastructure controls
are incomplete and the core controlled-file path is not operational.

## Vercel findings

| Control | Result | Evidence |
| --- | --- | --- |
| Production artifact | Pass | `dpl_2CpveUu4o2cV9XpYAsCcap1sTh96` is READY/PROMOTED and tied to recovery tree metadata. |
| Generic deployment protection | Pass | The Vercel production alias redirects to team SSO (`302`). |
| Custom-domain protection | Expected public boundary | `ssoProtection.deploymentType=all_except_custom_domains`; the custom domain is public by design. Application authentication remains mandatory for protected APIs. |
| Secret visibility | Pass | Listed values are Sensitive/Hidden; no value was pulled or printed. |
| Core environment scope | Partial | `APP_ORIGIN`, `DATABASE_URL`, `ADMIN_PASSWORD`, and `JWT_SECRET` are Production-only. The latter two have no runtime references in the containment tree. |
| Preview isolation | Fail | The recovery branch has an explicit Preview `DATABASE_URL`, but an older generic Preview `DATABASE_URL` remains and its target is unverified. Azure and Resend credentials are shared with Preview. |
| Controlled storage | Fail | `BLOB_READ_WRITE_TOKEN` exists only in Preview, while production document create/revision and Blob-backed retrieval require it. |
| Credential email | Fail | Production has `APP_ORIGIN` and `RESEND_API_KEY` but no `EMAIL_FROM`; credential email fails closed. |
| Runtime consistency | Fail | Vercel project runtime is Node `24.x`; CLI/build tooling logged Node `20.17.0`; `package.json` has no `engines` contract. |
| Security headers | Fail | Custom root has HSTS, but no observed CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or `Permissions-Policy`. |
| Web telemetry | Fail | Vercel Web Analytics is disabled and no approved production monitoring evidence exists. |

The Vercel API reports `paused=true` while the promoted custom domain returns
`200`. The flag therefore cannot be used as a traffic-state monitor without an
external HTTP check.

## Neon findings

| Control | Result | Evidence |
| --- | --- | --- |
| Exact target | Pass | Project `steep-meadow-61507302`, branch `production` (`br-purple-violet-asr1r7at`). |
| Recovery point | Pass, time-limited | Checkpoint `br-lingering-mountain-as66t7my` is ready and expires `2026-08-28T20:30:00Z`. |
| Connection contract | Pass | Pooled application hostname with `sslmode=require` and `channel_binding=require`. |
| Production branch protection | Fail | Production is default/primary but `protected=false`. |
| Network restriction | Fail | Public connections are allowed and the project IP allow list is empty. |
| Application database role | Fail | Runtime connects as `neondb_owner`; it is not superuser but has `CREATEDB`, `CREATEROLE`, and `BYPASSRLS`. |
| Data/storage state | Fail for product operation | Three versions exist; zero are Blob-backed, zero contain legacy inline bytes, and all three lack controlled content. |
| Database observability | Not available here | Neon skill guidance states Postgres compute logs are not currently emitted by the branch logging interface in this region. |

`SHOW ssl=off` was not treated as proof of cleartext transport because Neon
terminates the client TLS boundary through its proxy; the connection contract
itself requires TLS and channel binding.

## Cost-efficient remediation order

1. Restore the controlled-file dependency using an existing Vercel Blob store
   or explicitly keep document writes disabled; do not create a paid store
   without a cost check.
2. Remove or map the generic Preview database variable and remove unused
   Preview/Production credentials after dependency confirmation.
3. Add a least-privileged application database role and rotate Production
   `DATABASE_URL`; rehearse on a Neon child branch first.
4. Add application security headers and pin one supported Node version across
   local, build, and runtime environments.
5. Evaluate free-plan availability for branch protection and network controls;
   document any plan-limited compensating control rather than silently upgrading.
6. Implement the approved observability controls and independent verification.

## Release boundary

This audit does not authorize customer access, regulated reliance, or a
compliance claim. `RISK-033` and `RISK-034` remain open.
