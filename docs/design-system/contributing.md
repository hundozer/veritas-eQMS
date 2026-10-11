# Contributing to the design system

The design system is shared by everyone who builds Veritas screens (Claude,
Száva and their coding agents). It changes only through this process, so
that two teams produce one product.

## Rules

1. **Use before you build.** Search `src/ui/paper/` and
   [components.md](components.md) first. If a shared component almost fits,
   propose a change to it; do not copy it into your module.
2. **No module-local copies of shared patterns.** Buttons, fields, stamps,
   record headers, lifecycle paths, signature boxes, ledgers, notices and
   dialogs come from `@/ui/paper`. Module CSS holds only layout and
   genuinely module-specific pieces.
3. **Tokens only.** No raw colours, no new custom properties outside the
   token files, no web fonts, no blurred shadows or rounded corners on paper
   elements (`DS-T001`–`DS-T003` enforce the first three).
4. **The shell is shared.** `AppShell`, `Sidebar` and `Header` are changed
   only by an agreed design-system PR, never as part of a module.
5. **Legacy is not a source.** Do not import the legacy `src/ui` components
   listed in [README.md](README.md) or reuse legacy CSS classes
   (`.create-btn`, `.status-card`, `.glass`, `page.module.css` modal and
   "luxury" classes).

## Proposing a change

| Change | How |
| --- | --- |
| New shared component, new variant, new token, change to the shell | Open a GitHub issue labelled `design-system` with: the need (which screen, which roadmap item), the proposed API (TypeScript props), states, accessibility behaviour, and a sketch. Tag the other team. Agree before coding. |
| Bug in a shared component | Fix it in a PR with a test that fails without the fix; tag the other team as reviewer. |
| Module-specific layout | No proposal needed; keep it in the module's CSS Module, tokens only. |

## Adopting it (the PR)

A design-system PR contains, together:

- the component or token in `src/ui/paper/` or the token files;
- a behaviour test in `src/ui/paper/paper.test.ts` (`DS-T0nn`, next free
  number) for its markup contract and accessibility;
- a specimen in the showcase (`src/app/dev/design-system/Showcase.tsx`);
- its entry in [components.md](components.md) (status "Implemented", path,
  API) or [foundations.md](foundations.md);
- migration of at least one real screen, or a stated reason why not yet
  (no unused shared code; the project rule is to delete unused code);
- a screenshot of the showcase specimen in light and dark in the PR
  description.

Review: the other team reviews every PR that touches `src/ui/`, the token
files, `AppShell`/`Sidebar`/`Header`, or `docs/design-system/`. The product
owner merges. A shared component is never changed in the same PR as a
module feature that depends on the change; land the shared change first.

## Automated gates

Run with every `npx vitest run` (and so in CI, job "Unit tests, types and lint"):

| ID | Gate | File |
| --- | --- | --- |
| DS-T001 | Governed stylesheets (`src/ui/paper`, `src/app/(app)`, `src/app/dev`) contain no raw colour values | `src/ui/paper/design-tokens.test.ts` |
| DS-T002 | Every custom property they read is a defined token (or set in that file) | same |
| DS-T003 | No remote font or stylesheet | same |
| DS-T004 | Light and dark themes define the same colour tokens | same |
| DS-T005 | No unused class in the shared stylesheet | same |
| DS-T010–T019 | Shared component markup, labels, roles, states, formats | `src/ui/paper/paper.test.ts` |
| DS-T020–T021 | Showcase is 404 in production builds, renders in development | `src/app/dev/design-system/page.test.ts` |
| STYLES-T001 | No unused class in `src/app/page.module.css` | `src/app/page-styles.test.ts` |

A new module's stylesheet is governed automatically when it lives under
`src/app/(app)`.

## What is not automated

- Visual regression (screenshot comparison).
- Browser accessibility scanning (axe).
- Responsive checks at 390 px / 1440 px.

These need a browser test job (Playwright with the preinstalled Chromium)
and are an open VER-DS-01 item. Until then a UI PR includes light/dark and
phone/desktop screenshots of the changed screens, and the reviewer checks
keyboard use.
