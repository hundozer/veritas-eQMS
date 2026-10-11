# Competitive MVP scope and release gate

The competitive MVP is VER-00 through VER-05 (`docs/ROADMAP.md`), each passed
against its own gate. In addition, all of these must hold:

- End-to-end acceptance tests for the integrated scenario: deviation →
  investigation → CAPA → change control → SOP revision → training →
  effectiveness verification → closure.
- Cross-tenant security tests for every new tenant-owned table and traversal.
- Permission and electronic-signature verification for every new controlled
  action.
- Recovery evidence: a documented, executed restore of production data into a
  separate environment.
- Export verification: evidence packages open, list every included artifact
  and match their integrity hashes.
- Validation-support documentation: intended use, user requirements, risk
  assessment, traceability, executed OQ, supplier information for customers.
- An independent security assessment and an independent QA review appropriate
  to the intended use.
- No unresolved critical issue affecting intended use.

Merged code alone never makes the MVP commercially or regulatorily ready. The
owner decides readiness and records it in the decision log.

## Out of the MVP

- Internal audits and supplier quality (VER-06).
- Regulatory intelligence (VER-07).
- AI-generated relationships or findings (allowed later only as reviewed
  suggestions, `docs/architecture/human-accountability.md`).
- SSO and self-service organisation sign-up.
