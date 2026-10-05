# Phase 0.6 Self-Audit — Public Record Exposure Containment

Date: 2026-08-23

## Scope and intended outcome

Inventory repository files served directly from `public/`, remove document-like test records from the unauthenticated web boundary without destroying evidence, and prevent accidental reintroduction. This step does not assert that a deployed copy or CDN cache has been purged.

## Change review

- Inventoried every file under `public/`; found five standard SVG assets and one PDF under `public/uploads/`.
- Confirmed no application or Prisma reference to the PDF or legacy uploads path.
- Preserved the PDF byte-for-byte under `docs/recovery/evidence/quarantined-public-files/` and recorded its SHA-256 and provenance.
- Removed the empty `public/uploads/` directory.
- Added `PUBLIC-ASSET-T001` and `PUBLIC-ASSET-T002` to reject the legacy directory and document/data/archive/text extensions under the public web root.

## Security, tenancy, privacy, and data-integrity audit

- **Public exposure:** the repository build can no longer serve the quarantined artifact at its former public path.
- **Tenant isolation:** no document-like file remains in a boundary that bypasses tenant authorization.
- **Data integrity:** the original bytes were retained; the recorded SHA-256 is `fbcb2e570fcc70466754bbf38828eda34cfeb7bd6c051a323b892d15813e25ad`.
- **Controlled delivery:** the current document PDF route requires authentication and `documents.read`, checks tenant ownership, resolves server-side storage metadata, verifies hashes, and uses `private, no-store`.
- **Privacy:** content inspection found no extractable text, but absence of text does not establish absence of sensitive image content.
- **Auditability:** quarantine provenance and disposition are recorded; historical public access cannot be reconstructed from this repository.

## Verification evidence

- Focused public-asset tests: **2 passed** in 1 test file.
- Full Vitest suite: **186 passed** in 22 test files.
- TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Diff whitespace check (`git diff --check`): **passed**.
- Quarantine hash: **matched** the pre-move SHA-256.
- Final public inventory: **five SVG application assets only**; no prohibited record extension and no `uploads/` directory.
- Reference scan: **no former file/path reference outside recovery evidence**.

## Traceability

- Decision: `DEC-010`.
- Risk: `RISK-011`.
- Tests: `PUBLIC-ASSET-T001`, `PUBLIC-ASSET-T002`.
- Evidence: `PUBLIC-FILE-QUARANTINE-2026-08-23.md` and retained PDF.

## Residual risk and closure judgment

- Previously deployed builds, browser/CDN caches, logs, backups, and object storage are outside this repository-only containment.
- The artifact may contain rasterized content even though text extraction returned nothing; legal/privacy classification remains open.
- The extension denylist is a guardrail, not a content-classification or secret-scanning system.
- Git history still contains the file. Rewriting history is destructive and was not performed.

Closure status: **closed for repository containment**. External deployment, cache, access-history, and privacy-classification checks remain open and must be resolved before a production-readiness claim.
