# Public File Quarantine Record

Date: 2026-08-23

| Field | Value |
| --- | --- |
| Original path | `public/uploads/1784960534661-this_is_test_sop.pdf` |
| Quarantine path | `docs/recovery/evidence/quarantined-public-files/1784960534661-this_is_test_sop.pdf` |
| SHA-256 | `fbcb2e570fcc70466754bbf38828eda34cfeb7bd6c051a323b892d15813e25ad` |
| Format | PDF 1.4, one page |
| Repository origin | Initial release commit `e4e8de3` |
| Application references | None found in `src/` or `prisma/` |
| Extractable text | None detected by `pdftotext` |
| Reason | Files under `public/` are served without application authentication or tenant authorization. A document-like test artifact must not be distributed from that boundary. |
| Disposition | Preserved outside the web root as recovery evidence; not deleted. |

The authenticated `/api/documents/[id]/pdf` route remains the controlled delivery path. It resolves content from authorized database metadata, enforces tenant membership and `documents.read`, verifies content integrity, and returns private, non-cacheable content.
