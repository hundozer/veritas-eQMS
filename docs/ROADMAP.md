# Veritas Roadmap

Product: document and training control for small EU GMP life-sciences companies.
Development: Claude writes and self-reviews (see `docs/REVIEW.md`), the product owner
merges and signs each gate. Phases run in order; a phase starts only when the
previous gate has passed.

Full audit and rationale: "Veritas eQMS — Code Audit & Roadmap" (5 Oct 2026).

## Current phase: 0 — Unblock production

## Phase 0 — Unblock production (weeks 1–2)

- [x] Obsoleting a document no longer retires the effective version while a
      revision is open.
- [x] Stay on free Vercel and Neon plans (owner decision, 5 Oct 2026); Blob
      connected in Production. Store `veritas-controlled-records-staging` (private,
      fra1) is linked to Production via OIDC and `BLOB_STORE_ID` is set (7 Oct 2026).
      The storage precheck now accepts the per-request OIDC token on Vercel; the
      owner created "Phase 0 upload test sop" in production on 7 Oct 2026.
- [x] Least-privilege application database role; audit tables INSERT/SELECT only,
      UPDATE/DELETE rejected by trigger (DEC-057). Production, 6–7 Oct 2026:
      migration `20261006120000_audit_append_only` applied and verified (owner
      UPDATE/DELETE refused); `veritas_app` created and verified (no audit
      UPDATE/DELETE, no DDL, no migration ledger); Production `DATABASE_URL`
      switched to `veritas_app` and redeployed.
- [x] Confirm whether `prisma/seed.js` ever ran against production (it writes a
      fabricated signature manifest); seed refuses to run in production.
      Confirmed 5 Oct 2026: it ran. Production holds the demo tenants "Acme Biotech"
      and "BioLabs Inc", their demo users, and the fabricated "CHARLIE-APPROVED"
      signature manifest. The owner's organisation is linked to "Acme Biotech".
- [x] Move the owner's organisation off the demo seed tenant (DEC-056, "fresh
      start"): run `prisma/maintenance/2026-10-06-fresh-tenant.sql` in production.
      Done 6 Oct 2026.
      Demo tenants, their documents and both synthetic signature manifests stay as
      read-only history; nothing is deleted.
- [x] Security headers in `next.config.ts`; Node version pinned in `engines`.
- [x] Delete suppliers, equipment, regulatory intelligence, platform admin,
      Microsoft SSO, audit planning, and their containment tests. Code removed
      6 Oct 2026; their database tables and permission rows stay until a reviewed
      migration retires them.
- [x] Postgres-backed test harness seeded with two tenants (`npm run test:db`,
      `src/db-tests/`): real routes, real sessions, application database role.

**Gate:** a synthetic SOP uploads and verifies in production, and the
application role cannot alter audit rows.
Passed 7 Oct 2026. "Phase 0 upload test sop" (SOP-D07EC5C4) uploaded in
production; its version and `DOCUMENT_CREATED` audit row hold the same SHA-256,
and the viewer served the stored object after recomputing that hash. Audit
protection was verified on 6 Oct 2026.

## Phase 1 — Document control slice (months 1–3)

- Split `src/app/page.tsx` into `(marketing)` and `(app)` route groups; the UI is
  gated by session permissions, never `User.role`.
- `tenantId` on every tenant-owned row, composite `(id, tenantId)` foreign keys,
  row-level security, two-tenant isolation suite in CI.
  Done for the document and training tables (DEC-059): migration
  `20261007120000_tenant_scoped_document_rows`, `src/db-tests/tenant-scoped-keys.dbtest.ts`.
  The suite runs in CI on every pull request and push to `main`
  (`.github/workflows/ci.yml`, with a migration drift check).
  Row-level security on the document, training, notification and audit tables
  (DEC-060): migration `20261007140000_tenant_row_level_security`,
  `src/lib/tenant-db.ts`, `src/db-tests/row-level-security.dbtest.ts`.
  `ChangeRequest` and `ChangeRequestDocument` carry `tenantId` with composite
  keys and row-level security (DEC-061, migration
  `20261007160000_tenant_scoped_change_requests`).
  Open: row-level security for `User`, `Tenant` and IAM tables (read during
  sign-in, before the tenant is known).
- Signature service with password re-entry; multiple signatures per version.
  Done (DEC-062): review completion and approval are signed with the signer's
  own password; each signature records signer, role, meaning, time and the
  SHA-256 signed; signatures are append-only (`src/lib/signatures.ts`,
  migration `20261007180000_electronic_signatures`). Open: rate limiting of
  failed signing attempts, with login rate limiting in Phase 2.
- Release (`documents.release`), supersession, withdraw-revision, retire.
  Release and supersession done (DEC-064): a signed release (meaning
  `RELEASED`, never by the author) makes the approved version effective and
  supersedes the previously effective one in the same transaction
  (`/api/documents/[id]/release`, LIFE-T003 runs the gate path end to end).
  Open: withdraw-revision, retire.
- Controlled copies default to the effective version; other versions watermarked.
- Client-direct signed uploads to Blob.
- Audited provisioning script; password-setup emails wired.
  Done in the application rather than as a script, because the owner works
  from an iPad (DEC-063): a holder of `users.create` (a separate administrator
  account) invites a person with one organisation role; identity, user, membership and audit rows
  are written in one transaction; the person sets their own password from a
  single-use 30-minute emailed link (`src/lib/iam/provisioning.ts`,
  `/auth/setup-password`, `src/db-tests/provisioning.dbtest.ts`).
  Code done; going live is parked in the backlog (see Backlog).

**Gate:** an SOP goes draft → signed → effective → superseded in production, and
the isolation suite passes.

## Phase 2 — Training and validation pack (months 3–5)

- Retraining assigned when a version becomes effective; "read and understood"
  signature; training matrix.
- Audit review screen with field diffs and PDF export.
- CI-generated URS, risk assessment, traceability matrix and executed OQ per
  release.
- MFA at login, login rate limiting, external penetration test.

**Gate:** 1–3 paying pilots and an independent QA review of the validation pack.

## Phase 3 — Quality events (months 6–9)

- Deviation and CAPA on the shared signature, audit and isolation services.
- Change control as part of document revision, linked to CAPA.

**Gate:** pilots renew, and at least two contracts ask for quality events.

## Phase 4 — Customer-driven (months 9–12)

- SAML/OIDC SSO, self-service onboarding, periodic review reminders.
- Anything else only when a signed contract asks for it.

## Backlog

Parked by the owner; not part of any phase gate until taken up again.

- Invitation email in production (owner, 7 Oct 2026). Set `EMAIL_FROM` in
  Production to a sender on a domain verified in Resend (the first value was
  wrong and was removed from Production), then create the owner's separate
  administrator account (Organization Owner role, DEC-063) with a reviewed
  maintenance step. Until then invitations are refused and nothing is created.

## Out of scope

Supplier management, equipment and calibration, regulatory intelligence and AI
mapping, quizzes with stored answer keys, ABAC engine, multi-product IAM.
