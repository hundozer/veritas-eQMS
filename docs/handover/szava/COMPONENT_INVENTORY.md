# Component inventory (index)

Full inventory with APIs, variants, states, accessibility and limitations:
`docs/design-system/components.md`. Import from `@/ui/paper`.

| I need… | Use | Status |
| --- | --- | --- |
| The page frame and navigation | `AppShell` (one instance, in `src/app/(app)/app/page.tsx`); add a section via `workspaceSections` | Implemented, shared: do not change in a module PR |
| A page title with its actions | `PageIntro` | Implemented |
| A section heading inside a page | `SectionTitle` | Implemented |
| A button | `Button` `primary` / `outline` / `quiet`, `ButtonRow` | Implemented |
| A text, multi-line, select, date or file input | `TextField`, `TextAreaField`, `SelectField`, `DateField`, `FileField`, `FieldPair` | Implemented |
| A checkbox | `CheckboxField` | **Proposed** |
| To create a record | `Dialog` | Implemented |
| An action on an open record needing input | `FormSheet` | Implemented |
| To sign | `SignatureDialog` | Implemented (UI); server contract for non-document records **proposed** |
| A table | `Ledger` (+ `Mono`, `shortHash`, `formatDate`) | Implemented |
| Filters above a table | `SelectField`s in a `<form aria-label>` (pattern from `AuditTrail.tsx`) | Module-local pattern |
| Paging | `LedgerPager` | **Proposed** |
| A record state | `Stamp`, `stateLabel` | Implemented |
| Nothing to show | `EmptyState` | Implemented |
| Loading | `Note` "Loading …" | Pattern |
| An error / success message | `Notice`, `FormError` | Implemented |
| A record's header | `RecordSheet` + `RecordHeader` | Implemented |
| Where a record is in its workflow | `LifecyclePath` | Implemented |
| Who signs and whether they have | `SignatureBoxes` | Implemented |
| Who must do what by when | `AssignmentPanel` | **Proposed** |
| A record's history | `AuditTimeline` | **Proposed** (module-local in `AuditTrail.tsx`) |
| Linked records | `RelatedRecords` | **Proposed** (needs VER-01) |
| Impact findings / review | `ImpactFinding`, `ImpactReviewPanel` | **Proposed** (VER-03) |
| Evidence and gaps | `EvidencePanel` | **Proposed** (VER-04) |

Proposed components are built by the PR that first needs them, through the
design-system contribution process, never inside a module.
