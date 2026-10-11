# Quality workflow integration (ADR-002, DEC-087)

Status: accepted direction for VER-02. Each module's pull request records its
lifecycle in this file.

## Decision

Quality records share **primitives**, not a workflow engine. Each record type
keeps its own table, its own lifecycle and its own rules; they connect through
the quality relationship graph (ADR-001).

No general-purpose workflow or state-machine engine is introduced. Deviations,
CAPAs and change controls have different questions, roles and evidence; a
generic engine would push domain rules into configuration nobody validates.

## Shared primitives

| Primitive | Form | Exists today |
| --- | --- | --- |
| Lifecycle guard | One `assertTransition`-style module per record type, like `src/lib/document-lifecycle.ts` | Documents |
| Controlled mutation | Permission check, tenant predicate, status-guarded `updateMany`, `writeMandatoryAudit` in one `tenantTransaction` | Documents, training |
| Electronic signature | `src/lib/signatures.ts` with new meanings per module (e.g. `CHANGE_APPROVED`, `DEVIATION_CLOSED`, `CAPA_EFFECTIVE`) | Documents, training |
| Record numbering | Per-tenant, per-type sequence (`CC-2026-0001`, `DEV-…`, `CAPA-…`), allocated in the creating transaction, never reused | Documents use their own scheme |
| Tasks | `QualityTask`: source record, assignee, due date, status, completion evidence; drives "My work" | Missing |
| Notifications | Existing `Notification` table | Partial |
| Attachments | Controlled storage with SHA-256 verification (`src/lib/controlled-storage.ts`) | Documents |
| Related records | Graph links (ADR-001) | Missing |
| Evidence export | Evidence packages (ADR-004) | Audit PDF only |

## Module lifecycles (target)

**Change control:** request → classification → impact assessment → QA review
→ approval (signed) → implementation → verification → closure (signed).

**Deviation:** reported → classified → containment → investigation → root
cause → impact assessment → disposition → QA closure (signed).

**CAPA:** initiated (linked to its source) → root-cause linkage → actions
(owned, due) → implementation evidence → effectiveness verification (signed)
→ QA closure (signed).

Exact states, who may move them and which steps need a signature are fixed
per module when it is built, following
`docs/architecture/human-accountability.md`.

## Existing tables

- `ChangeRequest` already has composite tenant keys and row-level security
  (DEC-061); it is extended, not replaced.
- `Deviation` and `CAPA` lack composite tenant keys and row-level security
  (RISK-027). Before any code reads them, a reviewed migration brings them to
  the same standard. Existing rows belong to the read-only demo tenants and
  stay as history.

## Mandatory integrated scenario

Deviation → investigation → CAPA → change control → SOP revision → training
→ effectiveness verification → closure. Each record keeps its own lifecycle;
the links between them are graph links created as the user moves through the
scenario. It must run through real APIs and UI with permission checks and an
automated integration test (VER-02 gate).
