# Content guidelines

How Veritas speaks. The audience is a QA manager who will be asked by an
inspector to explain every word on the screen.

## Voice

- Plain, exact, calm. Say what happened, to which record, and what happens
  next: "Approval signed. The document must still be released to become
  effective."
- British English (organisation, authorise, colour) in the interface.
- Sentence case for every title, label and button ("Sign approval", not
  "Sign Approval"). Labels render in small caps by CSS; write them lowercase
  or sentence case.
- No exclamation marks, emoji, marketing adjectives ("seamless", "powerful",
  "luxury") or jokes.

## Forbidden claims

Never in UI, docs, commits or copy (`AGENTS.md`; `docs/REVIEW.md` checks it):

- "compliant", "Part 11 compliant", "Annex 11 compliant", "GxP-compliant",
  "compliance-ready"
- "validated", "inspection-ready", "audit-ready"
- Any score or percentage of readiness or compliance

Say instead what is **present, missing, overdue or awaiting review**, and why
(the rule and the relationship path).

## Status terminology

Show persisted enum values through `stateLabel` / `Stamp`; never invent a
synonym per screen.

| Value | Label | Meaning |
| --- | --- | --- |
| `DRAFT` | Draft | Being written; can change |
| `IN_REVIEW` | In review | Routed to its reviewer and approver |
| `APPROVED` | Approved | Signed by the approver; **not yet in force** |
| `EFFECTIVE` | Effective | In force (the only lime stamp) |
| `SUPERSEDED` | Superseded | Replaced by a newer effective revision |
| `OBSOLETE` | Obsolete | Retired from use; records kept |
| `WITHDRAWN` | Withdrawn | A revision abandoned before release |
| Training `ASSIGNED` / `COMPLETED` / `SUPERSEDED` | Open / Signed / Superseded | |

New modules add their states (e.g. change control, deviation, CAPA) to
`STATE_LABEL` in `src/ui/paper/Stamp.tsx` and to this table in the same PR.
Use "retire", never "delete", for taking a controlled record out of use.

Signature meanings are fixed words recorded with the signature
(`SIGNATURE_MEANINGS`, `src/lib/signatures.ts`): Reviewed, Approved,
Released, Retired, Read and understood. New meanings (e.g. Change approved,
CAPA effective) are added there, not invented in UI text.

## Dates and times

| Use | Format | Helper |
| --- | --- | --- |
| Date | `11 Oct 2026` | `formatDate` (`src/ui/paper/format.ts`) |
| Date and time | `11 Oct 2026, 14:02` (24 h) | `formatDateTime` |
| Audit trail times | UTC, stated ("times in UTC") | `src/lib/audit-ledger.ts` |
| Stored / API | ISO 8601 UTC | — |

Dates in tables are set in mono. Relative dates ("3 days ago") only next to
an absolute date, never instead of it.

## Record numbers and versions

| Record | Format | Status |
| --- | --- | --- |
| Document | `SOP-1A2B3C4D` (type prefix + 8 hex) | Implemented (`generateDocumentNumber`) |
| Change control, deviation, CAPA | `CC-2026-0001`, `DEV-2026-0001`, `CAPA-2026-0001`: per tenant, per type, per year, allocated in the creating transaction, never reused | **Proposed** (ADR-002 shared primitive; Claude delivers it in VER-02) |

Revisions are integers: "rev 3" in registers, "Revision 3" in the signature
dialog. Always show number and revision together when identifying a version:
"SOP-0001 rev 3". Hashes: first 12 hex characters and "…", full value on hover.

## Buttons and links

Verb + object, naming the result: "Submit for review", "Sign release (make
effective)", "Start revision 4", "Withdraw this revision", "Open the
effective copy". Cancel is always "Cancel".

## Messages

| Situation | Pattern | Example |
| --- | --- | --- |
| Success | What happened + what it means | "Revision withdrawn; the effective version remains in force." |
| Refusal | What is wrong, in the server's words | "The author cannot release their own version" |
| Empty | Why empty + what to do | "The register is empty. Start with a draft: upload the source file and give it a title." |
| Not available | Say so plainly | "Changing a member's role and deactivating a member are not available yet." |
| Hidden by permission | Say some exist without naming them | "Some related records are hidden by your permissions." |

## Synthetic data

Examples, tests, screenshots and the showcase use clearly synthetic names
(Ada Author, Rui Reviewer, Quinn Quality, `@example.test`) and never real
customer, patient or employee data.
