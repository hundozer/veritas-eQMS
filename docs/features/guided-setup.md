# Guided quality system setup (VER-05)

Status: specification. Adoption differentiator.

## User story

A new organisation's QA administrator sets up a working document and training
system in Veritas without a developer touching the database: organisation,
people and roles, departments, document taxonomy, an imported SOP library with
owners, training applicability and first assignments, and a readiness review
of what remains.

## Journey

1. Organisation configuration
2. QA administrator and roles
3. Department structure
4. Document taxonomy (types, numbering)
5. SOP import
6. Document owner assignment
7. Revision and effective-date review
8. Training applicability mapping
9. Initial training assignments
10. Setup readiness review

Each step can be left and resumed; the readiness review shows, per document,
exactly what remains before it can become controlled and effective.

## Import safeguards

- Preview before anything is written; file type and size validation; duplicate
  detection by SHA-256 and by number/title.
- Metadata mapping from the customer's spreadsheet or file names, confirmed by
  the user.
- **No fabricated approvals.** Imported files become drafts. A historical
  revision number and effective date can be recorded, labelled as declared by
  the importer, not as Veritas signatures.
- **No automatic conversion into controlled documents.** A document becomes
  effective in Veritas only through a signed release by an authorised person
  (for legacy documents, a release with the meaning `ADOPTED`, stating that
  the paper or previous-system history stays the record of earlier approvals).
- Every import, mapping confirmation and adoption writes audit rows.

## Acceptance gate (VER-05)

A new organisation imports a small SOP library, assigns owners and training
applicability, adopts the documents through signed releases, and gets working
training assignments, with no database intervention by a developer.
