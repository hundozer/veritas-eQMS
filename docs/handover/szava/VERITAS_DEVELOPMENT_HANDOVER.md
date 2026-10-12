# Veritas development handover

> **Platform change (DEC-092, 12 Oct 2026).** The Veritas MVP is now built on the Simpleafied
> platform in the `simpleafied` GitHub organisation (Kotlin services, Keycloak identity), with the
> work split by layer: Claude's team builds UI, flows and the paper design system; Száva's team
> builds architecture and backend. Process and architecture decisions live in `simpleafied/architecture`.
> This repository keeps running production unchanged until a planned switch; no new backend
> capability is built here. Product direction, Roadmap V3, the design system and ADR-001/002/005
> remain the product contracts.
>
> Chapters 1, 2, 4–8 and 12 (product, roadmap, design, UX, definition of done) remain valid.
> Chapters 3, 9–11 describe this repository's architecture and the former division of work; for
> new work the Simpleafied ADRs and proposals take precedence.


**For:** Száva (`maczikasz`) and his AI development agent
**From:** Claude (core architecture and shared foundations), for the product owner
**Version:** 1.0, 11 Oct 2026
**Repository:** https://github.com/hundozer/veritas-eQMS
**Inspected commit:** `main` at `36cedadc2f5b9937507417a12e67754bb3a74f96`
(merge of PR #65, "Document the strategy reset and Roadmap V3"). This package
was written against that commit and lands on `main` with the pull request
that adds it (branch `claude/fervent-thompson-krr0d6`).

> **Authority.** GitHub `main` is the source of truth. This package is a
> snapshot that links to the authoritative files; where it and `main`
> disagree, `main` wins and this package is corrected. Every statement below
> is marked **Implemented** (code and tests exist at the path given),
> **Proposed** (agreed contract, no code) or **Concept** (direction only).

## Where to begin

1. Read this file once, top to bottom (about 30 minutes).
2. Paste the [starter prompt](#starter-prompt-for-szávas-ai) into your agent.
3. Run the app and the component showcase ([Chapter 10](#10-development-standards) › Local setup).
4. Take your assigned issue; read the authoritative files it touches.

| You need | Read |
| --- | --- |
| The rules every agent follows | `AGENTS.md` (shared), `CONTRIBUTING.md` (two-team protocol) |
| What to build next, and when it is done | `docs/ROADMAP.md`, [MVP_ROADMAP.md](MVP_ROADMAP.md) |
| What exists today | `docs/product/current-state.md`, `docs/FEATURES.md` |
| How the system is built | `docs/architecture/system-overview.md`, [ARCHITECTURE_AND_API_CONTRACTS.md](ARCHITECTURE_AND_API_CONTRACTS.md) |
| How screens look and behave | `docs/design-system/`, [DESIGN_SYSTEM_REFERENCE.md](DESIGN_SYSTEM_REFERENCE.md), [COMPONENT_INVENTORY.md](COMPONENT_INVENTORY.md) |
| Code to copy | [examples/](examples/) (type-checked by `npx tsc --noEmit`) |
| Rules for your code | [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) |
| Before you open a PR | [ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md), `docs/REVIEW.md` |
| What it looks like | [visual-references/](visual-references/) |

---

## 1. Product identity

**What Veritas is.** A multi-tenant, connected quality management platform
for small and mid-sized regulated life-sciences organisations: European
biotech companies, CROs, smaller GMP manufacturers and regulated suppliers,
about 10–100 people, with little QA administration capacity
(`docs/product/strategy.md`).

**Strategic promise:** **Know what changed. Know what it affects. Know what to
do next.** For any change or quality event Veritas should answer: what
changed, what it affects, what must happen next, who is responsible, and what
evidence proves it was done (`docs/product/vision.md`).

**Not a collection of eQMS modules.** Competitors sell module counts.
Veritas's differentiation is *connected quality intelligence with little
implementation effort*: records are linked through a typed **quality
relationship graph** (VER-01), so a change can show its **impact** (VER-03,
the signature differentiator) and the system can show specific, owned
**evidence gaps** (VER-04). **Guided setup** (VER-05) turns a small SOP
library into a working system without an implementation project. Security,
tenant isolation, traceability, validation support and human accountability
(VER-00) are foundations, not features.

**Problems it solves.** QA teams cannot see what an SOP revision affects
(training, controls, open CAPAs); evidence is assembled by hand before
inspections; deviation → CAPA → change → SOP → training chains live in
spreadsheets and e-mail; enterprise eQMS needs months of setup.

**User roles** (persisted roles with permissions; the UI never decides on
role names): QA manager / Head of Quality (core user), document author,
reviewer, approver, training coordinator, department manager, employee,
organisation administrator, auditor (read-only).

**Long-term direction.** After the MVP: internal audits and supplier quality
(VER-06), then regulatory intelligence with human-reviewed interpretation
(VER-07). No AI in the MVP; any later AI output is a labelled suggestion a
person must confirm (`docs/architecture/human-accountability.md`).

**The promise is direction, not a current capability.** Today Veritas does
document control and training (Implemented). Never present the promise,
the impact map or evidence readiness as existing, and never claim
"compliant", "validated" or "inspection-ready".

## 2. MVP roadmap

The approved roadmap is Roadmap V3 (`docs/ROADMAP.md`, DEC-091). VER-00 to
VER-05 form the competitive MVP; VER-06 and VER-07 follow. VER-DS-01 (shared
design system) is P0 and a dependency of every new frontend module. Full
acceptance criteria, dependencies and status per stage:
[MVP_ROADMAP.md](MVP_ROADMAP.md). Summary:

| Stage | Content | Status at the inspected commit |
| --- | --- | --- |
| **VER-00** Trust and operational foundation | Authentication, MFA, roles, tenant isolation, e-signatures, document control, training, recovery, evidence export | **Partial.** Implemented: tenant isolation, MFA, signatures, document lifecycle, training, append-only audit, audit PDF export. Missing: password recovery, role change, deactivation, session revocation, multi-org choice, restore drill, evidence packages, live invitation email |
| **VER-DS-01** Shared design system | Tokens, shared components, showcase, governance | **Partial, delivered by this PR's branch**: components, docs, gates; remaining screens to migrate |
| **VER-01** Quality relationship graph | Typed, version-aware, tenant-scoped links | **Proposed** (ADR-001); nothing built |
| **VER-02** Connected quality workflows | Change control, deviations, CAPA on shared primitives | **Proposed** (ADR-002); `ChangeRequest` table exists and is tenant-scoped; routes answer 503 |
| **VER-03** Quality Impact Map | Explainable impact assessment | **Concept / Proposed** (ADR-003) |
| **VER-04** Continuous evidence readiness | Gaps, overdue obligations, evidence packages | **Concept / Proposed** (ADR-004) |
| **VER-05** Guided quality system setup | Organisation, SOP import, ownership, training mapping | **Concept** |
| VER-06 Internal audits and supplier quality | Post-MVP | Not started (dormant tables, not reused by default) |
| VER-07 Regulatory intelligence | Post-MVP | Not started |

Order of work: VER-00 gaps → graph contracts → change control → deviations
and CAPA → impact map → evidence → setup → MVP gate. A later phase starts only
when the contracts it depends on are merged.

## 3. System architecture

Authoritative: `docs/architecture/system-overview.md`. Contracts for module
work: [ARCHITECTURE_AND_API_CONTRACTS.md](ARCHITECTURE_AND_API_CONTRACTS.md).

| Topic | As built (Implemented unless stated) | Path |
| --- | --- | --- |
| Stack | Next.js 16.3 App Router, React 19.2, TypeScript strict, Prisma 6 on PostgreSQL (Neon), Vercel, Vercel Blob, Resend | `package.json` |
| App structure | `(marketing)` public; `(app)` workspace behind a server session check; one client workspace page with sections | `src/app/` |
| Routing | API: `src/app/api/<resource>/route.ts`, `[id]/route.ts`, one folder per workflow action | `src/app/api/documents/[id]/release/route.ts` |
| Database | Tenant-owned tables: `tenantId`, composite `(id, tenantId)` keys, RLS policy on `app.tenant_id` | `prisma/schema.prisma`, `prisma/migrations/20261007140000_tenant_row_level_security` |
| Prisma use | Only inside `tenantRead` / `tenantTransaction`; explicit `select`; status-guarded `updateMany` | `src/lib/tenant-db.ts` |
| Authentication | Argon2id + TOTP; opaque 12 h session cookie `iam-access-token` (SHA-256 stored) | `src/lib/iam/` |
| Session | `getContext(req)` → `UserContext { id, tenantId, permissions, … }` or null | `src/lib/auth.ts` |
| RBAC | Persisted permission strings; `hasPermission(user, 'x.y')`; per-record assignment checked too | `src/lib/rbac.ts` |
| Tenant isolation | RLS + composite keys + two-tenant database tests in CI | `src/db-tests/` |
| Audit | `writeMandatoryAudit(tx, …)` in the same transaction; table append-only by trigger | `src/lib/audit.ts` |
| E-signatures | Password re-entry, attempt limit, append-only manifest, SHA-256 signed. **Bound to document versions only** | `src/lib/signatures.ts` |
| Files | Presigned direct upload → server re-hash → controlled key; verified on read | `src/lib/controlled-storage.ts` |
| Background jobs | **None.** Everything happens in the request | — |
| Notifications | `Notification` table + list route; e-mail for invitations only | `src/app/api/notifications/route.ts` |
| Errors | `{ error: { code, message } }`; unexpected → `reportServerError` with `errorId` | `src/lib/server-errors.ts` |
| Tests | Vitest unit (no DB) + database suite with two tenants; CI runs both and builds a validation pack | `.github/workflows/ci.yml` |
| Deployment | `main` → Vercel production, owner merges; previews per PR | — |

```
Browser ─▶ (app)/layout.tsx [getContext or redirect] ─▶ app/page.tsx (client)
                                                     └▶ fetch /api/<resource>
/api route: getContext ─▶ hasPermission ─▶ validate ─▶ tenantRead (checks)
          ─▶ tenantTransaction { updateMany(status-guarded) · recordSignature? · writeMandatoryAudit } ─▶ JSON
PostgreSQL: RLS on tenantId = current_setting('app.tenant_id'); audit tables INSERT/SELECT only
```

## 4. Design philosophy

**Scientific precision + controlled GMP documentation + editorial clarity.**
Veritas looks like the paper records a GMP team already trusts, made
interactive: the controlled-form header with labelled boxes, the ruled
register, the routing slip with signature lines, the rubber-stamp state. It
should feel calm, precise, authoritative and exceptionally usable, like a
quality operating system rather than a SaaS dashboard.

Principles, each visible in the implemented Documents tab
(`visual-references/03-document-detail-light-existing.png`):

1. **Ink on paper.** 1–1.5 px ink rules, square corners, a hard offset
   shadow under the record sheet; no gradients, no blurred shadows, no cards
   in many colours.
2. **One accent with one meaning.** Lime marks what is in force and the box
   where *you* sign. Everything else is ink and greys; red only for refusals.
3. **Type carries hierarchy.** Serif headlines and titles, sans body, mono
   for anything a person may copy or compare (numbers, revisions, dates,
   hashes), small-caps labels like a printed form.
4. **Say the state in words.** Stamps print the state; lifecycle steps are
   numbered; nothing relies on colour alone.
5. **Show what this person can do, and only that.** "What you can do" lists
   the actions the person's permissions and assignment allow.
6. **Explain everything.** Any flag shows its rule and relationship path.
7. **One shell, one interaction model** across modules.

Avoid: generic KPI dashboards, colourful cards, decorative gradients, mixed
type, arbitrary shadows, large icons, illustrations, per-module navigation,
module-specific interaction patterns, and the legacy "Verdant/luxury" styles
still present in the code (lime pills, rounded cards, dark modal) which are
being removed.

## 5. Design tokens

Authoritative: `docs/design-system/foundations.md` (exact names and values,
light and dark). Quick reference: [DESIGN_SYSTEM_REFERENCE.md](DESIGN_SYSTEM_REFERENCE.md).

Key tokens: `--ink` (= `--t1`), `--rule` (= `--border`), `--t2`, `--t3`,
`--bg`, `--bg2`, `--card-bg`, `--blight`, `--lime`, `--lime3`, `--on-lime`,
`--danger`, `--danger-bg`, `--gold`; fonts `--font-serif`, `--font-sans`,
`--font-mono`. No Tailwind. CSS Modules only. Gates `DS-T001`–`DS-T005`
fail the unit suite on raw colours, undefined properties, web fonts or theme
drift. Inconsistencies between the implemented paper system and legacy
tokens are listed at the end of foundations.md, with what is and is not
consolidated.

## 6. Component library

Authoritative: `docs/design-system/components.md`. Quick index:
[COMPONENT_INVENTORY.md](COMPONENT_INVENTORY.md). Live: `/dev/design-system`.

Implemented in `src/ui/paper/` (import from `@/ui/paper`): `Button`,
`ButtonRow`, `PageIntro`, `SectionTitle`, `Note`, `EmptyState`, `TextField`,
`TextAreaField`, `SelectField`, `DateField`, `FileField`, `FieldPair`,
`Notice`, `FormError`, `Stamp`, `stateLabel`, `RecordHeader`, `RecordSheet`,
`LifecyclePath`, `SignatureBoxes`, `Ledger`, `Mono`, `FormSheet`, `Dialog`,
`SignatureDialog`, `formatDate`, `formatDateTime`, `shortHash`. Shell:
`AppShell`, `Sidebar`, `Header` (`src/ui/components/layout/`).

Proposed (contracts only, **no code**): `CheckboxField`, `LedgerPager`,
`AssignmentPanel`, `AuditTimeline` (module-local version exists in
`AuditTrail.tsx`), `RelatedRecords`, `ImpactFinding`, `ImpactReviewPanel`,
`EvidencePanel`. Breadcrumbs are not used.

## 7. Page templates

Authoritative: `docs/design-system/patterns.md`, with wireframes for: record
list (Implemented), record detail (Implemented), record creation
(Implemented), review and approval (Implemented), workflow execution
(Proposed), Quality Impact Map (Concept), evidence readiness (Concept),
guided setup (Concept), organisation administration (Implemented in part).
Each lists layout, hierarchy, components, actions, permission handling,
responsive behaviour and loading/empty/error/validation states.

## 8. UX and interaction rules

Authoritative: `docs/design-system/patterns.md` › Interaction rules, and
`docs/design-system/content-guidelines.md`. The rules that most often go
wrong:

- **Buttons:** one `primary` per action area (moves the record forward), the
  rest `outline`; withdraw/retire are `quiet`, in their own row. Hide actions
  a person cannot take; never show permission-disabled buttons.
- **Forms:** validate on submit; one `FormError` that says what to fix; keep
  input after a refusal; show the server's message verbatim.
- **Destructive actions:** nothing is deleted; withdraw/retire/return need a
  reason in a `FormSheet` (retire is also signed). The reason form is the
  confirmation.
- **Dialogs:** only for creating a record and for signing; everything else is
  an in-page `FormSheet` under the button that opened it.
- **Notifications:** a `Notice` at the top of the page body; no toasts.
- **Loading:** say what is loading; never "nothing to do" before data arrives.
- **Keyboard:** everything by Tab; Escape closes forms and dialogs; 2 px ink
  focus outline.
- **Status words:** persisted enums through `stateLabel`; sentence case.
- **Dates:** `11 Oct 2026` via `formatDate`; audit times in UTC, stated.
- **Record numbers:** documents `SOP-1A2B3C4D` (Implemented); quality events
  `CC-2026-0001`, `DEV-…`, `CAPA-…` (Proposed shared primitive, Claude).
- **Electronic signatures:** the eight-step rule in patterns.md; always via
  `SignatureDialog`; password every time; meaning shown before the password.

## 9. Quality workflow integration

The mandatory MVP scenario (VER-02 gate, `docs/product/mvp-scope.md`):

```
Deviation ─▶ Investigation ─▶ CAPA ─▶ Change control ─▶ SOP revision ─▶ Training ─▶ Effectiveness ─▶ Closure
 DEV-…        (deviation        CAPA-…   CC-…             SOP-… rev n+1    assignments    (CAPA,         (each record
              states)                                     (Implemented)    (Implemented)   signed)        closes, signed)
```

Each record keeps its own table and lifecycle; they connect through graph
links created as the user moves through the scenario (ADR-002). There is no
workflow engine.

### Workflow states (Proposed target, ADR-002; exact states fixed by each module's PR)

| Record | States (target) | Signed steps (ADR-005) |
| --- | --- | --- |
| Deviation | reported → classified → containment → investigation → root cause → impact assessment → disposition → QA closure | QA closure |
| CAPA | initiated → root-cause linkage → actions (owned, due) → implementation evidence → effectiveness verification → QA closure | Effectiveness, closure |
| Change control | request → classification → impact assessment → QA review → approval → implementation → verification → closure | Approval, closure |
| Document (Implemented) | DRAFT → IN_REVIEW → APPROVED → EFFECTIVE → SUPERSEDED / OBSOLETE; WITHDRAWN | Review, approval, release, retirement |
| Training (Implemented) | ASSIGNED → COMPLETED; SUPERSEDED on a new effective version | Read and understood |

### Record relationships (Proposed, ADR-001 taxonomy — the only allowed links)

| Step | Link created | Who | When |
| --- | --- | --- | --- |
| Deviation found against an SOP | `DEVIATION REFERENCES DOCUMENT_VERSION` | user asserted | on reporting/investigation |
| CAPA raised | `CAPA ADDRESSES DEVIATION` | user asserted | on CAPA creation from the deviation |
| CAPA needs a change | `CAPA RESULTS_IN CHANGE_CONTROL` | user asserted | on change creation from the CAPA |
| Change affects an SOP | `CHANGE_CONTROL AFFECTS DOCUMENT` | user asserted | in the change's impact assessment |
| SOP revised under the change | `CHANGE_CONTROL IMPLEMENTED_BY DOCUMENT_VERSION` | user asserted | when the revision is started from the change |
| Training on the new revision | `TRAINING_ASSIGNMENT TRAINS_ON DOCUMENT_VERSION` | system derived (existing FK) | on release (Implemented assignment) |
| Effectiveness evidence | `EVIDENCE VERIFIES CAPA` | user asserted | at effectiveness check |
| Owners | `PERSON OWNS DEVIATION / CAPA / CAPA_ACTION / CHANGE_CONTROL` | user asserted | on assignment |

**Do not invent relationship models.** No `deviationId` columns on other
records, no JSON link arrays, no polymorphic `(type, id)` tables, no reuse of
`TenantRequirementMapping`. Until VER-01 merges, a module that needs a link
waits for the graph API or agrees an interim contract with Claude on the
issue. A new link type needs a decision-log entry.

### Permissions (existing names; Implemented in the catalogue)

| Record | Permissions |
| --- | --- |
| Change control | `change.read`, `change.create`, `change.review`, `change.approve` |
| Deviation | `nonconformance.read`, `nonconformance.create`, `nonconformance.investigate`, `nonconformance.close` |
| CAPA | `capa.read`, `capa.create`, `capa.update`, `capa.approve_close` |
| Documents, training | `documents.*`, `training.*` (see system-overview.md) |

New permissions need a migration (Claude reviews) and a line in this table.

### Approval and signature requirements

Per ADR-005: automated actions (derived links, training assignment, numbering,
task creation from a decision) need no signature; human decisions (confirm a
link, classify a deviation, dispose an impact finding, assign owners) are
audited with identity; signatures are required for change approval and
closure, deviation QA closure, CAPA effectiveness and closure, and impact
assessment approval. Segregation of duties: the owner/author never approves
or closes their own record.

**Signature contract (Proposed, Claude, VER-02 shared primitive).** The
current `SignatureManifest` requires a `documentVersionId`. Claude will add a
generalised signed-record target (record type + id + a SHA-256 of a canonical
snapshot of the record at signing) and module meanings (`CHANGE_APPROVED`,
`CHANGE_CLOSED`, `DEVIATION_CLOSED`, `CAPA_EFFECTIVE`, `CAPA_CLOSED`,
`IMPACT_APPROVED`) with the same password re-entry, attempt limit and
append-only rules. Modules call it; they never create their own signature
storage.

### Audit events

`writeMandatoryAudit` in the same transaction as each change, payload with
`before`/`after` and reason. Names: `CHANGE_CREATED`, `CHANGE_SUBMITTED`,
`CHANGE_APPROVED`, `CHANGE_CLOSED`, `DEVIATION_REPORTED`,
`DEVIATION_CLASSIFIED`, `DEVIATION_CLOSED`, `CAPA_CREATED`,
`CAPA_ACTION_COMPLETED`, `CAPA_EFFECTIVENESS_VERIFIED`, `CAPA_CLOSED`,
`LINK_CREATED`, `LINK_CONFIRMED`, `LINK_RETIRED`, `TASK_ASSIGNED`,
`TASK_COMPLETED`, plus `SIGNATURE_APPLIED` from the signature service.

### Integration contracts (Proposed; Claude publishes the real API with VER-01/02)

```ts
// Graph (ADR-001)
POST /api/links            { sourceNode: NodeRef, linkType: LinkType, targetNode: NodeRef, rationale: string } → { link }
POST /api/links/[id]/confirm  {} → { link }
POST /api/links/[id]/retire   { reason: string } → { link }
GET  /api/graph/[nodeType]/[id]?depth=1..5 → { nodes: Array<{ node, path: Edge[] }>, hidden: boolean, truncated: boolean }
type NodeRef = { nodeType: NodeType; id: string }     // NodeType/LinkType enums in src/lib/quality-graph/taxonomy.ts (to be created)

// Inside a module's own transaction (server-side, preferred over HTTP):
createLink(tx, context, { source, linkType, target, provenance: 'USER_ASSERTED', rationale })

// Tasks (ADR-002)
QualityTask { id, tenantId, sourceNode: NodeRef, assigneeId, dueDate, status: 'OPEN'|'DONE'|'CANCELLED', completionEvidence? }

// Numbering (ADR-002)
allocateRecordNumber(tx, tenantId, 'CC' | 'DEV' | 'CAPA') → 'CC-2026-0001'   // in the creating transaction, never reused
```

### Evidence requirements

Every controlled decision is attributable to an identity, a record version
and an audit event. A closed record must show: its signatures (who, meaning,
time, hash), its links (with who asserted them), its tasks with completion
evidence, and attachments stored through controlled storage with SHA-256.
Evidence packages (VER-04) list every included artifact with its hash.

### Errors and rollback

- One `tenantTransaction` per user action: the state change, its links, its
  tasks, its signature and its audit rows commit together or not at all.
- A failed signature writes nothing except the `SIGNATURE_FAILED` security
  event.
- A concurrent change returns 409 `StaleWorkflowAction`; the UI refreshes.
- Blob uploads happen before the transaction; on failure the uploaded object
  is cleaned up (`cleanupUncontrolledObject`), never the other way round.
- Nothing is deleted: links are retired, records closed or withdrawn.

## 10. Development standards

Full rules with repository examples: [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md).
Copyable, type-checked examples: [examples/](examples/).

### Local setup

```bash
git clone https://github.com/hundozer/veritas-eQMS && cd veritas-eQMS
npm ci
npm run dev                         # http://localhost:3000/dev/design-system works without a database
# Full workspace: a disposable PostgreSQL 16 and README.md › Local setup, then
# npx prisma migrate deploy && VERITAS_ALLOW_DEV_ACCOUNT=local-only npm run dev:account
npx vitest run && npx tsc --noEmit && npx eslint .
TEST_DATABASE_URL=postgresql://…/veritas_test npm run test:db
```

## 11. Collaboration protocol

Authoritative: `CONTRIBUTING.md`. In short: GitHub is the source of truth;
one owner per issue; separate branches (`claude/…`, `szava/…`); contracts
agreed on the issue before code; one migration in flight at a time; the shell
and `src/ui/paper` change only through a design-system PR; no duplicate
components; everything through PRs; shared code reviewed by the other team;
both teams run the full suite; only the owner merges and releases.
Ownership: Claude owns the foundations (isolation, IAM, audit, signatures,
storage, graph, workflow primitives); Száva owns the modules assigned to him
by issue; the design system is shared and changes by proposal.

## 12. Definition of done

A feature is done when all of these hold (checklist form:
[ACCEPTANCE_CHECKLIST.md](ACCEPTANCE_CHECKLIST.md)): functional acceptance
criteria of its issue; server-side permission checks; tenant isolation with a
two-tenant database test; audit rows in the same transaction; signatures where
ADR-005 requires them; built from `@/ui/paper` and tokens only; works at 390
and 1440 px in light and dark; keyboard accessible; loading, empty and error
states; unit tests and database integration tests; `docs/ROADMAP.md`,
`docs/product/current-state.md`, `docs/FEATURES.md` and design-system docs updated; reviewed
and merged by the owner.

---

## Known gaps at the inspected commit

| Gap | Where | Owner |
| --- | --- | --- |
| Signatures can only target document versions | `src/lib/signatures.ts` | Claude (VER-02 primitive) |
| No graph, tasks or record numbering for quality events | ADR-001/002 | Claude |
| `Deviation`, `CAPA` lack composite tenant keys and RLS; no code may read them | `prisma/schema.prisma` (RISK-027) | Claude migration first |
| Workspace navigation is client state, no URL per record | `src/app/(app)/app/page.tsx` | Claude (shell) |
| Overview, Training, People, Audit trail not yet on `src/ui/paper` | module CSS | VER-DS-01 |
| Legacy components and Verdant CSS unused but present | `src/ui/components/*`, `liquid-glass.css` | VER-DS-01 |
| Theme toggle hydration warning when stored theme ≠ default | `src/ui/providers/ThemeProvider.tsx` | open |
| Root metadata says "Compliance-ready" | `src/app/layout.tsx` | open |
| No browser accessibility / visual regression tests | — | VER-DS-01 |
| Sidebar link contrast 4.4:1 | `liquid-glass.css` | VER-DS-01 |

---

## Starter prompt for Száva's AI

Copy everything in the block into your agent's first message.

```text
You are joining the Veritas eQMS project as the second development team.
Repository: https://github.com/hundozer/veritas-eQMS (GitHub `main` is the only source of truth).
Another team (Claude) owns the core architecture and shared foundations; you build the product modules
and frontend work assigned to you by GitHub issue. The product owner approves, merges and releases.

Do this, in order, before writing any code:

1. Read docs/handover/szava/VERITAS_DEVELOPMENT_HANDOVER.md completely. It was written against commit
   36cedadc2f5b9937507417a12e67754bb3a74f96 and lands on main with the handover pull request.
2. `git fetch && git checkout main && git pull`. Confirm that docs/handover/szava/, docs/design-system/,
   src/ui/paper/ and CONTRIBUTING.md exist. If anything the handover names is missing or different, trust
   the code on main, note the difference, and tell me before continuing.
3. Read AGENTS.md, CONTRIBUTING.md, docs/REVIEW.md, and every file in docs/design-system/.
4. Run `npm ci`, `npm run dev`, open http://localhost:3000/dev/design-system, switch light/dark, and look at
   every specimen. Then run `npx vitest run`, `npx tsc --noEmit` and `npx eslint .` and report the results.
5. Read docs/ROADMAP.md and docs/product/current-state.md. Summarise for me, in ten lines, what is
   implemented, what is proposed, and which phase is current.
6. Read docs/architecture/system-overview.md and docs/handover/szava/ARCHITECTURE_AND_API_CONTRACTS.md.
   Confirm back the regulated-mutation pattern (getContext → hasPermission → tenantRead checks →
   tenantTransaction with status-guarded updateMany and writeMandatoryAudit) and name the file you would copy.
7. Ask me which GitHub issue is your assigned workstream. Read it and the ADR/feature files it touches.
   List every shared contract it depends on (graph links, tasks, record numbers, signatures, permissions,
   shared components, migrations) and whether each exists on main. For any that does not exist,
   draft the proposal as an issue comment and stop until it is agreed.
8. Avoid conflicts with Claude: never change src/ui/paper, the AppShell/Sidebar/Header, tokens,
   src/lib/{auth,rbac,tenant-db,audit,signatures,controlled-storage}.ts, src/lib/iam/, prisma/schema.prisma
   or migrations without an agreed issue and Claude's review. Never add a migration while another is in
   flight. Never invent relationship columns or tables; use the ADR-001 graph contracts.
9. Build only with the shared components from @/ui/paper and the tokens; copy patterns from
   docs/handover/szava/examples/. Every screen has loading, empty and error states, works at 390 px and
   1440 px in light and dark, and is keyboard accessible. No compliance claims in any text.
10. Work on a branch `szava/<short-topic>` from current main, one capability per pull request. Before opening
    it, complete docs/handover/szava/ACCEPTANCE_CHECKLIST.md, run the full test suite (and npm run test:db for
    any query, route or migration change), include light/dark and phone/desktop screenshots, and update
    docs/ROADMAP.md, docs/product/current-state.md and docs/FEATURES.md if a capability changed status.
    Never push to main, never merge, never deploy, never touch production.

Report after steps 4, 5, 6 and 7 and wait for my go-ahead before starting implementation.
```
