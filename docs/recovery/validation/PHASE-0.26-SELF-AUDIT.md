# Phase 0.26 Self-Audit — Audit Index and Sensitive Export Containment

Date: 2026-08-24

## Scope and intended outcome

Prevent uncontrolled regulated/personal-data downloads and unsupported audit-control claims while retaining a minimal tenant audit event view for authorized recovery use.

## Change review

- Replaced `/api/audit/export` and `/api/reports/export` with one no-argument, non-cacheable `503 ExportDisabled` handler.
- Removed unbounded audit payload/email/IP/URL CSV generation and the cross-domain report switch controlled by `audit.export`.
- Removed all main-page export links/buttons and the platform admin's attempted JSON use of the CSV endpoint.
- Retained `/api/audit` behind persisted `audit.read`, with tenant scope, 200-row cap, newest-first order, and `Cache-Control: no-store`.
- Reduced audit-list output to eight metadata fields and excluded payload, email, IP, URL, IAM actor identifiers, and membership identifiers.
- Added explicit invalid-date rejection before database access.
- Removed best-effort GET/denial audit writes that persisted raw query-filter values and operational-role attribution.
- Replaced immutable/complete/Part 11 audit-ledger and automatic-SoD assertions with bounded operational-view and validation-pending language.
- Removed dormant `audit.export` and `report.export` error events and reduced the unexpected-error path inventory from 31 to 29.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Authorization:** only persisted `audit.read` grants event-index access. Disabled exports do not accept a request or evaluate identity because they expose no capability.
- **Tenant isolation:** the retained query always includes the validated context tenant. Client filters cannot override it.
- **Data minimization:** the response includes only event ID, timestamp, membership-role label, action, object type/ID, status, and database row ID. It excludes higher-risk audit payload and network/identity fields.
- **Availability/abuse:** the result is capped at 200 and date parsing fails with fixed `400` before database access. Additional filter length/cardinality limits remain future hardening.
- **Export safety:** no CSV is generated, so spreadsheet formulas, delimiter/newline ambiguity, unbounded memory use, cross-domain permission confusion, and uncontrolled downloads are removed from the executable path.
- **Auditability:** read queries no longer mutate the audit table through best-effort writes. A future access/export evidence policy must define mandatory behavior without making GET reliability dependent on recursive logging.
- **UI/truthfulness:** no export control is offered. The UI states that append-only storage, completeness, retention, and regulatory validation are not evidenced and does not claim automatic Annex 11/Part 11 SoD enforcement.
- **Legal/GxP:** audit payloads and exports can contain personal and regulated data. Privacy purpose, retention, access, subject rights, export approvals, validation, and independent quality/legal review remain prerequisites.

## Verification evidence

- Focused audit route, export, UI-claim, authorization, error, and server-event tests: **30 passed** in six test files.
- Focused TypeScript validation: **passed**.
- Focused Prisma schema validation: **passed**.
- Full Vitest suite: **274 passed** in 43 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Export/data-dependency and UI-claim scans: **passed**; both routes expose only the disabled handler and prohibited controls/claims are absent.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; audit read retains permission/tenant bounds with less data, exports are inert, no migration was added, and no external system changed.

## Traceability

- Decision: `DEC-030`.
- Risks: `RISK-003`, `RISK-004`, `RISK-009`, `RISK-013`, and `RISK-023`.
- Requirement/matrix: `/api/audit`, `/api/audit/export`, and `/api/reports/export` in `API-AUTHORIZATION-MATRIX.md`.
- Tests: `AUDIT-INDEX-T001` through `AUDIT-INDEX-T003`, `EXPORT-T001`, `AUDIT-UI-T001`, central route authorization, error-containment, and server-event contracts.

## Residual risk and closure judgment

- Deployed copies, caches, browser downloads, historical exports, and recipients were not available for verification.
- The audit table remains ordinarily mutable; append-only grants, tamper evidence, privileged-action monitoring, retention/deletion, backup, and restoration evidence remain open.
- The minimized index does not establish event completeness or suitability as a regulated audit trail.
- Exports remain unavailable until distinct domain policies and controlled implementations are approved and validated.
- Additional UI claims about electronic signatures and regulated workflows remain for subsequent containment steps.

Closure status: **closed for repository audit-index and sensitive-export containment**. Deployment and historical-export review remain pending.
