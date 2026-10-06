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
- [ ] Stay on free Vercel and Neon plans (owner decision, 5 Oct 2026); Blob
      connected in Production.
- [ ] Least-privilege application database role; audit tables INSERT/SELECT only,
      UPDATE/DELETE rejected by trigger.
- [x] Confirm whether `prisma/seed.js` ever ran against production (it writes a
      fabricated signature manifest); seed refuses to run in production.
      Confirmed 5 Oct 2026: it ran. Production holds the demo tenants "Acme Biotech"
      and "BioLabs Inc", their demo users, and the fabricated "CHARLIE-APPROVED"
      signature manifest. The owner's organisation is linked to "Acme Biotech".
- [ ] Move the owner's organisation off the demo seed tenant (DEC-056, "fresh
      start"): run `prisma/maintenance/2026-10-06-fresh-tenant.sql` in production.
      Demo tenants, their documents and both synthetic signature manifests stay as
      read-only history; nothing is deleted.
- [x] Security headers in `next.config.ts`; Node version pinned in `engines`.
- [x] Delete suppliers, equipment, regulatory intelligence, platform admin,
      Microsoft SSO, audit planning, and their containment tests. Code removed
      6 Oct 2026; their database tables and permission rows stay until a reviewed
      migration retires them.
- [ ] Postgres-backed test harness seeded with two tenants.

**Gate:** a synthetic SOP uploads and verifies in production, and the
application role cannot alter audit rows.

## Phase 1 — Document control slice (months 1–3)

- Split `src/app/page.tsx` into `(marketing)` and `(app)` route groups; the UI is
  gated by session permissions, never `User.role`.
- `tenantId` on every tenant-owned row, composite `(id, tenantId)` foreign keys,
  row-level security, two-tenant isolation suite in CI.
- Signature service with password re-entry; multiple signatures per version.
- Release (`documents.release`), supersession, withdraw-revision, retire.
- Controlled copies default to the effective version; other versions watermarked.
- Client-direct signed uploads to Blob.
- Audited provisioning script; password-setup emails wired.

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

## Out of scope

Supplier management, equipment and calibration, regulatory intelligence and AI
mapping, quizzes with stored answer keys, ABAC engine, multi-product IAM.
