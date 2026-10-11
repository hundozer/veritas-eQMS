# Page templates and interaction rules

Templates every module follows, and the interaction rules that stop two
developers inventing two answers to the same question. Each template says
whether it is **Implemented** (a screen exists and is the reference),
**Proposed** (agreed shape, no screen) or **Concept** (direction only; the
roadmap item that builds it settles the details and updates this file).

Wireframes are schematic text drawings, not screenshots. Screenshots of what
exists are in `docs/handover/szava/visual-references/`.

## Workspace structure (implemented)

```
┌────────────┬───────────────────────────────────────────────────────────┐
│ Veritas    │ Section title (serif)      Org · Person · Sign out · Dark │  Header, sticky 56 px
│            ├───────────────────────────────────────────────────────────┤
│ 1.0 Overv. │  Page headline (serif h2)                     [Action]    │  PageIntro
│ 2.0 Docum.▌│  One line of context                                       │
│ 3.0 Train. │  ════════════════════════════════════════════════════════  │  2 px ink rule
│ 4.0 People │                                                            │
│ 5.0 Audit  │  page body                                                 │
│            │                                                            │
│ Veritas    │                                                            │
└────────────┴───────────────────────────────────────────────────────────┘
  Sidebar 232 px, sections from workspaceSections(permissions)
```

The workspace is one client route, `/app` (`src/app/(app)/app/page.tsx`),
whose server layout refuses requests without a session. Sections are client
state (`activeTab`). Until the workspace gains URL-per-record routing (a
shared change Claude owns; see the handover), a new module is a new section
component rendered by `page.tsx`, listed in `workspaceSections` and the nav.

## 1. Record list — Implemented (Documents register, audit trail)

```
Change control register                                   [New change control]
12 change controls, newest first.
══════════════════════════════════════════════════════════════════════════
Action [All ▾]   Record type [All ▾]                 12 entries
─────────────────────────────────────────────────────────────────────────
No.            Title                         Risk    State        Raised
CC-2026-0004   Reduce hold time after clean  Medium  [IN REVIEW]  2 Oct 2026
CC-2026-0003   …
```

- **Hierarchy:** PageIntro (title, count, the create action) → filters → ledger.
- **Components:** `PageIntro`, `Button` (outline), filter form of `SelectField`s,
  `Ledger`, `Stamp`, `Mono`, `EmptyState`, `Notice`.
- **Actions:** open a record (the row's number/title is a button or link);
  create (only with the create permission).
- **Permissions:** the section appears only with the read permission
  (`workspaceSections`); the create button only with the create permission;
  the route checks both again.
- **Responsive:** ledger scrolls inside its box; hide secondary columns
  ≤ 640 px; a register-beside-record layout (Documents) stacks and scrolls
  the record into view ≤ 900 px.
- **Loading:** "Loading change controls…" (`Note`). **Empty:** `EmptyState`
  saying why it is empty and what to do; different words when the person
  cannot create. **Error:** `Notice tone="error"` naming what failed.
- **Filters:** apply on change, show the resulting count, state any bound
  ("the newest 200").

## 2. Record detail — Implemented (Documents record)

```
┌ RecordSheet ───────────────────────────────────────────────────────────┐
│┌──────────┬──────────┬──────────┬────────────────┐                     │
││ no.      │ revision │ type     │ classification │  RecordHeader       │
││ SOP-0001 │ 3        │ SOP      │ CONTROLLED     │                     │
│├──────────┴──────────┴──────────┴────────────────┤                     │
││ Cleaning of the filling line       [IN REVIEW]↺ │                     │
│├─────────────────────┬──────────┬────────────────┤                     │
││ owner               │ trains   │ in force       │                     │
│└─────────────────────┴──────────┴────────────────┘                     │
│ Description (68ch)                                                      │
│ ┌ ✓ Draft ┬ ② In review ┬ 3 Approved ┬ 4 Effective ┐  LifecyclePath    │
│ ├ author  ┼ review      ┼ approve    ┼ release     ┤  SignatureBoxes   │
│ └ Ada     ┴ Rui (not s.)┴ Quinn      ┴ —           ┘                   │
│ What you can do                                                          │
│ [Sign review] [Return for changes]                                       │
│ - - - - - - - - - - - - - - - - - - - -                                  │
│ [Withdraw this revision]   (quiet)                                       │
│ Revisions / Related records / History  (Ledger sections)                 │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Hierarchy:** identity → title and state → people and dates → where it is
  in its lifecycle and who signs → what *this person* can do → history.
- **Actions** come from one pure function per record type
  (`documentPanelActions` in `src/lib/document-panel.ts` is the model) of
  state, assignment and permissions. If it returns nothing, say "No action on
  this … is open to you."
- **Responsive:** header cells stack ≤ 640 px; path and boxes go 2 × 2.

## 3. Record creation — Implemented (New draft)

A `Dialog` opened from the list's create button: only the fields needed to
create the record (more is added on the record later). Submit is primary,
labelled with the result ("Create controlled draft"). On success: close, show
a success `Notice`, refresh the list, select the new record. On refusal: stay
open, show the server message in the dialog, keep the typed values.

## 4. Review and approval — Implemented (document review, approval, release, retirement, training sign-off)

The record detail's "What you can do" offers the signing action only to the
assigned signer with the permission; it opens `SignatureDialog`. See
**Electronic signature** below. Returning for changes or withdrawing uses a
`FormSheet` that requires a reason.

## 5. Workflow execution — Proposed (VER-02)

The record detail plus, for multi-step records (deviation, CAPA, change
control): a `LifecyclePath` of the module's states, an `AssignmentPanel` of
open tasks with owners and due dates, and per-step sections that open as the
record reaches them (investigation, root cause, actions, effectiveness).
Completed steps stay visible and read-only; a step's own form is a
`FormSheet`. States, signatures and permissions per module are fixed in
`docs/architecture/quality-workflows.md` by the PR that builds it.

## 6. Quality Impact Map — Concept (VER-03, `docs/features/quality-impact-map.md`)

```
Impact assessment · from SOP-0001 rev 3                    [Approve (sign)]
Computed 11 Oct 2026, 14:02 · 14 findings · 9 decided · 5 open
══════════════════════════════════════════════════════════════════════════
┌ Paths ────────────────────────┐ ┌ Finding ─────────────────────────────┐
│ SOP-0001 rev 3                │ │ IMPACT-TRAINING-001                   │
│  ├ trains → 23 people (3 open)│ │ "People trained on rev 2 need rev 3"  │
│  ├ implements → CTRL-004      │ │ Path: SOP-0001 rev 3 ─derives─▸ TR-12 │
│  └ referenced by → DEV-0007   │ │ Affected: TR-12 [ASSIGNED]            │
└───────────────────────────────┘ │ ( ) Relevant ( ) Not applicable (why) │
                                  │ ( ) Needs assessment                  │
                                  └───────────────────────────────────────┘
```

A ruled tree or list of relationship paths, never a decorative force graph.
Every finding shows its rule and path; a person decides each; approval is
signed. Components: `ImpactReviewPanel`, `ImpactFinding`, `RelatedRecords`
(all proposed).

## 7. Evidence readiness — Concept (VER-04, `docs/features/evidence-readiness.md`)

```
Evidence · open gaps                                           [Export package]
7 gaps: 3 overdue · 4 awaiting review
══════════════════════════════════════════════════════════════════════════
Gap                                   Rule            Owner     Due        →
Training on SOP-0001 rev 3 incomplete EVID-TRAIN-01   Ada A.    2 Nov 2026  Open
CAPA-2026-0002 effectiveness unsigned EVID-CAPA-03    Quinn Q.  overdue     Open
```

A register of specific, owned gaps (rule, owner, due, the workflow that
resolves it), and per-record evidence lists (`EvidencePanel`). No scores, no
"ready".

## 8. Guided setup — Concept (VER-05, `docs/features/guided-setup.md`)

```
Set up your quality system                     Step 2 of 5 · Documents
══════════════════════════════════════════════════════════════════════════
✓ Organisation   ② Documents   3 Owners   4 Training   5 Invite
Upload your current SOPs. Each becomes a draft you review before release.
[ Drop files or choose ]          SOP-0001.pdf  ✓ 248 KB  sha256 9f86…
```

A `LifecyclePath` as the step index, one `FormSheet`-style panel per step,
always resumable, nothing released or signed automatically (ADR-005).

## 9. Organisation administration — Implemented in part (People)

People ledger (name, email, role, status, pending invitation), invite via a
`FormSheet`, per-member actions (resend invitation, reset two-step
verification with a reason). Role change and deactivation answer "not
available yet" (VER-00 open items). Template for future settings pages:
PageIntro → ledger of the things administered → actions per row in a
`FormSheet`, every change audited.

---

## Interaction rules

### Navigation
- One shell, one sidebar, sections numbered in the order of the nav list.
- Opening a record from anywhere (overview slip, register, related record)
  switches to its section with it selected (`onOpenDocument` in `page.tsx`).
- Never open records in new tabs or windows, except controlled copies (PDF),
  which open in a new tab with `rel="noreferrer"`.

### Button hierarchy
- Per action area: at most one `primary` (the action that moves this record
  forward for this person), any number of `outline`, and `quiet` actions that
  take something out of use in a separate row under a dashed rule.
- Labels are verbs naming the result: "Sign approval", "Submit for review",
  "Start revision 4", never "OK", "Submit", "Yes".
- An action the person cannot take is **not shown**; do not show disabled
  buttons for missing permissions. `disabled` is only for "working".

### Forms and validation
- Validate on submit, not on every keystroke. Show one `FormError` that says
  what to fix ("Title, reason and risk level are required."). The server
  validates again and its message is shown verbatim in the same place.
- Required fields carry `required`; there are no asterisks; optional fields
  say "(optional)" in the label.
- Keep the person's input after any refusal.

### Confirmation and destructive actions
- Veritas never deletes regulated records. "Destructive" means withdraw,
  retire, return, reset: each needs a **reason** in a `FormSheet` (or a
  signature with a reason for retirement). The reason form *is* the
  confirmation; no extra "Are you sure?" dialog.
- Withdraw/retire buttons are `quiet` and sit apart from forward actions.

### Unsaved changes
- Forms are short and submit in one step, so there is no draft autosave.
  Cancel and Escape discard without asking when nothing was typed; when the
  person has typed in a reason or description longer than a few words,
  Escape still cancels (current behaviour). A shared "discard typed text?"
  guard is **not built**; propose it if a long form appears.

### Notifications
- Result of an action: a `Notice` at the top of the page body for 5 s
  (success, role `status`) or until the next action (error, role `alert`).
  Dialogs and form sheets show their own errors instead.
- Notifications to people (assignments, due dates) use the existing
  `Notification` table and the overview's "routed to you"; no toasts, no
  browser notifications.

### Loading and error recovery
- Say what is loading. Never show "nothing to do" before data arrived.
- A failed load says what failed and what to do (reload; tell the
  administrator if it persists). Server errors carry an `errorId` header
  (`X-Error-Id`) the administrator can quote; never show stack traces.
- A 409 `StaleWorkflowAction` means someone moved the record: show the
  message and refresh the record.

### Keyboard and focus
- Everything is reachable by Tab in reading order; buttons are `<button>`,
  links are `<a href>`.
- Opening a `FormSheet` focuses its first field; Escape closes it.
- `Dialog` traps focus (native modal), Escape cancels, focus returns to the
  opener.
- Visible focus: 2 px ink outline, offset 2 px, on every control.

### Responsive design
- Check 390 px and 1440 px. Tables scroll inside their box, never the page.
- Two-column layouts are flex-wrap with a basis, not media-query grids.
- Touch targets 44 px.

### Electronic signature
1. Offer the signing action only to the assigned signer with the permission,
   and only in the state that allows it.
2. Open `SignatureDialog` with the exact record, version and meaning, and one
   sentence of consequence.
3. Ask for a reason when the meaning requires one (retire, reject, close with
   deviations); otherwise an optional comment.
4. Ask for the signer's own password every time (no "remember me", no
   biometrics, no reuse of the sign-in session).
5. Disable the submit while the request runs; clear the password field after
   every attempt.
6. On refusal show the server's words ("The password did not match; nothing
   was signed", "Too many wrong passwords; signing is paused for 15 minutes")
   and keep the dialog open.
7. On success close, show a success notice that says what changed ("Release
   signed. This version is now effective; any previous version is
   superseded."), refresh the record so its signature boxes show the signature.
8. Never sign on someone's behalf, never sign automatically, never batch-sign.
