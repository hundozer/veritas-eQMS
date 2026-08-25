# Phase 0.35 Self-Audit — Dormant Change-Control Client Removal

Date: 2026-08-25

## Scope and outcome

Remove all unreachable Change Control implementation from the browser bundle so server containment is reinforced by absence of dormant client execution paths.

## Change and control review

- Removed the ChangeRequest client type and navigation union member.
- Removed request collections, selection, modal, form, password, action, and comment state.
- Removed create and approval/closure fetch handlers.
- Removed header routing, list/detail workflow JSX, risk/training assertions, action buttons, creation form, and electronic-signature modal.
- Retained the server-side shared `503 ChangeControlDisabled` boundary and strengthened its UI contract to reject every removed implementation token.

## Architecture, security, privacy, UI, and React audit

- No browser code can collect change-request content or passwords, invoke the disabled endpoints, or present an invalid signature claim.
- Marker-bounded removal was followed by a zero-reference scan, TypeScript compilation, focused tests, and manual neighboring-block review.
- The removal reduces state, render branches, bundle code, and accidental reactivation risk without modifying active document workflows.
- The main client remains oversized; deviation/CAPA and non-core mutation implementations are the next dormant-code candidates.
- This phase does not validate historical change requests or alter the database.

## Verification evidence

- Focused change-control and adjacent platform tests: **11 passed** in two files before the strengthened contract.
- Focused TypeScript and Prisma validation: **passed**.
- Zero-reference Change Control source scan and diff whitespace check: **passed**.
- Full Vitest suite: **289 passed** in 52 test files.
- Final Prisma schema validation and TypeScript validation: **passed**.
- ESLint: **0 errors and 3 pre-existing warnings**.
- Production build: **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and 38 static pages.
- Final zero-reference scan and diff whitespace check: **passed**.
- Manual neighboring-block review: **passed**; Quality Events remains structurally intact for its separate cleanup phase.

## Traceability and residual risk

- Decision: `DEC-039`; updated risk: `RISK-026`; prior server decision: `DEC-033`.
- Residual work is limited to historical review and a future tenant-owned, validated redesign.

Closure status: **closed for dormant Change Control client removal**. Historical review and a future tenant-owned redesign remain pending.
