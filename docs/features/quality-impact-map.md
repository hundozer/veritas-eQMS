# Quality Impact Map (VER-03; engine decision ADR-003, DEC-088)

Status: specification. Signature differentiator. Depends on the relationship
graph (VER-01) and at least one quality workflow (VER-02).

## User story

From a controlled document (or revision), deviation, CAPA or change control,
a QA manager chooses **Assess impact**. Veritas lists what may be affected,
shows why each item appears, and lets the QA manager review each finding,
assign follow-up and approve the assessment as controlled evidence.

## Finding

| Field | Meaning |
| --- | --- |
| Affected record | Title, number, revision |
| Category | SOP, training requirement, people/department, control, open deviation, CAPA, change control, evidence |
| Relationship path | The edges walked from the starting record, each with its link type and provenance |
| Explanation | One sentence generated from the path and rule, e.g. "Trains QA and Production on SOP-014 rev 3, which this change affects" |
| Basis | `CONFIRMED` relationship, `SUGGESTED` relationship, or `UNMAPPED` (no relationship recorded, so impact unknown) |
| Source and version | Which version of each record the finding refers to |
| Responsible owner | Owner of the affected record, where one exists |
| Review status | `OPEN`, `RELEVANT`, `NOT_APPLICABLE` (justification required), `NEEDS_ASSESSMENT` |

## Engine (ADR-003)

1. **Deterministic traversal first.** Findings come from walking the graph
   (ADR-001) from the starting node with a versioned **rule set**: for each
   link type, whether impact propagates along it, in which direction, and to
   what depth. Example: a change to a document propagates to training
   requirements deriving from its versions, to controls it implements, to open
   deviations referencing it, and to people assigned training on it.
2. **Every finding names the rule** (`IMPACT-R003`) and the path that produced
   it, so the explanation is reproducible.
3. **Uncertainty is shown, not hidden.** Suggested links produce `SUGGESTED`
   findings. Records with no mapping where one would be expected (a document
   implementing no control) appear as `UNMAPPED`. Neither counts as a
   compliance failure.
4. **No silent changes.** Running an assessment never modifies a record,
   link or status. Follow-up happens through the normal workflows (open a
   change, start a revision, assign training), each linked back to the finding.
5. **Snapshots.** An assessment stores its findings, the rule set version and
   the graph state it read. Re-running creates a new assessment version; an
   approved assessment never changes.
6. **Approval is signed.** Approving the completed assessment is an electronic
   signature (meaning `IMPACT_ASSESSED`) and requires every finding to have a
   review status other than `OPEN`.

Data: `ImpactAssessment` (start node, rule set version, status, approver,
signature) and `ImpactFinding` (assessment, node, path, rule, basis,
disposition, justification, follow-up link), both tenant-scoped with
row-level security.

## Acceptance gate (VER-03)

A QA manager starts an impact assessment from an SOP revision, inspects the
affected records with their paths, disposes every finding (with justification
where not applicable), assigns follow-up actions, and approves the assessment
with a signature. The approved assessment is retrievable as evidence and
appears in the document's evidence package. Two-tenant and permission tests
cover the traversal and every write.
