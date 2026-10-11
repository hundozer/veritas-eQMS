# Acceptance checklist (definition of done)

Paste the block below into every pull-request description and tick it
honestly; leave an unticked box with a reason rather than ticking it. The
review checklist the reviewer applies is `docs/REVIEW.md`.

```markdown
## Summary
<!-- Which issue (VER-nn / #nnn), which capability, why. One capability per PR. -->

## Acceptance
- [ ] Functional acceptance criteria of the issue are met (list them):
- [ ] Only work from the current roadmap phase; no new module outside the roadmap

## Controls
- [ ] Every route: getContext → hasPermission (persisted permission) before reading input or data
- [ ] Per-record assignment and segregation of duties checked where they apply
- [ ] Every tenant-owned read/write inside tenantRead / tenantTransaction, filtered by tenantId
- [ ] New tenant-owned table: composite keys, RLS policy in the migration, two-tenant db test
- [ ] State changes: lifecycle guard + status-guarded updateMany with count check
- [ ] writeMandatoryAudit in the same transaction, with before/after and reason
- [ ] Electronic signature where ADR-005 requires it, via the shared signature service and SignatureDialog
- [ ] Relationships only through the ADR-001 graph contracts (no ad-hoc ID columns or polymorphic tables)
- [ ] Nothing automated approves, closes, signs or sets a controlled status
- [ ] Errors: user-facing messages; unexpected errors via reportServerError; no stack or ids leaked

## Design system
- [ ] Built from @/ui/paper and tokens only; DS gates pass; no module-local copies of shared components
- [ ] Shared component / token / shell changes were agreed in a design-system issue and reviewed by the other team
- [ ] Loading, empty and error states, each saying what to do
- [ ] Works at 390 px and 1440 px, light and dark (screenshots below)
- [ ] Keyboard: all actions reachable, Escape closes forms/dialogs, focus visible
- [ ] Words: sentence case, stateLabel/formatDate, no compliance claims

## Tests
- [ ] A test that fails without this change, for each behaviour and fix
- [ ] Negative cases: wrong tenant, missing permission, wrong assignee, stale state
- [ ] `npx vitest run` — result:
- [ ] `npx tsc --noEmit` — result:
- [ ] `npx eslint .` — result:
- [ ] `npm run test:db` (queries, routes, migrations, roles) — result:
- [ ] Integration test for the workflow path this PR adds

## Documentation
- [ ] docs/ROADMAP.md ticked; docs/product/current-state.md and docs/FEATURES.md updated if status changed
- [ ] ADR / docs/design-system updated if a contract or component changed
- [ ] docs/validation/requirements.json updated for a new controlled capability

## Coordination
- [ ] Issue claimed; no overlap with the other team's open PRs
- [ ] At most one migration in flight; migration timestamp later than main's latest
- [ ] Reviewer from the other team requested for shared code (CONTRIBUTING.md rule 9)

## Screenshots
<!-- light/dark, phone/desktop of every changed screen -->

## Known gaps
<!-- anything not done, and why -->
```

A feature is **done** only when the owner has merged it and CI is green on
`main`. Merged code does not make a phase gate passed; the owner decides gates.
