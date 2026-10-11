# Design system quick reference

Authoritative: `docs/design-system/` (foundations, components, patterns,
content, accessibility, contributing). This page is the one-screen summary.
See everything live at `/dev/design-system` (`npm run dev`).

## Look

Ink rules on a near-white sheet; square corners; hard offset shadow, no blur;
serif headings, sans body, mono for numbers, revisions, dates and hashes;
small-caps labels; one accent (lime) for "in force" and "your signature".

## Tokens you will use

| Purpose | Token |
| --- | --- |
| Text and rules (ink) | `--ink` (= `--t1`) |
| Secondary / tertiary text | `--t2` / `--t3` (decoration only) |
| Hairline rule, offset shadow | `--rule` (= `--border`) |
| Sheet / page / sidebar | `--card-bg` / `--bg` / `--bg2` |
| Hover wash | `--blight` |
| In force, your signature box | `--lime` with `--on-lime` text |
| Current step wash | `--lime3` |
| Refusal rule / wash | `--danger` (never as text colour) / `--danger-bg` |
| Due soon | `--gold` |
| Fonts | `--font-serif`, `--font-sans`, `--font-mono` |

Spacing values: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 72 px.
Control height 44 px. Breakpoints 640 / 720 / 900 px. Transitions 140 ms
background-colour only; none under reduced motion.

## Do / don't

| Do | Don't |
| --- | --- |
| `import { Button, Ledger, Stamp } from '@/ui/paper'` | Write your own `.primary` button class |
| `border: 1px solid var(--ink)` | `border: 1px solid #2D2F2A` or `rgba(…)` (fails `DS-T001`) |
| `box-shadow: 4px 4px 0 var(--rule)` | Blurred shadows, `--shadow-lg`, rounded `--radius-*` |
| State as `<Stamp state="IN_REVIEW" />` | Coloured pill with a custom label |
| `formatDate(iso)` → 11 Oct 2026 | `toLocaleDateString()` with the browser locale |
| Sentence case, verbs naming the result | Title Case, "OK", "Submit" |
| Present / missing / overdue / awaiting review | "Compliant", "validated", "ready", percentages |

## Screenshots

`visual-references/03-document-detail-light-existing.png` is the reference
for a record detail; `10-showcase-light-existing.png` for every component.
