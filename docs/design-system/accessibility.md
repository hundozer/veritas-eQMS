# Accessibility

Target: WCAG 2.2 level AA for every workspace screen. This page says what the
shared components guarantee, what each module must still do, what is tested
automatically and what is not. It is a target and a checklist, not a claim
of conformance.

## What the shared components guarantee

| Concern | Guarantee | Where | Test |
| --- | --- | --- | --- |
| Labels | Every field has a visible label tied by `for`/`id`; hints tied by `aria-describedby` | `Field.tsx` | `DS-T015`, `ACTION-FORM-T005` |
| Buttons | Real `<button>`, `type="button"` unless submitting | `Button.tsx` | `DS-T010` |
| Errors | Form refusals and error notices are `role="alert"`; success/info `role="status"` | `Notice.tsx`, `FormSheet.tsx`, `Dialog.tsx` | `DS-T016`, `DS-T017` |
| State not by colour alone | Stamps print the state; lifecycle steps show a number or ✓ plus visually hidden "Done:" | `Stamp.tsx`, `LifecyclePath.tsx` | `DS-T011`, `DS-T013` |
| Current step | `aria-current="step"`; current nav item `aria-current="page"` | `LifecyclePath.tsx`, `Sidebar.tsx` | `DS-T013` |
| Modal dialogs | Native `<dialog>` with `showModal()`: focus trapped, background inert, Escape cancels, focus returns to opener; `aria-labelledby` title | `Dialog.tsx` | `DS-T018` (markup); behaviour checked manually |
| Signing | Password field `autocomplete="current-password"`; manifest read before the password field in DOM order | `SignatureDialog.tsx` | `DS-T018` |
| Focus visible | 2 px ink outline on every control | `paper.module.css` | manual |
| Touch targets | 44 px minimum for buttons, inputs, dialog close | `paper.module.css` | manual |
| Motion | Transitions removed under `prefers-reduced-motion` | `paper.module.css` | manual |
| Fonts | System fonts; text scales with browser zoom (no fixed-height text boxes) | foundations | `DS-T003` |

## Contrast (computed from the tokens, WCAG formula)

| Pair | Light | Dark | Verdict |
| --- | --- | --- | --- |
| `--t1` ink on sheet | 13.5:1 | 13.4:1 | Pass |
| `--t2` on sheet | 5.2:1 | 6.4:1 | Pass |
| `--t2` on `--bg` | 4.9:1 | — | Pass |
| `--t2` on `--bg2` (sidebar links) | 4.4:1 | — | **Marginal fail** for 13 px text; known gap |
| `--t3` on sheet | 2.5:1 | 3.1:1 | **Fail for text**: use `--t3` only for decoration, inactive marks and dashed borders, never for information |
| `--danger` on sheet | 3.1:1 | 5.2:1 | **Fail for text in light**: never set text in `--danger`; use it for rules and borders (`FormError` and quiet-button hover were changed accordingly) |
| `--on-lime` on `--lime` | 10.9:1 | 10.9:1 | Pass |
| ink on `--lime3` | 11.4:1 | — | Pass |

## What every module must do

- Headings in order: page `h2` (PageIntro) → record `h3` → section `h4`.
- Landmarks: one `<nav>` per list of records (`aria-label`), `<article
  aria-labelledby>` for a record (`RecordSheet`), `<section aria-label(ledby)>`
  for its parts.
- Tables: `<th scope="col">`, a caption (visually hidden through `Ledger`'s
  `caption`) when the heading above does not name the table.
- A button that opens an in-page form carries `aria-expanded`.
- Never remove focus outlines; never use `tabindex` > 0; never put actions on
  non-interactive elements (`div onClick`).
- Images: none in the workspace; if one is added, it needs `alt`.
- Language: the root is `lang="en"`.

## What is not automated

- No browser accessibility scanner (axe or similar) runs in CI. The unit
  tests check rendered markup only.
- No keyboard-flow, focus-order or screen-reader test.
- Known gaps: sidebar link contrast (above); the shell's hamburger does not
  expose `aria-expanded`; the landing page and password-setup page use their
  own styles and were not reviewed against this page.

Adding an axe-based check in a browser test job is part of VER-DS-01
(`docs/ROADMAP.md`); until it exists, every UI pull request states in its
description which screens were checked by keyboard at 390 px and 1440 px.
