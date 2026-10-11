# Continuous evidence readiness (VER-04; ADR-004, DEC-089)

Status: specification. Second differentiator. Depends on VER-01 and VER-02.

## User story

A QA manager opens **Evidence** and sees specific, owned gaps: what is missing
or overdue, why it matters, who is responsible, and the next step. Each gap
opens the workflow that resolves it. For a document, change, CAPA, training
programme or control, they can export an evidence package.

There is no percentage, grade or "compliance score".

## Findings

Each finding is produced by a numbered rule (`ER-001` …) and carries: what is
missing or overdue, why it matters (one sentence, from the rule), source
records, responsible owner, date or deadline, recommended next action (a link
to the workflow), and current status.

Initial rule catalogue:

| Rule | Condition |
| --- | --- |
| ER-001 | Effective document revision with open mandatory training |
| ER-002 | Training assignment overdue |
| ER-003 | CAPA awaiting effectiveness verification past its due date |
| ER-004 | Approved change control with incomplete implementation |
| ER-005 | Deviation open beyond its target date |
| ER-006 | Control with no supporting evidence, or evidence past its validity |
| ER-007 | Suggested link awaiting confirmation |
| ER-008 | Document past its periodic review date |

Rules live in code with ids and versions, each with its own tests. A new rule
or a change to one is a reviewed pull request.

## Evaluation (ADR-004)

- **On read for the MVP.** Rules run as tenant-scoped queries when the
  Evidence view or API is opened. At the expected scale this is fast and
  always current, with no background job to monitor.
- **Scheduled evaluation only for reminders.** When notifications about new
  gaps are needed, a scheduled job runs the same rules and records what it
  notified, so nothing is notified twice.
- Findings are computed, not stored as records; resolving the underlying
  record resolves the finding. Notifications and evidence packages record the
  findings they were based on.

## Evidence packages

A package for one subject (document, change control, CAPA, training
programme, control) contains the applicable record versions, signatures,
training records, linked records, approved impact assessments and the audit
history, plus:

- `manifest.json`: every included artifact with its record id, version,
  SHA-256 and the reason it is included (link path);
- package metadata: who generated it, when, and with which rule set and
  application version;
- the SHA-256 of the whole package, recorded in an `EVIDENCE_PACKAGE_EXPORTED`
  audit row before the file is returned (as the audit PDF export does,
  DEC-078).

## Acceptance gate (VER-04)

A QA manager identifies a specific gap, resolves it through the right workflow,
sees the finding disappear, and exports a package whose manifest lists and
verifies every artifact. Two-tenant and permission tests cover rules and
exports.
