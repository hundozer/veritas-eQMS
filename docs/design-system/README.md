# Veritas design system

The shared visual language, components and interaction rules for every
Veritas screen (roadmap item **VER-DS-01**, `docs/ROADMAP.md`). Every
developer and coding agent, Claude and Száva's alike, builds from these
files; a module that looks or behaves differently is a defect.

Direction: **scientific precision + controlled GMP documentation + editorial
clarity.** Screens are drawn from the paper artefacts a quality team already
trusts: controlled-form headers, ruled registers, routing slips with
signature boxes, and state stamps.

| File | What it settles |
| --- | --- |
| [foundations.md](foundations.md) | Tokens: colour, type, spacing, layout, borders, shadows, breakpoints, motion |
| [components.md](components.md) | Every shared component: path, API, variants, states, accessibility; proposed contracts for those not built |
| [patterns.md](patterns.md) | Page templates (list, detail, create, approval, workflow, impact map, evidence, setup, admin) |
| [content-guidelines.md](content-guidelines.md) | Words: status terms, dates, record numbers, buttons, errors, forbidden claims |
| [accessibility.md](accessibility.md) | Keyboard, focus, labels, contrast, motion, what is and is not tested |
| [contributing.md](contributing.md) | How a token or component is proposed, reviewed and adopted; the automated gates |

## Where the code is

| Layer | Path | Status |
| --- | --- | --- |
| Tokens | `src/ui/styles/liquid-glass.css` (`:root`, `:root[data-theme='dark']`), `src/app/globals.css` (fonts, `--ink`, `--rule`) | Implemented |
| Shared paper components | `src/ui/paper/` (import from `@/ui/paper`) | Implemented, VER-DS-01 |
| Application shell | `src/ui/components/layout/` (`AppShell`, `Sidebar`, `Header`, `Wordmark`) | Implemented |
| Theme switch | `src/ui/providers/ThemeProvider.tsx` (`useThemeMode`) | Implemented |
| Component showcase | `/dev/design-system` (`src/app/dev/design-system/`), development builds only | Implemented |
| Legacy "Verdant" components | `src/ui/components/{ListPage,DataCard,DataColumn,StatusCards,FilterChips,ProgressRing,TimelineSteps,EnvironmentGauge,CommandPalette}.tsx`, `src/ui/providers/{Modal,Notification}Provider.tsx` | **Do not use.** Exported from `@/ui` but used by no screen; scheduled for deletion |

## See it

```bash
npm ci
npm run dev
# open http://localhost:3000/dev/design-system  (no database or sign-in needed)
```

The showcase renders the real components from `src/ui/paper` with synthetic
data; use the theme button to check dark mode. Production builds answer 404
for it (test `DS-T020`).

## Gates

`npx vitest run` runs the design-system gates with the rest of the unit
tests: token enforcement (`DS-T001`–`DS-T005`, `src/ui/paper/design-tokens.test.ts`)
and component behaviour (`DS-T010`–`DS-T019`, `src/ui/paper/paper.test.ts`).
Not automated yet: visual regression, browser accessibility scanning and
responsive screenshots (see [contributing.md](contributing.md#what-is-not-automated)).
