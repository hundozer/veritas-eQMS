# Human accountability (ADR-005, DEC-090)

Status: accepted. Applies to every feature, including future AI.

## Rule

Veritas may **compute, suggest and remind**. Only an authorised person may
**decide**, and a person **signs** where the decision is a GMP record. Nothing
automated changes a controlled record's status, approves, closes or signs.

## Classification of actions

| Class | Who acts | Examples |
| --- | --- | --- |
| **Automated** (deterministic, audited, no judgement) | The system | Derive system links from existing foreign keys; assign training to departments on release (DEC-073); compute impact findings and evidence gaps; create tasks and notifications from a decision a person made; record numbering |
| **Suggested** (shown as a suggestion, never counted as fact) | The system proposes, a person accepts or rejects | Suggested links (`RULE_SUGGESTED`); carrying links forward to a new revision; impact findings; recommended next actions; any AI output |
| **Human decision** (recorded with identity, audited) | Holder of the relevant permission | Confirm or reject a link; disposition of each impact finding (relevant / not applicable with justification / needs assessment); deviation classification; assigning owners and due dates |
| **Electronic signature** (password re-entry, meaning, version hash; `src/lib/signatures.ts`) | Authorised signer, never the system | Document review, approval, release, retirement; training read and understood; approval of an impact assessment; change control approval and closure; deviation QA closure; CAPA effectiveness and closure |

A decision taken on a suggestion records both: what was suggested (rule id or
source, and its inputs) and what the person decided.

## AI

No AI in the MVP. If added later:

- Output is always `RULE_SUGGESTED` or a labelled suggestion, never confirmed
  data.
- The model, its version and its inputs are recorded with the suggestion.
- A person confirms each suggestion before anything relies on it.
- No AI output ever sets a status, closes a record or signs.

## Compliance language

The product never states that an organisation, record or process is
"compliant", "validated" or "inspection-ready". Findings say what is present,
missing, overdue or awaiting review, and why.
