# MVP roadmap: criteria, dependencies, status

Authoritative: `docs/ROADMAP.md` (Roadmap V3, DEC-091) and
`docs/product/current-state.md` (status with evidence). Release gate:
`docs/product/mvp-scope.md`. Status below is as of the inspected commit
`36cedad` plus the VER-DS-01 work on the handover branch. Nothing is marked
complete without the evidence named.

Statuses: **Complete** (built, tested, verified where it runs) · **Built, not
live** · **Partial** · **Missing** · **Proposed** (contract only).

## VER-00 — Trust and operational foundation (P0, current)

**Acceptance (gate):** a customer can administer its organisation, run
controlled document and training workflows, recover access, revoke access and
retrieve trustworthy evidence without developer intervention; no unresolved
critical security or data-integrity finding.
**Depends on:** nothing. **Blocks:** MVP gate.

| Item | Status | Evidence |
| --- | --- | --- |
| Authentication: password + MFA, throttling | Complete | DEC-079/080, `src/db-tests/mfa.dbtest.ts`, `login-throttle.dbtest.ts` |
| Roles and permissions from persisted data | Complete | DEC-058, `src/lib/rbac.ts`, `rbac-routes.test.ts` |
| Tenant isolation | Complete | RLS, composite keys, `src/db-tests/` two-tenant suite in CI |
| Electronic signatures (documents, training) | Complete | DEC-062/072, `signatures.test.ts`, `signing-attempt-limit.dbtest.ts` |
| Document control lifecycle | Complete in CI; production gate not run | LIFE-T003, DEC-074 |
| Training on effective versions, matrix | Complete in CI | `training-on-effective.dbtest.ts` |
| Append-only audit, review, PDF export | Complete | DEC-057/077/078 |
| Invitation e-mail live | Built, not live | Resend domain not verified |
| Password recovery | Missing | |
| Member role change, deactivation | Missing (503) | |
| Session revocation (admin, on change) | Partial | logout only |
| Organisation choice at sign-in | Missing (409) | |
| Backup and restore drill | Unverified | Neon PITR only |
| Customer evidence export (documents, training) | Partial | audit PDF only |
| Validation-support documentation | Partial | CI pack exists |
| Risk register reconciliation, penetration test | Partial / not run | |
| Abandoned upload cleanup | Missing | DEC-068 |

## VER-DS-01 — Shared design system and UI governance (P0)

**Acceptance (gate):** a new module screen can be built from `@/ui/paper`
alone, and the design-system gates run in CI.
**Depends on:** nothing. **Blocks:** every new frontend module (VER-02+).

| Item | Status | Evidence |
| --- | --- | --- |
| Tokens documented, paper aliases added | Complete on branch | `docs/design-system/foundations.md`, `DS-T001`–`T005` |
| Shared components | Complete on branch | `src/ui/paper/`, `DS-T010`–`T019` |
| Documents tab, action forms, dialogs migrated | Complete on branch | screenshots 03, 04, 08 |
| Showcase | Complete on branch (dev only) | `/dev/design-system`, `DS-T020`–`T021` |
| Other screens migrated | Missing | Overview, Training, People, Audit trail |
| Legacy UI deleted | Missing | |
| Browser a11y / responsive / visual regression job | Missing | |
| URL per section and record | Missing (Claude) | |

## VER-01 — Quality relationship graph (P0)

**Acceptance (gate):** for an SOP revision, Veritas returns its training
requirements, control mappings and linked quality records, each with the
reason it is related, within the caller's permissions.
**Depends on:** VER-00 isolation. **Blocks:** VER-02 links, VER-03, VER-04.
**Contract:** `docs/architecture/quality-relationship-graph.md` (ADR-001).

| Item | Status |
| --- | --- |
| Node registry and link tables, taxonomy in code and DB | Proposed |
| System-derived adapters (training, versions) | Proposed |
| Bounded, cycle-safe, permission-aware traversal with paths | Proposed |
| Link create / confirm / retire API with audit; two-tenant tests | Proposed |
| `CONTROL` records, document → control mapping | Proposed |

## VER-02 — Connected quality workflows (P0)

**Acceptance (gate):** the integrated scenario (deviation → investigation →
CAPA → change control → SOP revision → training → effectiveness → closure)
runs through real APIs and UI with permission checks, linked evidence and
automated integration tests.
**Depends on:** VER-01 link API, VER-DS-01, the generalised signature target,
record numbering and `QualityTask` (shared primitives, Claude).
**Contract:** `docs/architecture/quality-workflows.md` (ADR-002).

| Item | Status |
| --- | --- |
| Shared primitives: numbering, tasks, signature meanings and target | Proposed (Claude) |
| Change control lifecycle on `ChangeRequest` | Missing (table tenant-scoped; routes 503) |
| `Deviation`, `CAPA` brought to tenant standard, then lifecycles | Missing (RISK-027) |
| Integrated scenario with integration tests | Missing |

## VER-03 — Quality Impact Map (P0, signature differentiator)

**Acceptance (gate):** from an SOP revision, a QA manager runs an impact
assessment, reviews every finding, assigns follow-up and approves it with a
signature as retrievable evidence.
**Depends on:** VER-01, VER-02 tasks and signatures.
**Contract:** `docs/features/quality-impact-map.md` (ADR-003). **Status:** Proposed.

## VER-04 — Continuous evidence readiness (P0)

**Acceptance (gate):** a QA manager finds a specific gap, resolves it through
the right workflow and exports a traceable evidence package.
**Depends on:** VER-01, VER-02, VER-03 findings.
**Contract:** `docs/features/evidence-readiness.md` (ADR-004). **Status:** Proposed.

## VER-05 — Guided quality system setup (P0, adoption)

**Acceptance (gate):** a new organisation imports a small SOP library and gets
a working document and training environment without developer database work.
**Depends on:** VER-00 administration (roles, invitations), document import.
**Spec:** `docs/features/guided-setup.md`. **Status:** Concept.

## MVP release gate

VER-00 to VER-05 passed plus: end-to-end acceptance of the integrated
scenario; cross-tenant tests for every new table and traversal; permission
and signature verification for every new controlled action; executed restore;
verified evidence exports; validation-support documentation; independent
security assessment and QA review; no unresolved critical issue. Merged code
alone never makes the MVP ready; the owner decides.

## Post-MVP

- **VER-06** Internal audits and supplier quality (P1), on the graph and
  evidence readiness; dormant tables reviewed, not reused by default.
- **VER-07** Regulatory intelligence (P2): versioned sources, human-reviewed
  applicability and interpretation, requirement → control/SOP mapping. No
  automated compliance determinations.
