# Production Containment Cutover

Date: 2026-08-26
Candidate commit: `8c236969e852ebafa46a3158d725f95386fe2ff4`
Application tree: `6de6f86983a193735526ddfd0be143204b46338d`
Decision: `DEC-052`

## Outcome

The repository containment candidate is live at `https://veritas.simpleafied.eu`.
This cutover replaces the unsafe July deployment; it does not authorize a
regulated customer pilot, a compliance claim, or re-enablement of contained
capabilities.

## Recovery controls

- Vercel production was paused before persistent database changes.
- A fresh Neon recovery checkpoint was created from production:
  `prod-cutover-checkpoint-20260825`, branch
  `br-lingering-mountain-as66t7my`, parent `br-purple-violet-asr1r7at`, LSN
  `0/2DE3770`, expiring `2026-08-28T20:30:00Z`.
- The stop gate confirmed three applied migrations, no failed migrations, no
  competing database transactions, three documents, three versions, one active
  membership, one target Owner role, and no live sessions.
- Nine pending Prisma migrations were applied to the production branch. Prisma
  then reported no schema drift.
- The attested membership reassignment ran in one asserted transaction with row
  locks and session revocation. Exactly one membership moved from `System
  Administrator` to `Organization Owner`.

## Deployment

- A local `--prebuilt` candidate (`dpl_2M41NreHN8tFTNSBUb9hTYZAymQW`) was
  rejected after self-audit proved its sensitive environment values were
  literal `[SENSITIVE]` placeholders. It was never promoted.
- Pausing the Vercel project also blocked two earlier production-target builds:
  `dpl_4jb9bgEnxtFF3WPDv28aw1tmehoV` and
  `dpl_AZTSmD2dRaiHVKDVJr1VnUaJEbR7`.
- The accepted artifact was built remotely from an exact Git archive so Vercel
  supplied the managed Production environment. Build, TypeScript, and all 38
  route-generation checks passed.
- Accepted deployment: `dpl_2CpveUu4o2cV9XpYAsCcap1sTh96`, immutable URL
  `https://veritas-e-2zu58e7us-hundozers-projects.vercel.app`.
- Vercel promotion implicitly resumed public serving. This differed from the
  planned paused-alias swap, so the final production smoke gate ran immediately.

## Post-cutover evidence

- Public root: HTTP `200`.
- Session and document APIs without a session: HTTP `401`.
- Invalid login probe: HTTP `401`.
- HSTS is present; no deployment error entries were returned for the cutover
  window.
- Database: 12 migrations, 0 failed; one active Organization Owner membership;
  zero active System Administrator memberships; 33 canonical permissions;
  eight Owner canonical grants; zero System Administrator canonical grants;
  zero live sessions; three documents; three document versions.

## Residual release boundary

This is a containment deployment, not general availability. Distributed login
abuse controls, MFA, observability governance, historical-record assessment,
legal/privacy materials, independent security testing, validation, operations,
and independent approvals remain release blockers.
