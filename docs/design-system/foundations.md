# Foundations: design tokens

Extracted from the code at the commit named in the handover
(`docs/handover/szava/VERITAS_DEVELOPMENT_HANDOVER.md`). Values here are the
values in the files; if they ever differ, the files win and this page is
corrected in the same pull request.

Tokens are CSS custom properties. There is **no Tailwind** and no CSS-in-JS
design layer: screens use CSS Modules (`*.module.css`) that read these
properties. MUI is installed and its `ThemeProvider`/`CssBaseline` are mounted
(`src/ui/providers/ThemeProvider.tsx`), but no workspace screen renders MUI
components; do not introduce them.

## The paper language in one paragraph

Ink-coloured 1–1.5 px rules on a near-white sheet; serif headlines, sans body,
monospace for anything a person might copy or compare (numbers, revisions,
dates, hashes); square corners; small-caps labels above values like a printed
form; a hard offset shadow (no blur) under the record sheet; one accent,
lime, reserved for what is **in force** and for **the box where the current
person signs**. Everything else is ink, greys and the danger red.

## Colour

Defined in `src/ui/styles/liquid-glass.css`. Both themes define the same names
(enforced by `DS-T004`).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#F7F8F3` | `#141714` | Page background behind sheets; form-sheet fill |
| `--bg2` | `#ECEEE6` | `#1A1E1A` | Sidebar (binder index) |
| `--card-bg` | `#fff` | `#1E211E` | Main column, record sheet, inputs |
| `--card-hover` | `#FAFBF7` | `#242724` | Legacy hover; prefer `--blight` |
| `--blight` | `#F0F1EB` | `#222520` | Hover wash on rows, outline buttons, nav |
| `--t1` | `#2D2F2A` | `#E8EAE3` | **Ink**: text, rules, primary button fill |
| `--t2` | `#6B6E65` | `#A0A39A` | Secondary text, labels, notes |
| `--t3` | `#A3A69D` | `#6B6E65` | Tertiary text, inactive marks, dashed empty border |
| `--border` | `#E0E3D8` | `#2B2E28` | Hairline rule between rows; offset shadow colour |
| `--dark` | `#464C3D` | `#E6EAD9` | Primary button hover |
| `--olive` | `#9AA981` | `#A5AD9B` | Scrollbar thumb only |
| `--lime` | `#BFE530` | `#BFE530` | In force (EFFECTIVE stamp), "your signature" box |
| `--lime3` | `#DEF3BC` | `#2E3A2B` | Current lifecycle step, signing box wash |
| `--lime2`, `--lime4`, `--lime5` | `#D1FA94`, `#E9F2D8`, `#f2f7e8` | `#C9EF70`, `#223020`, `#1c241b` | Legacy accents; do not use in new screens |
| `--on-lime` | `#1E241E` | `#1E241E` | Text and border on a lime fill (both themes) |
| `--danger` | `#FC5B3E` | `#FC5B3E` | Refusals, form errors, quiet-button hover (take out of use) |
| `--danger-bg` | `#FFF0ED` | `#3a221e` | Error notice wash |
| `--gold` | `#FFE388` | `#FFE388` | Due soon (overview only today) |
| `--gold-bg` | `#FFFBE8` | `#3b341f` | Due-soon wash |
| `--overlay` | `rgba(0,0,0,.4)` | `rgba(0,0,0,.6)` | Modal backdrop |
| `--sidebar-bg`, `--ring-track`, `--gauge-bg`, `--scroll-track` | | | Legacy or chrome; not for new screens |

Paper aliases in `src/app/globals.css` (resolve per theme):

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `var(--t1)` | Rules and text in the paper language |
| `--rule` | `var(--border)` | Hairline rules, offset shadow |

Older aliases in `globals.css` (`--primary`, `--text-main`, `--bg-surface`, …)
map to the legacy lime palette; new code uses the tokens above.

### Semantic status colours

Status is never shown by colour alone: a stamp always carries the state in
words, and the lifecycle path carries a number or a tick.

| Meaning | Treatment |
| --- | --- |
| In force (EFFECTIVE) | Lime fill, `--on-lime` text |
| Work in progress (DRAFT, WITHDRAWN) | Dashed ink outline |
| Awaiting a decision (IN_REVIEW, APPROVED, …) | Solid ink outline |
| Out of use (SUPERSEDED, OBSOLETE) | Grey outline, struck through |
| Refused / error | `--danger` rule and text, `--danger-bg` wash |
| Due soon | `--gold` (overview only; no shared component yet) |
| Overdue | Not designed yet; propose with VER-04 (use `--danger`, never colour alone) |

## Typography

System fonts only; no web font is ever loaded (`BUILD-T001`, `DS-T003`).

| Token | Stack | Use |
| --- | --- | --- |
| `--font-serif` | `'Iowan Old Style', 'Charter', 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif` | Headlines, record titles, section titles, wordmark, signature names (italic) |
| `--font-sans` | `Arial, Helvetica, system-ui, sans-serif` | Body, controls, buttons |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace` | Record numbers, revisions, dates, hashes, stamps, nav indices; always with `font-variant-numeric: tabular-nums` |

Root size: `html { font-size: 13.5px }` (`liquid-glass.css`; it overrides the
14 px in `globals.css`). The paper components set sizes in px:

| Role | Size / weight / line height | Where |
| --- | --- | --- |
| Page headline | serif 400, `clamp(28px, 3.4vw, 40px)`, 1.08, letter-spacing −0.02em | `PageIntro` |
| Overview headline | serif 400, `clamp(30px, 4vw, 48px)`, 1.06 | `dashboard.module.css` only |
| Record title | serif 400, `clamp(22px, 2.4vw, 28px)`, 1.2 | `RecordHeader` |
| Section / form title | serif 400, 20 px | `SectionTitle`, `FormSheet`, `Dialog` |
| Shell header title | serif 400, 1.35 rem | `Header` |
| Register entry title | serif, 17 px, 1.3 | Documents register |
| Lede | sans 15 px, `--t2` | `PageIntro` |
| Body, controls, buttons | sans 14 px (inputs 15 px), buttons 600 | everywhere |
| Note / hint | sans 14 / 13 px, 1.55, `--t2`, max 64ch | `Note`, field hints |
| Label | sans 12 px, `font-variant: small-caps; text-transform: lowercase; letter-spacing: .06em`, `--t2` | every labelled value |
| Mono small | 11–12 px | signature state, dates in tables, hashes |
| Stamp | mono 10 px, 700, letter-spacing .12em, uppercase | `Stamp` |

## Spacing and layout

There is no spacing token scale; the components use this set of px values.
New CSS uses only these: **4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 72**.

| Dimension | Value | Source |
| --- | --- | --- |
| Sidebar width | 232 px, sticky, full height | `.sidebar` in `liquid-glass.css` |
| Header | min-height 56 px, padding 12 × 28 px, sticky | `.header` |
| Content padding | 24 px 28 px 40 px | `.content` |
| Page max width | 1120 px (overview, showcase), 1240 px (documents) | module `.page` |
| Page vertical rhythm | `gap: 28–40px` between page sections; `padding: 8px 0 72px` | module `.page` |
| Record sheet padding | `clamp(16px, 2.4vw, 28px)`, inner gap 26 px | `RecordSheet` |
| Register / detail split | flex, register `1 1 320px`, record `999 1 560px`, gap 32 × 40 | Documents |
| Control height | 44 px minimum (buttons, inputs, close) | paper |
| Readable measure | notes 64ch, descriptions 68ch | paper |

## Borders, radii and shadows

| Element | Rule |
| --- | --- |
| Record sheet, form header cells, lifecycle, signature boxes | 1 px `--ink` |
| Buttons, inputs | 1.5 px `--ink` (quiet button 1 px `--rule`) |
| Page intro underline | 2 px `--ink` |
| Ledger header underline | 1.5 px `--ink`; rows 1 px `--rule` |
| Form sheet, dialog | 1 px `--ink`, **3 px top rule** |
| Selected register entry | 3 px `--ink` left rule |
| Radius | **0** for sheets, buttons, inputs, dialogs; 2 px stamp; 50% lifecycle marks |
| Shadow | Hard offset, no blur: record `4px 4px 0 var(--rule)`, slip `3px 3px 0`, dialog `6px 6px 0` |

The `--radius-*` (8–20 px, pill) and blurred `--shadow-*` tokens belong to the
legacy Verdant styles. **Do not use them in new screens.**

## Breakpoints

| Width | What changes |
| --- | --- |
| ≤ 640 px | Form-header cells stack; lifecycle and signature boxes go 2 × 2; ledger hides secondary columns |
| ≤ 720 px | Overview form header stacks; training rows reflow |
| ≤ 900 px | Documents: selecting a record scrolls it into view below the register |

The shell switches to its hamburger menu through `liquid-glass.css`; check
both a 390 px phone and a 1440 px desktop for every new screen.

## Motion

| Use | Value |
| --- | --- |
| Hover / press on buttons, rows | `transition: background-color 140ms ease`; press `translateY(1px)` |
| Sidebar links | `background .16s ease, color .16s ease` |
| Theme change | `var(--ts)` = `.25s` |
| Reduced motion | Every paper transition is removed under `prefers-reduced-motion: reduce` |

No entrance animations, parallax or decorative motion in new screens.

## Using tokens

```css
/* my-module.module.css */
.panel {
  border: 1px solid var(--ink);
  background: var(--card-bg);
  color: var(--ink);
  box-shadow: 4px 4px 0 var(--rule);
}
.meta { font-family: var(--font-mono); color: var(--t2); font-size: 12px; }
```

Never: raw colours (`#fff`, `rgba(…)`; `DS-T001` fails), undefined custom
properties (`DS-T002`), web fonts (`DS-T003`), inline colour styles in TSX,
rounded corners or blurred shadows on paper elements.

## Known inconsistencies (implemented system vs. target)

| Inconsistency | Status |
| --- | --- |
| Two palettes in one file: paper (in use) and legacy Verdant (lime pills, radii, blurred shadows, `.create-btn`, `.status-card`…) | Paper is the system. Legacy rules are kept only while a screen uses them; delete with the legacy components |
| `src/app/globals.css` declares self-referencing aliases (`--shadow-lg: var(--shadow-lg)`, `--radius-*`) that are invalid; `liquid-glass.css` wins by order | Clean up with the legacy deletion |
| `src/styles/liquid-glass.css` is an older copy kept only for a build-reproducibility test | Delete with the legacy deletion |
| Each workspace module (dashboard, training, people, audit trail) still re-declares `.mono`, `.label`, `.headline`, buttons | Documents and the in-page forms are migrated to `src/ui/paper`; the rest migrate under VER-DS-01 |
| Landing page and password setup use their own "luxury" styles with inline colours | Public pages; outside the workspace system for now |
| The invite form on People (`src/ui/components/InviteMemberPanel.tsx`) uses underline-only inputs, unlike the boxed paper fields | Migrate to `TextField`/`SelectField` with the People screen |
| `--gold` (due soon) has no shared component | Add a `DueDate` component with VER-04 |
