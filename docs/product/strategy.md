# Veritas product strategy

## Customers

- Small and mid-sized European biotech companies, CROs, smaller GMP-oriented
  manufacturers and regulated life-sciences suppliers.
- Initial focus: about 10–100 employees with little internal QA
  administration capacity.
- Core user: QA Manager, Head of Quality or Quality Director. Other users:
  document authors, reviewers, approvers, training coordinators, department
  managers and employees.

They need credible quality processes without the overhead of an enterprise
eQMS implementation.

## Positioning and differentiation

Differentiation is not ease of use alone. It is **connected quality
intelligence combined with manageable implementation effort**:

| Capability | Role |
| --- | --- |
| Quality Impact Map (VER-03) | Signature differentiator: from any change or event, see what is affected, why, and what to do. |
| Continuous evidence readiness (VER-04) | Second differentiator: specific, owned evidence gaps instead of a compliance score. |
| Guided setup (VER-05) | Adoption advantage: a small SOP library becomes a working document and training system without an implementation project. |
| Quality relationship graph (VER-01) | The architecture all three depend on. |

Security, traceability, validation support and human QA accountability are
non-negotiable foundations (VER-00), not features.

## Order of work

1. Close critical VER-00 gaps.
2. Build the minimum viable relationship graph (contracts and versioning first).
3. Change control on the graph.
4. Deviations and CAPA on the graph.
5. First working Quality Impact Map.
6. Evidence readiness.
7. Guided setup.
8. MVP acceptance and release gates (`docs/product/mvp-scope.md`).
9. Internal audits and supplier quality (VER-06).
10. Regulatory intelligence (VER-07).

Deterministic, auditable intelligence comes first; no premature AI. No graph
database, vector database, new microservice or general-purpose workflow engine
without a documented justification in the decision log.

## Working arrangement

Claude develops and self-reviews pull requests; Száva develops alongside; the
owner (Simpleafied Solutions) approves, merges and releases. Work is claimed
per GitHub issue so two people never change the same capability at once.
