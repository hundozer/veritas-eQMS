# Code examples

Patterns to copy when building a module. Every file here is **type-checked by
`npx tsc --noEmit` and linted by `npx eslint .`** against the real code at the
same commit, so imports, Prisma types and component props are correct. They
are not shipped: nothing routes to this folder and nothing imports it.

They use the existing `ChangeRequest` table and `change.*` permissions only
to have real types to compile against. **They are not the change-control
design**: its states, signatures and screens are fixed by the VER-02 pull
request. Where an example calls an endpoint that does not exist yet (a signed
change approval), the file says so.

| Example | Shows | Real counterpart |
| --- | --- | --- |
| `module-route.example.ts` | New module route: list and create, session → permission → validation → tenant transaction with audit | `src/app/api/documents/route.ts` |
| `workflow-action-route.example.ts` | A workflow action: lifecycle guard, status-guarded `updateMany`, audit, 409 on stale state | `src/app/api/documents/[id]/withdraw-revision/route.ts` |
| `change-control-lifecycle.example.ts` | Allowed transitions for a record type | `src/lib/document-lifecycle.ts` |
| `change-actions.example.ts` | Permission-aware actions: what the UI offers, from permissions and state | `src/lib/document-panel.ts` |
| `RecordList.example.tsx` | A record list with loading, empty and error states | `src/app/(app)/app/Documents.tsx` register |
| `RecordDetail.example.tsx` | A record detail with header, lifecycle, signature boxes, permission-aware buttons and the approval interaction | `Documents.tsx` `DocumentRecord`, `page.tsx` signing |
| `CreateDialog.example.tsx` | A creation form in a dialog | `page.tsx` new-draft dialog |

A related-record panel cannot be written against real code until the graph
API exists (VER-01); its contract is `RelatedRecords` in
`docs/design-system/components.md`. An auditable signed mutation for
non-document records waits for the generalised signature target; the
document version is in `src/app/api/documents/[id]/release/route.ts`.
