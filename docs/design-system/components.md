# Component inventory

Every reusable piece of the workspace UI, what it is for and how to use it.
**Implemented** means the code exists at the path given and is covered by the
tests named. **Module-local** means it exists inside one screen and has not
been extracted. **Proposed** means only the contract below exists: no code.
Never describe a proposed component as existing, and never build a second
version of an implemented one.

Import shared components from `@/ui/paper` (or `../../../ui/paper` in files
that unit tests render without the path alias, as `ActionForm.tsx` does).
See them all at `/dev/design-system` (`npm run dev`).

## Summary

| Requested category | Veritas component | Status | Path |
| --- | --- | --- | --- |
| AppShell | `AppShell` | Implemented | `src/ui/components/layout/AppShell.tsx` |
| Sidebar | `Sidebar` (binder index) | Implemented | `src/ui/components/layout/Sidebar.tsx` |
| Header (shell) | `Header` | Implemented | `src/ui/components/layout/Header.tsx` |
| PageHeader | `PageIntro` | Implemented | `src/ui/paper/PageIntro.tsx` |
| Breadcrumbs | none | **Not used.** The workspace is one route (`/app`) with sections; the shell header names the section. Add only with real nested routes (see patterns.md) | — |
| SectionHeader | `SectionTitle` | Implemented | `src/ui/paper/PageIntro.tsx` |
| Buttons | `Button`, `ButtonRow` | Implemented | `src/ui/paper/Button.tsx` |
| Text inputs | `TextField` | Implemented | `src/ui/paper/Field.tsx` |
| Selects | `SelectField` | Implemented | `src/ui/paper/Field.tsx` |
| Date inputs | `DateField` | Implemented (no screen uses it yet) | `src/ui/paper/Field.tsx` |
| Checkboxes | `CheckboxField` | **Proposed** | — |
| Textareas | `TextAreaField` | Implemented | `src/ui/paper/Field.tsx` |
| File uploads | `FileField` | Implemented | `src/ui/paper/Field.tsx` |
| Dialogs | `Dialog`, `FormSheet` | Implemented | `src/ui/paper/Dialog.tsx`, `FormSheet.tsx` |
| Tables | `Ledger`, `Mono` | Implemented | `src/ui/paper/Ledger.tsx` |
| Filters | audit-trail filter form | Module-local | `src/app/(app)/app/AuditTrail.tsx` |
| Pagination | none | **Proposed** (`LedgerPager`) | — |
| Status indicators | `Stamp`, `stateLabel` | Implemented | `src/ui/paper/Stamp.tsx` |
| Empty states | `EmptyState`, `Note` | Implemented | `src/ui/paper/PageIntro.tsx` |
| Loading states | `Note` with "Loading …" text | Pattern, no component | patterns.md |
| Error states | `Notice` (tone `error`), `FormError` | Implemented | `src/ui/paper/Notice.tsx` |
| QualityRecordHeader | `RecordHeader`, `RecordSheet` | Implemented | `src/ui/paper/RecordHeader.tsx` |
| RecordMetadata | `RecordHeader` `details` rows | Implemented | same |
| WorkflowStepper | `LifecyclePath` | Implemented | `src/ui/paper/LifecyclePath.tsx` |
| ApprovalPanel | `SignatureBoxes` + "What you can do" actions | Implemented (boxes); actions are the record's `ButtonRow` | `src/ui/paper/SignatureBoxes.tsx` |
| ElectronicSignatureDialog | `SignatureDialog` | Implemented | `src/ui/paper/SignatureDialog.tsx` |
| AssignmentPanel | `AssignmentPanel` | **Proposed** (routing form exists module-local: `RoutingForm`) | `src/app/(app)/app/ActionForm.tsx` |
| AuditTimeline | audit-trail day ledger | Module-local | `src/app/(app)/app/AuditTrail.tsx` |
| EvidencePanel | `EvidencePanel` | **Proposed** (VER-04) | — |
| RelatedRecords | `RelatedRecords` | **Proposed** (VER-01) | — |
| ImpactFinding | `ImpactFinding` | **Proposed** (VER-03) | — |
| ImpactReviewPanel | `ImpactReviewPanel` | **Proposed** (VER-03) | — |

## Application

### AppShell
`src/ui/components/layout/AppShell.tsx` · used by `src/app/(app)/app/page.tsx` and the showcase.

```ts
AppShell(props: {
  navGroups: NavGroup[];          // from src/ui/types.ts; items {id, label, route, icon?}
  activeRoute?: string;
  onNavigate?: (route: string) => void;
  headerTitle?: string;           // section name, serif
  headerActions?: ReactNode;      // organisation, person, Sign out
  themeMode?: 'light' | 'dark';
  onThemeToggle?: () => void;
  logo?: ReactNode;               // default: Wordmark ("Veritas", serif text, no image)
  footerText?: string;
  overlay?: ReactNode;
  children: ReactNode;
})
```
Layout: sticky 232 px sidebar, sticky 56 px header, scrolling content. Below
the shell breakpoint a hamburger opens a full-screen menu.
Accessibility: nav buttons carry `aria-current="page"`; the hamburger and
close have `aria-label`s. Limitations: the hamburger does not expose
`aria-expanded`; navigation is client state (no URL per section yet), so the
browser back button leaves the workspace. **One shell for every module; never
fork or restyle it** (collaboration rule 6).

### Sidebar
`src/ui/components/layout/Sidebar.tsx`. The workspace index as numbered binder
tabs (`1.0 Overview`, `2.0 Documents`…); the active tab joins the page (same
background as the sheet). Items come from `navGroups`, flattened. Which items
appear is decided by `workspaceSections(permissions)` (`src/lib/workspace-access.ts`),
never by role names. A new module adds its section there and to the nav list
in `page.tsx`.

### Header
`src/ui/components/layout/Header.tsx`. Section title (serif) left; actions and
the theme toggle right. Known gap: the theme toggle label causes a hydration
warning when a person's stored theme differs from the server default (see
handover known gaps).

### PageIntro, SectionTitle, Note, EmptyState
`src/ui/paper/PageIntro.tsx`.

```ts
PageIntro({ title: string; lede?: ReactNode; actions?: ReactNode })  // h2 + lede + right-aligned actions, 2 px ink underline
SectionTitle({ id?: string; children })                              // h4, serif 20 px
Note({ children })                                                   // p, 14 px, --t2, 64ch
EmptyState({ children })                                             // dashed sheet: say what is missing and what to do
```
Heading levels: shell header text → page `h2` (PageIntro) → record `h3`
(RecordHeader title, dialog title) → section `h4`.

## Inputs

### Button, ButtonRow
`src/ui/paper/Button.tsx` · tests `DS-T010`.

```ts
Button(props: ButtonHTMLAttributes & { variant?: 'primary' | 'outline' | 'quiet' })  // default variant 'outline', default type 'button'
ButtonRow({ children, className? })
```
| Variant | Look | Use |
| --- | --- | --- |
| `primary` | ink fill, sheet-coloured text | The one action that moves the record forward (submit, sign). At most one per action area |
| `outline` | 1.5 px ink border | Every other action, including "New draft" in a page intro |
| `quiet` | hairline border, grey; turns danger on hover | Takes something out of use (withdraw, retire). Sits in its own row under a dashed rule |

States: hover, active (1 px press), `:focus-visible` 2 px ink outline,
`disabled` (60 % opacity, `cursor: progress`; use while a request runs, with
the label "Working…"). Height 44 px.

### TextField, TextAreaField, SelectField, DateField, FileField, FieldPair
`src/ui/paper/Field.tsx` · tests `DS-T015`.

```ts
TextField({ label: string; hint?: ReactNode; inputRef?; ...InputHTMLAttributes })
TextAreaField({ label; hint?; textareaRef?; ...TextareaHTMLAttributes })   // rows 3 by default
SelectField({ label; hint?; selectRef?; children: <option>…; ...SelectHTMLAttributes })
DateField({ label; hint?; ...input attrs })        // type="date", ISO value
FileField({ label; hint?; accept?; ...input attrs })  // accept from src/lib/document-file-types.ts for documents
FieldPair({ children })                            // two columns, stack below 440 px
```
Every field renders a visible small-caps label tied by `for`/`id` (`useId`),
and a hint tied by `aria-describedby`. Errors are not shown per field; the
form shows one `FormError` naming what to fix.

### CheckboxField — Proposed
```ts
CheckboxField({ label: string; hint?: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean })
```
Square 18 px box, 1.5 px ink border, tick in ink; label to the right, whole
row clickable, 44 px row height. Add it to `Field.tsx` with a `DS-T` test when
the first screen needs it.

### FormSheet
`src/ui/paper/FormSheet.tsx` · tests `DS-T017`, `ACTION-FORM-T005…T008`.

```ts
FormSheet({ title; subject?: string; note: string; error: string | null; busy: boolean; submit: string;
            onCancel: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void; children })
```
The in-page form for an action on an open record that needs input (a reason,
a routing, a file). Opens under the button that opened it (set
`aria-expanded` on that button), Escape cancels, focus goes to the first field
(the caller focuses it, see `ReasonForm`). On refusal it stays open and shows
the server's message as `role="alert"`. Built on it today: `ReasonForm`,
`RoutingForm` (`src/app/(app)/app/ActionForm.tsx`, kinds in
`src/lib/action-forms.ts`).

### Dialog
`src/ui/paper/Dialog.tsx`.

```ts
Dialog({ title; error?: string | null; busy?: boolean; submit: string;
         onSubmit: (e: FormEvent<HTMLFormElement>) => void; onCancel: () => void; children })
```
A native modal `<dialog>` (`showModal()`): the browser traps focus and makes
the page inert; Escape and × cancel (blocked while `busy`); focus returns to
the opener on close. Render it only while open. Uses native `required`
validation plus the caller's own checks. Use for **creating a record** and,
through `SignatureDialog`, for **signing**. Everything else on an open record
uses `FormSheet`.

## Data

### Ledger, Mono
`src/ui/paper/Ledger.tsx`.

```ts
Ledger({ children: <thead>/<tbody>; caption?: ReactNode (visually hidden); className? })
Mono({ children; title? })
```
Ruled table, header labels in `--t2` 12 px over a 1.5 px ink rule, rows on
hairlines; scrolls sideways inside its own box. Set the table's `min-width`
and hide secondary columns at ≤ 640 px through `className` in the module CSS
(see `.revisions` in `documents.module.css`). Use `<th scope="col">`.
Numbers, revisions, dates, hashes in `Mono`; long hashes shortened with
`shortHash` and the full value in `title`.

### Filters (module-local)
`AuditTrail.tsx`: a `<form aria-label="Filter …">` of labelled selects that
apply on change, with a live count ("12 entries · times in UTC"). Reuse this
pattern (built from `SelectField`) for every list filter; extract a shared
`FilterBar` when the second module needs one.

### LedgerPager — Proposed
```ts
LedgerPager({ shown: number; total?: number; hasMore: boolean; onMore: () => void; busy?: boolean })
```
"Showing 50 of 312 · Show 50 more" as an outline button under the ledger;
cursor-based on the server. Today lists are bounded instead (audit trail: the
newest 200, stated in the count).

### Stamp, stateLabel
`src/ui/paper/Stamp.tsx` · tests `DS-T011`.

```ts
Stamp({ state: string; className? })   // state = the persisted enum value, e.g. 'IN_REVIEW'
stateLabel(state: string): string       // 'IN_REVIEW' → 'In review'; unknown → underscores to spaces
```
Variants by state: `EFFECTIVE` lime fill; `DRAFT`, `WITHDRAWN` dashed;
`SUPERSEDED`, `OBSOLETE` grey struck; anything else solid ink outline. New
record types add their states to `STATE_LABEL` and, only if they mean "in
force" or "out of use", to the stamp classes. The state is always in words.

### Notice, FormError
`src/ui/paper/Notice.tsx` · tests `DS-T016`.

```ts
Notice({ tone?: 'info' | 'success' | 'error'; children })   // error → role="alert", others role="status"
FormError({ children })                                     // p role="alert", danger rule, inside a form
```

### Loading and error states
Pattern, not a component: while loading, a `Note` saying what is loading
("Loading change controls…"); never a spinner alone, never "nothing to do"
before the data arrived (see `Dashboard.tsx` `status` prop). A failed load is
a `Notice tone="error"` saying what failed and what to do.

## Quality-specific

### RecordHeader, RecordSheet (QualityRecordHeader, RecordMetadata)
`src/ui/paper/RecordHeader.tsx` · tests `DS-T012`.

```ts
interface RecordCell { label: string; value: ReactNode; mono?: boolean; span?: number }
RecordHeader({ titleId: string; title: string; state?: string; identity: RecordCell[]; details?: RecordCell[][] })
RecordSheet({ labelledBy: string; sheetRef?; className?; children })   // <article aria-labelledby>
```
A controlled-form header: identity row (number, revision, type…), the title
row with the state stamp rotated like a rubber stamp, then detail rows
(owner, dates…). Rows should total the identity row's column count.

### LifecyclePath (WorkflowStepper)
`src/ui/paper/LifecyclePath.tsx` · tests `DS-T013`.

```ts
LifecyclePath({ steps: readonly string[]; current: number; attached?: boolean; label?: string })
```
`current` is the index of the current step (`-1` when the record left the path;
show a `Note` instead). Done steps get a ✓ (and visually hidden "Done:"),
the current step a lime wash and `aria-current="step"`. Set `attached` when
`SignatureBoxes` follows directly.

### SignatureBoxes (ApprovalPanel)
`src/ui/paper/SignatureBoxes.tsx` · tests `DS-T014`.

```ts
interface SignatureBox { role: string; name: string; state: string }   // state: 'signed' | 'not signed yet' | date | '—'
SignatureBoxes({ boxes: readonly SignatureBox[] })
```
Read-only routing slip: one box per signing role with the assigned person in
italic serif on a signature line. The approval *panel* is these boxes plus
the record's "What you can do" `ButtonRow` (primary = the person's own
signing action). Signing opens `SignatureDialog`.

### SignatureDialog (ElectronicSignatureDialog)
`src/ui/paper/SignatureDialog.tsx` · tests `DS-T018`.

```ts
SignatureDialog({
  title: string; record: ReactNode; version: ReactNode; meaning: string; consequence: ReactNode;
  reasonRequired: boolean; reasonPlaceholder?: string; reason: string; onReasonChange: (v: string) => void;
  password: string; onPasswordChange: (v: string) => void;
  error?: string | null; busy?: boolean; submit: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; onCancel: () => void;
})
```
Shows the signature manifest first (record, exact version, meaning), then
what accepting does, then the reason/comment and the signer's own password
(`autocomplete="current-password"`). The caller clears the password after
every attempt and shows the server's refusal in `error`. The server is the
authority: password re-verification, attempt limit, signature row and audit
row in one transaction (`src/lib/signatures.ts`). Interaction rules:
patterns.md › Electronic signature.

### AssignmentPanel — Proposed (VER-02 tasks)
```ts
interface Assignment { id: string; role: string; assignee: { id: string; fullName: string } | null; dueDate: string | null; state: 'OPEN' | 'DONE' | 'OVERDUE' }
AssignmentPanel({ assignments: Assignment[]; canAssign: boolean; members: RoutingMember[]; onAssign: (role: string, userId: string, dueDate: string) => Promise<string | null> })
```
A ledger of who must do what by when on this record; assigning opens a
`FormSheet` with `SelectField` (member) and `DateField` (due). Built on the
shared `QualityTask` primitive (ADR-002); the module-local `RoutingForm` is
the model for member selection.

### AuditTimeline — Module-local today
`AuditTrail.tsx` groups entries by UTC day: time (mono), action, who and role,
record, field changes before → after, exceptional outcomes flagged.
Proposed shared contract for a record's own history panel:
```ts
AuditTimeline({ entries: AuditEntry[] /* src/app/(app)/app/AuditTrail.tsx */; title?: string; emptyText: string })
```
Server side, entries come from the existing audit query filtered by
`objectType`/`objectId` (`src/lib/audit-query.ts`), never from client state.

### RelatedRecords — Proposed (VER-01)
```ts
interface RelatedRecord {
  nodeType: 'DOCUMENT' | 'DOCUMENT_VERSION' | 'TRAINING_REQUIREMENT' | 'TRAINING_ASSIGNMENT' | 'CHANGE_CONTROL' | 'DEVIATION' | 'CAPA' | 'CAPA_ACTION' | 'CONTROL' | 'EVIDENCE' | 'PERSON';
  id: string; number: string; title: string; state: string;
  linkType: string;                 // from the ADR-001 taxonomy, e.g. 'AFFECTS'
  direction: 'outgoing' | 'incoming';
  status: 'CONFIRMED' | 'SUGGESTED' | 'NOT_APPLICABLE' | 'RETIRED';
  provenance: 'USER_ASSERTED' | 'SYSTEM_DERIVED' | 'RULE_SUGGESTED' | 'IMPORTED';
  rationale: string;
  path: Array<{ from: string; linkType: string; to: string }>;  // why it appears
}
RelatedRecords({ records: RelatedRecord[]; hiddenCount: boolean /* some hidden by permission */; truncated: boolean;
                 canLink: boolean; onOpen: (r: RelatedRecord) => void; onConfirm?: (r) => void; onRetire?: (r) => void })
```
Grouped by link type in sentence form ("Affects SOP-0001 rev 3"); suggested
links visibly labelled "Suggested" with Confirm / Reject, never counted as
confirmed; a line "Some related records are hidden by your permissions" when
`hiddenCount`. Data comes only from the graph traversal API (ADR-001).

### ImpactFinding — Proposed (VER-03)
```ts
interface ImpactFindingData {
  id: string; ruleId: string; ruleText: string;           // e.g. 'IMPACT-TRAINING-001: trained on the superseded revision'
  target: RelatedRecord;                                  // the affected record
  path: RelatedRecord['path'];                            // the relationship path that produced it
  disposition: 'OPEN' | 'RELEVANT' | 'NOT_APPLICABLE' | 'NEEDS_ASSESSMENT';
  justification: string | null; decidedBy: string | null; decidedAt: string | null;
  followUp: { taskId: string; assignee: string; dueDate: string } | null;
}
ImpactFinding({ finding: ImpactFindingData; canDecide: boolean; onDecide: (d, justification) => Promise<string | null> })
```
A ruled slip: the rule (id and words), the path as a chain of record numbers,
the affected record with its stamp, then the decision. Not applicable needs a
justification. Never a score, never "compliant".

### ImpactReviewPanel — Proposed (VER-03)
```ts
ImpactReviewPanel({ source: RelatedRecord; findings: ImpactFindingData[]; generatedAt: string; truncated: boolean;
                    canApprove: boolean; onApprove: () => void /* opens SignatureDialog */ })
```
Header (source record, when computed, counts by disposition), the findings
list, and "Approve impact assessment" (primary, signed) enabled only when
every finding has a disposition.

### EvidencePanel — Proposed (VER-04)
```ts
interface EvidenceItem { id: string; kind: 'SIGNATURE' | 'TRAINING_RECORD' | 'FILE' | 'AUDIT_EXPORT'; label: string; sha256: string | null; recordedAt: string; recordedBy: string }
interface EvidenceGap { ruleId: string; ruleText: string; owner: string | null; dueDate: string | null; resolveAction: string }
EvidencePanel({ items: EvidenceItem[]; gaps: EvidenceGap[]; canExport: boolean; onExport: () => void })
```
Lists what evidence exists (with hashes) and the specific gaps, each with the
rule, its owner and the workflow that resolves it. Words: present, missing,
overdue, awaiting review. Never "ready", "compliant" or a percentage.
