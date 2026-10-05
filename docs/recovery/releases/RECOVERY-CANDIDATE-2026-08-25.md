# Recovery Candidate Evidence

Date: 2026-08-25
Branch: `codex/veritas-recovery`
Parent baseline: `ad7d0a1afff219ada6b445667c417db1d17d016e`
Decision: `DEC-047`

## Candidate scope

This candidate preserves the documented pre-recovery document-lifecycle work and regulatory reference files, then layers the completed containment and production-recovery controls through Phase 1.5. It intentionally removes the public test upload, dormant unsafe UI modules, legacy static permission registry, and false intelligence implementation documented in the phase evidence.

The three previously untracked regulatory PDFs under `EU GMP /` are inherited reference assets recorded in the Phase 0.1 baseline. They are preserved as pre-recovery work and are not attributed to Codex recovery implementation. Generated `.next`, dependencies, local environment files, and credentials are excluded.

## Candidate audit

- Branch confirmed as `codex/veritas-recovery`.
- Dirty-tree inventory reviewed before staging, including every modified, deleted, and untracked path.
- Deletions match documented containment scope; the quarantined test PDF remains preserved outside the public web root.
- Secret-pattern scan found no credential. Matches were limited to an empty `.env.example` placeholder and a synthetic test token.
- `.env`, `.env.local`, `.next`, and `node_modules` remain ignored.
- No generated build output is part of the candidate.
- Migration checksums are fixed in `TARGET-DATABASE-CHANGE-PLAN-2026-08-25.md`.

## Release gate

- Vitest: **300 passed** in **54 files**.
- Prisma schema validation: **passed**.
- TypeScript `--noEmit`: **passed**.
- ESLint: **0 errors**, **3 known warnings**.
- Production build: **passed**, **38 pages**, using a configured but deliberately unreachable localhost database URL; compilation made no database connection.
- Diff whitespace: **passed**.

## Known warnings

- `AppShell.tsx`: one existing raw-image optimization warning.
- `ModalProvider.tsx`: two existing unused suppression warnings.

These warnings do not weaken an access-control or data-integrity boundary. They remain visible rather than being silently auto-fixed during the release freeze.

## Release limitations

This commit is a reviewable candidate, not production authorization. The following remain mandatory: verified database restore, owner attestation for tenant-role reassignment, isolated migrated database, protected preview, environment-scope verification, end-to-end negative authorization evidence, controlled target migration, and explicit promotion approval.

Production remains **NO-GO**.
