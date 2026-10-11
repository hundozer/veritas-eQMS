# Quality relationship graph (ADR-001, DEC-086)

Status: accepted direction; schema details are fixed by the first implementing
pull request (VER-01) and recorded there. Applies to every module that links
quality records.

## Purpose

Answer, for any quality record, "what is it connected to, and why?", so that
impact assessment (VER-03) and evidence readiness (VER-04) can follow real,
explainable relationships. The graph records relationships; it never decides
compliance.

## Decision summary

1. **PostgreSQL, no graph database.** Customers have 10–100 people and
   thousands, not millions, of records. Recursive CTEs over indexed edge
   tables are enough; a graph or vector database needs a documented, measured
   reason first.
2. **Node registry with an exclusive arc.** Each linkable record gets one
   `QualityNode` row. The node has one nullable foreign-key column per record
   type (`documentId`, `documentVersionId`, `trainingRequirementId`,
   `changeRequestId`, `deviationId`, `capaId`, `controlId`, `evidenceId`,
   `userId`, …) and a CHECK that exactly the column matching `nodeType` is set.
   Every foreign key is composite `(id, tenantId)`, so a node cannot point
   into another tenant. Links reference nodes, never raw IDs. This avoids an
   unrestricted polymorphic table (the dormant `TenantRequirementMapping` is
   that anti-pattern and is not reused).
3. **Typed, enforced taxonomy.** `nodeType` and `linkType` are enums. The
   allowed `(sourceType, linkType, targetType)` triples are listed below, held
   in code (`src/lib/quality-graph/taxonomy.ts`) and enforced again in the
   database by a trigger that rejects other triples. A new triple needs a
   decision-log entry.
4. **Existing hard relations stay the source of truth.** Relations that
   already exist as foreign keys (a training requirement's document, an
   assignment's version, a version's document) are not copied into link rows.
   The graph reads them through adapters as `SYSTEM_DERIVED` edges, so they
   cannot drift. Link rows hold only relationships with no other home.
5. **Version-aware.** Where a claim is about a specific revision (training
   derives from SOP revision 3; a deviation references the revision in force),
   the link targets the version node. Where it is about the document as a whole
   (a change control affects SOP-014), it targets the document node.
6. **Never deleted.** Links are retired, not deleted: `retiredAt`,
   `retiredById`, `retiredReason`. History stays queryable "as of" any time.
7. **Every change is audited** with `writeMandatoryAudit` in the same
   `tenantTransaction` as the link write (`LINK_CREATED`, `LINK_CONFIRMED`,
   `LINK_RETIRED`).

## Node types (MVP)

`DOCUMENT`, `DOCUMENT_VERSION`, `TRAINING_REQUIREMENT`, `TRAINING_ASSIGNMENT`,
`CHANGE_CONTROL`, `DEVIATION`, `CAPA`, `CAPA_ACTION`, `CONTROL`, `EVIDENCE`,
`PERSON`. `REQUIREMENT` (regulatory) is added with VER-07.

`CONTROL` (an internal control the organisation commits to) and `EVIDENCE`
(an artifact that supports a control or a CAPA) are new tables, introduced
when first needed.

## Link taxonomy (MVP)

| Source | Link | Target | Typical origin |
| --- | --- | --- | --- |
| DOCUMENT | IMPLEMENTS | CONTROL | user asserted |
| TRAINING_REQUIREMENT | DERIVES_FROM | DOCUMENT_VERSION | system derived (existing FK) |
| TRAINING_ASSIGNMENT | TRAINS_ON | DOCUMENT_VERSION | system derived (existing FK) |
| CHANGE_CONTROL | AFFECTS | DOCUMENT | user asserted |
| CHANGE_CONTROL | IMPLEMENTED_BY | DOCUMENT_VERSION | user asserted when the revision is created from the change |
| DEVIATION | REFERENCES | DOCUMENT_VERSION | user asserted |
| CAPA | ADDRESSES | DEVIATION | user asserted |
| CAPA | RESULTS_IN | CHANGE_CONTROL | user asserted |
| EVIDENCE | SUPPORTS | CONTROL | user asserted |
| EVIDENCE | VERIFIES | CAPA | user asserted (effectiveness) |
| PERSON | OWNS | CHANGE_CONTROL, DEVIATION, CAPA, CAPA_ACTION, CONTROL | user asserted |

VER-07 adds `REQUIREMENT APPLIES_TO CONTROL` and
`REQUIREMENT ADDRESSED_BY DOCUMENT`.

## Link record

| Field | Meaning |
| --- | --- |
| `id`, `tenantId` | Row-level security on `tenantId`; composite foreign keys to nodes |
| `sourceNodeId`, `linkType`, `targetNodeId` | The typed edge |
| `status` | `CONFIRMED`, `SUGGESTED`, `NOT_APPLICABLE`, `RETIRED` |
| `provenance` | `USER_ASSERTED`, `SYSTEM_DERIVED`, `RULE_SUGGESTED`, `IMPORTED` |
| `rationale` | Why the link exists, in the user's words or the rule's id |
| `createdById`, `createdAt` | Who asserted it and when |
| `confirmedById`, `confirmedAt` | Who confirmed a suggested link |
| `retiredById`, `retiredAt`, `retiredReason` | End of validity; the row stays |

**Idempotency:** a partial unique index on
`(tenantId, sourceNodeId, linkType, targetNodeId) WHERE retiredAt IS NULL`.
Creating an existing live link returns it unchanged.

**Suggested links** (`RULE_SUGGESTED`) never count as confirmed relationships
anywhere until a person with the right permission confirms them
(`docs/architecture/human-accountability.md`).

## Traversal

- One function, `traverse(tenantId, startNode, options)`, inside `tenantRead`.
  It runs a recursive CTE over live links plus the system-derived adapters.
- **Bounded:** default depth 3, maximum 5; at most 500 nodes. A result marks
  itself `truncated` when it hits a bound.
- **Cycle-safe:** the CTE carries the visited path and never revisits a node.
- **Explainable:** every returned node carries its path (the edges walked) so
  the interface can show why it appears.
- **Permission-aware:** each node type maps to the permission needed to read
  it (`documents.read`, `training.read_all`, `change.read`, …). Nodes the
  caller cannot read are dropped, and the result says some were hidden without
  revealing which.
- **Paginated:** by a cursor on (depth, node id) for large neighbourhoods.

Indexes: `(tenantId, sourceNodeId)`, `(tenantId, targetNodeId)` on links;
`(tenantId, nodeType)` and the per-type foreign-key columns on nodes.

## What the graph must never do

- Infer compliance from the presence or absence of a link. A missing mapping
  is "unmapped", never "non-compliant".
- Cross tenants. Two-tenant tests cover every traversal and write.
- Treat a suggested or imported link as confirmed.

## Tests required by the first implementing pull request

- Two-tenant isolation for node and link reads and writes, and for traversal.
- Taxonomy enforcement in code and in the database (a disallowed triple is
  refused by both).
- Idempotent create, retire-not-delete, as-of history.
- Cycle and depth bounds; permission filtering.
- Audit rows written in the same transaction as each change.
