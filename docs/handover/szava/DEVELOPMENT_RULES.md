# Development rules

The binding rules are `AGENTS.md` (all agents), `CONTRIBUTING.md` (two teams)
and `docs/REVIEW.md` (review checklist). This file explains them with
repository examples. Where this file and those disagree, those win.

## TypeScript

- `strict` is on. No `any` in new code (the lint rule is relaxed for legacy
  files; do not rely on it). No `@ts-ignore`.
- Enumerations as `as const` arrays with a derived union type, validated at
  the boundary (`DOCUMENT_STATUSES` and `parseDocumentStatus` in
  `src/lib/document-lifecycle.ts`).
- Domain rules live in `src/lib/<topic>.ts` as pure functions with a
  `<topic>.test.ts` next to them; route handlers and components call them.
- Files that unit tests render or import without the `@/` alias use relative
  imports (`src/app/(app)/app/ActionForm.tsx`).

## React and Next.js

- Next 16 App Router with breaking changes: read
  `node_modules/next/dist/docs/` for any framework API before using it.
- Route handlers take `{ params }: { params: Promise<{ id: string }> }` and
  `await params`.
- Pages that need a session live under `src/app/(app)/`; the layout's
  server-side `getContext()` is the gate, and every API route checks again.
- Workspace UI is client components (`'use client'`) fetching `/api/*`;
  domain logic does not live in components. Server-only modules import
  `'server-only'` (`src/lib/document-lifecycle.ts`).
- Function components with typed props; `useState`/`useEffect`; no global
  state library.
- Build screens from `@/ui/paper`; a module component has one CSS Module for
  layout only (`src/app/(app)/app/documents.module.css` is the model).
- Never render an action the person may not take; derive actions from
  permissions and record state in a pure function (`src/lib/document-panel.ts`).

## API conventions

See [ARCHITECTURE_AND_API_CONTRACTS.md](ARCHITECTURE_AND_API_CONTRACTS.md)
§1 and §5. One folder per workflow action. JSON only. Explicit `select`.
`Cache-Control: no-store` on regulated reads. Messages written for the end
user.

## Validation

Hand-written, at the boundary, into typed values: trim strings, check enums
against the `as const` list, reject unknown values with 400
`ValidationFailed`. Checks the client makes (`checkReason`, `checkRouting` in
`src/lib/action-forms.ts`) are repeated on the server. No schema library is
installed; adding one needs a decision.

## Prisma and the database

- Only inside `tenantRead` / `tenantTransaction`; filter by `tenantId` too.
- State changes via status-guarded `updateMany` with a count check.
- No raw SQL in application code except `set_config` in `src/lib/tenant-db.ts`.
- Migrations: a new folder, never edit an applied one, RLS policy in the same
  migration for a tenant table, the CI drift check must pass, one migration in
  flight at a time, Claude reviews every schema change.
- Never read `Deviation`, `CAPA` or dormant tables before their reviewed
  migration (RISK-027).

## Tenant isolation and authorisation

- Every handler: `getContext` → `hasPermission` before reading input or data.
- IDs from the request are checked to belong to the caller's tenant.
- Per-record assignment checks in addition to permissions; segregation of
  duties in the route.
- Never decide on `User.role`, department or a role-name string (DEC-058).
- Storage keys are built server-side and tenant-prefixed.

## Audit logging

`writeMandatoryAudit` in the same transaction as every regulated change, with
before/after values and the reason. Security events outside a transaction via
`logSecurityEventBestEffort` (`src/lib/auth.ts`). Never log personal data or
secrets to the console; `reportServerError` logs only an event name and an
error id.

## Error handling

Expected failures → typed error classes mapped to 4xx (`DocumentLifecycleError`
→ `lifecycleErrorResponse`; `SignatureError` → `signatureFailedResponse`).
Unexpected → `reportServerError` + generic 500. No exception text, stack or ids
of other records in responses. The UI shows the server message; a 409 stale
action refreshes the record.

## Testing

- Every behaviour change ships a test that fails without it; prefer
  behaviour (call the route or render the component) over source-text greps.
- Unit: Vitest, `*.test.ts` next to the code; routes with the tenant-db
  double (`src/test-support/tenant-db-double.ts`, used by
  `src/app/api/audit/route.test.ts`); components with `renderToStaticMarkup`
  (`src/lib/action-forms-render.test.ts`, `src/ui/paper/paper.test.ts`).
- Database: `src/db-tests/*.dbtest.ts` against a disposable PostgreSQL with
  two tenants and the application role; required for every new query, route,
  migration or role, including negative cases (wrong tenant, missing
  permission, wrong assignee, stale state).
- Test IDs (`MOD-T001`) in test names; add requirements to
  `docs/validation/requirements.json` when a controlled capability is added.

## Accessibility and UI quality

`docs/design-system/accessibility.md`: keyboard, labels, roles, headings,
44 px targets, contrast, reduced motion, 390/1440 px, light/dark.

## Performance

- Lists are bounded on the server (`take`) and say so; add cursor paging
  before a list can exceed a few hundred rows.
- Select only needed fields; index the columns a list filters and orders by
  (in the migration).
- No N+1 queries; use `select`/`include` or one `findMany` with `in`.
- No new client libraries for one screen (charts, UI kits) without a decision;
  the workspace ships system fonts and no images.

## Security

- No secrets in the repository, logs, screenshots or the handover archive;
  configuration comes from environment variables only.
- CSP and security headers live in `next.config.ts`; a new external origin
  needs a decision and a header change reviewed by Claude.
- Never `dangerouslySetInnerHTML`; never build HTML from user input.
- Passwords only for sign-in and signing, held only in form state, cleared
  after each attempt.
- No AI calls, analytics or third-party scripts in the MVP.

## Dependency management

- `npm ci` with the committed `package-lock.json`; Node 22.
- A new runtime dependency needs a stated reason in the PR and the owner's
  approval; prefer the platform and existing code. Never upgrade Next, React
  or Prisma inside a feature PR.
- No new services, databases, queues or workflow engines without a
  decision-log entry (`AGENTS.md`).
