# Visual references

Captured on 11 Oct 2026 from the application running locally at the handover
branch (Next.js dev server, disposable PostgreSQL), signed in as a local
development quality manager, with **synthetic data** created only for these
captures (documents SOP-0001, SOP-0002, POL-0001, WI-0004; people "Dev
Author", "Dev Reviewer", "Dev Quality Manager"). No customer data.

Labels: **Existing implementation** = a screenshot of real, running code.
**Proposed design** and **Concept only** = not built; those are text
wireframes in `docs/design-system/patterns.md`, deliberately not drawn as
screens so they cannot be mistaken for implemented ones.

| File | Shows | Label |
| --- | --- | --- |
| `01-landing-existing.png` | Public landing page and sign-in (legacy "luxury" styling, outside the workspace system) | Existing implementation |
| `02-shell-overview-light-existing.png` | Application shell (binder sidebar, header) and the Overview: routing slips, register, training record | Existing implementation |
| `03-document-detail-light-existing.png` | Document list (register) and document detail: record header, lifecycle path, signature boxes, actions, revisions ledger; on the shared paper components | Existing implementation |
| `04-signing-dialog-light-existing.png` | Approval workflow: the signing dialog (release) with the signature manifest | Existing implementation |
| `05-training-light-existing.png` | Training interface: own assignments and the training matrix | Existing implementation |
| `06-people-light-existing.png` | Organisation administration: people ledger and invitation | Existing implementation |
| `07-audit-trail-light-existing.png` | Audit trail: filters and day ledger | Existing implementation |
| `08-document-detail-dark-existing.png` | Document detail in the dark theme | Existing implementation |
| `09-overview-phone-light-existing.png` | Overview at 390 px (phone) | Existing implementation |
| `10-showcase-light-existing.png` | Component showcase `/dev/design-system`, every shared component | Existing implementation (development only) |
| `11-showcase-dark-existing.png` | Showcase, dark theme | Existing implementation (development only) |
| `12-showcase-signature-refused-existing.png` | Signing dialog showing a refused password | Existing implementation (development only) |

Not captured, because they do not exist yet:

| Screen | Where its layout is described | Label |
| --- | --- | --- |
| Quality record detail (change control, deviation, CAPA) | patterns.md §2, §5; `examples/RecordDetail.example.tsx` | Proposed design |
| Quality Impact Map | patterns.md §6 | Concept only |
| Evidence readiness | patterns.md §7 | Concept only |
| Guided setup | patterns.md §8 | Concept only |

The red "1 Issue" badge in some captures is the Next.js development overlay
reporting a pre-existing hydration warning from the theme toggle (handover
known gaps); it does not appear in production builds.
