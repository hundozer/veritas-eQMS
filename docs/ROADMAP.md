# Veritas Roadmap

Product: document and training control for small EU GMP life-sciences companies.
Development: Claude writes and self-reviews (see `docs/REVIEW.md`), the product owner
merges and signs each gate. Phases run in order; a phase starts only when the
previous gate has passed.

Full audit and rationale: "Veritas eQMS — Code Audit & Roadmap" (5 Oct 2026).

## Current phase: 2 — Training and validation pack

The owner started Phase 2 on 9 Oct 2026 with the Phase 1 gate not yet run in
production (DEC-074); the gate stays open and is run when a second person is
invited.

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
  Done (DEC-070): the static landing page and sign-in live at `/`
  (`src/app/(marketing)`), the workspace at `/app` (`src/app/(app)`), whose
  layout checks the session on the server before rendering. Workspace sections
  follow persisted permissions (`src/lib/workspace-access.ts`).
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
  `Tenant`, `User`, `IamOrganization` and `IamMembership` follow (DEC-069,
  migrations `20261008120000_identity_session_tenant` and
  `20261008130000_identity_row_level_security`): sessions carry their tenant,
  and sign-in lists an identity's memberships only through the narrow
  `veritas_identity_memberships` function. Identity-level tables (`IamUser`,
  `IamSession`, credential tokens, `IamAuditTrail`) and the shared role
  catalogue hold no tenant data and stay outside.
- Signature service with password re-entry; multiple signatures per version.
  Done (DEC-062): review completion and approval are signed with the signer's
  own password; each signature records signer, role, meaning, time and the
  SHA-256 signed; signatures are append-only (`src/lib/signatures.ts`,
  migration `20261007180000_electronic_signatures`). Failed signing attempts
  are limited to five per signer in 15 minutes (DEC-072,
  `src/db-tests/signing-attempt-limit.dbtest.ts`); login rate limiting stays
  in Phase 2.
- Release (`documents.release`), supersession, withdraw-revision, retire.
  Release and supersession done (DEC-064): a signed release (meaning
  `RELEASED`, never by the author) makes the approved version effective and
  supersedes the previously effective one in the same transaction
  (`/api/documents/[id]/release`, LIFE-T003 runs the gate path end to end).
  Withdraw-revision done (DEC-065): an open revision becomes `WITHDRAWN`, its
  review route is cancelled and the effective version stays in force; revision
  numbers are never reused (LIFE-T005). Retire done (DEC-066): obsoleting an
  effective document is a signed act (meaning `RETIRED`, reason required,
  recorded with the signature in the same transaction).
- Controlled copies default to the effective version; other versions watermarked.
  Done (DEC-067): the viewer and file download default to the effective
  version and serve it exactly as stored. Any other version is stamped on every
  PDF page (or at the top of a text file) as an uncontrolled copy of its status,
  with the version and who printed it when. A PDF that cannot be stamped is not
  served. Word, Excel and PowerPoint files cannot be stamped and are downloaded
  under an `UNCONTROLLED-<status>-` file name (`src/lib/controlled-copy.ts`).
- Client-direct signed uploads to Blob.
  Done (DEC-068): the browser uploads the file straight to private Blob storage
  with a presigned, write-only URL for a key the server reserved in the caller's
  tenant (`/api/documents/uploads`); creating, revising or replacing a draft then
  sends only that key and the SHA-256 the browser computed. The server reads the
  file back, refuses it if the hash differs, stores it under its controlled key
  and deletes the staging upload. Files up to 3 MB may still be sent inline if
  storage cannot be reached directly. Open: removing abandoned staging uploads.
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
Not yet run in production; deferred by the owner (DEC-074).

## Phase 2 — Training and validation pack (months 3–5)

- [x] Retraining assigned when a version becomes effective; "read and understood"
  signature; training matrix.
  Assignment done (DEC-073): a document names its training departments; when a
  version becomes effective, every active member of those departments is
  assigned that version in the release transaction, and open assignments on
  earlier versions are closed as `SUPERSEDED` (migration
  `20261009120000_training_on_effective_version`,
  `src/db-tests/training-on-effective.dbtest.ts`). "Read and understood"
  signature done (DEC-075): the trainee signs their own assignment with their
  password (`POST /api/trainings/[id]/sign`). Training matrix done (DEC-076):
  people × documents in the Training Hub for holders of `training.read_all`.
- [x] Audit review screen with field diffs and PDF export.
  Review screen done (DEC-077): each entry shows who, the field changes
  (before → after) and the recorded details (`src/lib/audit-review.ts`,
  `src/db-tests/audit-review.dbtest.ts`). PDF export done (DEC-078):
  `GET /api/audit/export` with the same filters, audited as `AUDIT_EXPORTED`.
- CI-generated URS, risk assessment, traceability matrix and executed OQ per
  release.
- MFA at login, login rate limiting, external penetration test.
  Login rate limiting done (DEC-079): 5 failed sign-ins per email or 20 per
  network address in 15 minutes, recorded in the identity audit trail
  (`src/db-tests/login-throttle.dbtest.ts`). Open: MFA; the penetration test is
  arranged by the owner.

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

- Invitation email in production (owner, 7 Oct 2026; taken up again 9 Oct 2026).
  `EMAIL_FROM` is set in Production to `Simpleafied Veritas
  <contact@simpleafied.app>` (9 Oct 2026); `simpleafied.app` must be verified in
  Resend. The separate administrator account `contact@simpleafied.app`
  (Organization Owner) was created in production on 9 Oct 2026 by
  `prisma/maintenance/2026-10-09-administrator-account.sql` (DEC-071), with the
  owner's approval; the owner then sets its password from a link requested at
  `/auth/setup-password`.

## Out of scope

Supplier management, equipment and calibration, regulatory intelligence and AI
mapping, quizzes with stored answer keys, ABAC engine, multi-product IAM.
