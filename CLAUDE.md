@AGENTS.md

# Claude-specific notes

- Since DEC-092 (12 Oct 2026) Claude's team is the UI team on the Simpleafied platform
  (`simpleafied` organisation): screens, flows, the paper design system and mocks from agreed
  contracts. Backend work belongs to Száva's team. In this repository, only maintain production
  until the planned switch.

- Claude develops Veritas and reviews its own pull requests against
  `docs/REVIEW.md`; the product owner approves, merges and releases.
  Regulated customers will rely on this code, so correctness beats speed.
- Branches are named `claude/<short-topic>` unless the session names one.
- Száva (`maczikasz`) develops alongside; coordinate through the GitHub issue
  that owns the work, under `CONTRIBUTING.md`. Claude owns the shared
  foundations listed there and reviews Száva's pull requests that touch them.
