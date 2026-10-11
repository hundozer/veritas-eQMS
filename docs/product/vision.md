# Veritas product vision

Owner directive of 11 Oct 2026 (Product Strategy Reset, Roadmap V3).

## Promise

**Know what changed. Know what it affects. Know what to do next.**

Veritas is a connected quality management platform for small and mid-sized
regulated life-sciences organisations. Its defining capability is answering,
for any change or quality event:

1. What changed?
2. What does that change affect?
3. What needs to happen next?
4. Who is responsible?
5. What evidence proves the work was completed?

This describes where the product is going, not what it does today. What exists
is in `docs/FEATURES.md` and `docs/product/current-state.md`. Do not present
the promise as a current capability in the product, in documentation or in
sales material.

## What Veritas is not

- Not a generic eQMS competing on module count, price or appearance.
- Not autonomous regulatory compliance software. Veritas does not decide
  compliance, approve quality decisions or sign records on anyone's behalf.
- Not "validated" or "Part 11 compliant" by virtue of its controls and tests.
  Customers validate for their intended use; Veritas supplies evidence that
  supports it.

## Product principles

Every feature, design and pull request follows these.

1. **Quality records are connected.** Documents, training, changes,
   deviations, CAPAs, controls and evidence are linked, not separate silos.
2. **Every insight is explainable.** When Veritas flags a record, the user can
   see the relationship path and the rule that produced it. No unexplained
   scores, no invented regulatory conclusions.
3. **Human decisions are authoritative.** Veritas may identify relationships,
   propose actions and flag gaps. Authorised people decide, and sign where a
   signature is required (`docs/architecture/human-accountability.md`).
4. **Evidence is traceable.** Every controlled decision is attributable to an
   authorised identity, a record version and an audit event.
5. **Designed for small QA teams.** Little configuration, no implementation
   project, no duplicated administration.
6. **Connected workflows over feature count.** One complete deviation → CAPA
   → change → SOP → training workflow beats five disconnected modules.
7. **Regulatory credibility.** No compliance claims without evidence.

## Experience

Veritas should feel like a quality operating system, organised around:

- **My work**: tasks, approvals, training and deadlines.
- **Quality records**: documents, deviations, CAPAs, changes and linked evidence.
- **Impact**: what a change or quality event affects.
- **Evidence**: what is complete, missing, overdue or awaiting review.
- **Administration**: people, roles, organisation and configuration.

The home page is not a generic KPI dashboard. The GMP-paper visual identity
stays. The Quality Impact Map is the flagship demonstration; working
interfaces are never replaced by decorative mock-ups.

Related: `docs/product/strategy.md`, `docs/product/mvp-scope.md`,
`docs/ROADMAP.md`.
