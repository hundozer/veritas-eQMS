# Veritas Roadmap (V3)

Product: connected quality management for small and mid-sized regulated
life-sciences organisations. Promise: **know what changed, know what it
affects, know what to do next** (`docs/product/vision.md`).

Roadmap V3 was set by the owner on 11 Oct 2026 (Product Strategy Reset,
DEC-091). It replaces the former Phases 3 and 4; Phases 0–2 and their evidence
are kept below as history. Status per capability: `docs/product/current-state.md`.
Work is tracked as GitHub issues, one per phase with sub-issues for P0 work.

Development: Claude and Száva develop; Claude self-reviews against
`docs/REVIEW.md`; the owner merges, releases and decides every gate.

## Order of work

1. Close critical VER-00 gaps.
2. Minimum viable relationship graph (contracts and versioning first).
3. Change control. 4. Deviations and CAPA. 5. First Quality Impact Map.
6. Evidence readiness. 7. Guided setup. 8. MVP release gate.
9. VER-06. 10. VER-07.

Phases are not built in parallel; a later phase may start once the contracts
it depends on are merged.

## VER-00 — Trust and operational foundation (P0, current)

- [ ] Invitation email live: verify the sending domain in Resend, run one real
      invitation end to end (code done, DEC-063).
- [ ] Password recovery for active accounts.
- [ ] Member role changes (audited, sessions re-checked).
- [ ] Member deactivation with immediate session revocation.
- [ ] Administrator session revocation; revocation on role change,
      deactivation and password reset.
- [ ] Organisation choice at sign-in for people with several memberships.
- [x] Tenant isolation (row-level security, two-tenant suite in CI).
- [x] Electronic-signature integrity (DEC-062, DEC-072).
- [ ] Document and training acceptance run in production (the former Phase 1
      gate, DEC-074).
- [x] Audit trail integrity (append-only, DEC-057).
- [ ] Backup and restore: documented procedure and an executed restore drill
      into a separate environment.
- [ ] Customer evidence export for documents and training (first slice of
      VER-04 packages).
- [ ] Validation-support documentation: intended use, supplier information,
      customer validation guidance (CI pack exists, DEC-081).
- [ ] Reconcile the August risk register against current code and deployment;
      external penetration test (owner arranges).
- [ ] Remove abandoned direct-upload staging objects (DEC-068).

**Gate:** a customer can administer its organisation, run controlled document
and training workflows, recover access, revoke access and retrieve
trustworthy evidence without developer intervention. No unresolved critical
security or data-integrity finding.

## VER-01 — Quality relationship graph (P0)

Typed, tenant-scoped, version-aware relationships between quality records:
`docs/architecture/quality-relationship-graph.md` (ADR-001, DEC-086).

- [ ] Node registry and link tables with taxonomy enforced in code and database.
- [ ] System-derived adapters for existing relations (training, versions).
- [ ] Bounded, cycle-safe, permission-aware traversal with paths.
- [ ] Link create / confirm / retire API with audit; two-tenant tests.
- [ ] `CONTROL` records and document → control mapping.

**Gate:** for an SOP revision, Veritas returns its training requirements,
control mappings and linked quality records, each with the reason it is
related, within the caller's permissions.

## VER-02 — Connected quality workflows (P0)

Change control, deviations, CAPA on shared primitives:
`docs/architecture/quality-workflows.md` (ADR-002, DEC-087).

- [ ] Shared primitives: record numbering, tasks with due dates, signature
      meanings per module.
- [ ] Change control lifecycle (extends the tenant-scoped `ChangeRequest`).
- [ ] Deviation and CAPA tables brought to tenant standard (composite keys,
      row-level security), then their lifecycles.
- [ ] Integrated scenario: deviation → investigation → CAPA → change control
      → SOP revision → training → effectiveness → closure.

**Gate:** the integrated scenario runs through real APIs and UI with
permission checks, linked evidence and automated integration tests.

## VER-03 — Quality Impact Map (P0, signature differentiator)

`docs/features/quality-impact-map.md` (ADR-003, DEC-088).

**Gate:** from an SOP revision, a QA manager runs an impact assessment,
reviews every finding, assigns follow-up and approves it with a signature as
retrievable evidence.

## VER-04 — Continuous evidence readiness (P0)

`docs/features/evidence-readiness.md` (ADR-004, DEC-089).

**Gate:** a QA manager finds a specific gap, resolves it through the right
workflow and exports a traceable evidence package.

## VER-05 — Guided quality system setup (P0, adoption)

`docs/features/guided-setup.md`.

**Gate:** a new organisation imports a small SOP library and gets a working
document and training environment without developer database work.

## Competitive MVP release gate

VER-00 to VER-05 passed, plus the conditions in `docs/product/mvp-scope.md`.
Merged code alone never makes the MVP commercially or regulatorily ready.

## VER-06 — Competitive expansion (P1)

Internal audits (programme, scheduling, scope, auditors, findings, evidence,
CAPA linkage, closure) and supplier quality (register, risk, qualification,
approval, requalification, supplier deviations, CAPA linkage), both on the
relationship graph and evidence readiness. Dormant tables `AuditPlan`,
`AuditFinding` and `Supplier*` are reviewed, not reused by default.

## VER-07 — Regulatory intelligence (P2)

Authoritative, versioned sources; documented applicability decisions;
human-reviewed interpretation; requirement → control and requirement → SOP
mapping; change impact; evidence coverage; traceable provenance. No automated
compliance determinations. Dormant `Regulation*` and `Requirement` tables are
reviewed; `TenantRequirementMapping` is not reused (ADR-001).

## Out of scope

Equipment and calibration, quizzes with stored answer keys, ABAC engine,
multi-product IAM, AI-generated findings without human review
(`docs/architecture/human-accountability.md`).

## History: Phases 0–2 (Roadmap V1/V2)

Kept as the record of completed work. The Phase 1 gate and the Phase 2 items
still open moved into VER-00. The former Phase 2 gate (pilots, independent QA
review of the validation pack) is part of the MVP release gate.

### Phase 0 — Unblock production (weeks 1–2)

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

### Phase 1 — Document control slice (months 1–3)

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

### Phase 2 — Training and validation pack (months 3–5)

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
- [x] CI-generated URS, risk assessment, traceability matrix and executed OQ per
  release.
  Done (DEC-081): every CI run builds the pack from
  `docs/validation/requirements.json` (28 requirements, each with its risk
  rating and verifying test IDs) and both test runs; the job fails when a
  requirement is not verified; the pack is a 90-day artifact
  (`docs/validation/README.md`).
- MFA at login, login rate limiting, external penetration test.
  Login rate limiting done (DEC-079): 5 failed sign-ins per email or 20 per
  network address in 15 minutes, recorded in the identity audit trail
  (`src/db-tests/login-throttle.dbtest.ts`). MFA done (DEC-080): everyone signs
  in with password and an authenticator code (`src/db-tests/mfa.dbtest.ts`).
  Open: the penetration test, arranged by the owner.

**Gate:** 1–3 paying pilots and an independent QA review of the validation pack.
