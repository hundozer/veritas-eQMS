# Architecture and API contracts for module work

The system as built: `docs/architecture/system-overview.md`. This file lists
the contracts a module codes against. **Implemented** contracts are stable;
change them only through an agreed issue. **Proposed** contracts are owned by
Claude and published with VER-01/VER-02; do not implement your own version.

## 1. Request pipeline (Implemented) — every route handler

```
getContext(req)                       → 401 Unauthorized if null
hasPermission(user, '<perm>')         → 403 Forbidden
validate body into typed values       → 400 ValidationFailed
tenantRead(user.tenantId, tx => …)    → 404 NotFound (filter by id AND tenantId)
lifecycle guard assertXTransition()   → 409 InvalidTransition
segregation-of-duties checks          → 409 SegregationOfDuties
signature verification (if signed)    → 403/429 SignatureFailed
tenantTransaction(user.tenantId, tx => {
  updateMany({ where: { id, tenantId, status: <expected> } }) → count must match, else 409 StaleWorkflowAction
  [recordSignature] [createLink] [create task]
  writeMandatoryAudit(tx, { context: user, action, objectType, objectId, payload: { before, after, reason }, requestUrl })
})
return NextResponse.json({ … explicit fields … })
catch → reportServerError('<event>') → 500 InternalError
```

Reference implementation: `src/app/api/documents/[id]/release/route.ts`.
Copyable: `examples/module-route.example.ts`, `examples/workflow-action-route.example.ts`.

## 2. Context (Implemented) — `src/lib/auth.ts`

```ts
interface UserContext {
  id: string; email: string; fullName: string;
  tenantId: string; tenantName: string;
  iamUserId: string; membershipId: string; roleId: string; membershipRole: string;
  permissions: readonly string[];
  role: string; department: string; clearance: string;   // legacy: never use for decisions
}
getContext(req?: NextRequest): Promise<UserContext | null>
hasPermission(user, permission: string, tenantId?: string): boolean   // src/lib/rbac.ts
```

The client gets the same permissions from `GET /api/auth/session` and derives
offered actions with pure functions (`src/lib/document-panel.ts` pattern;
`examples/change-actions.example.ts`).

## 3. Data access (Implemented) — `src/lib/tenant-db.ts`

```ts
tenantRead<T>(tenantId: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>
tenantTransaction<T>(tenantId: string, work: (tx) => Promise<T>): Promise<T>
```
Both set `app.tenant_id` for the transaction; RLS does the rest. Still filter
by `tenantId` in every `where` (defence in depth, `docs/REVIEW.md`). Blob I/O
never inside these.

## 4. Audit (Implemented) — `src/lib/audit.ts`

```ts
writeMandatoryAudit(tx, { context: UserContext; action: string; objectType: string; objectId?: string;
                          payload: Record<string, unknown>; sourceIp?: string; requestUrl?: string }): Promise<void>
```
Action names `UPPER_SNAKE`, record-prefixed, past tense. Payload: `before`,
`after` (changed fields), `reason` where required. Never personal data beyond
what the action needs.

## 5. Errors (Implemented)

Body: `{ "error": { "code": string, "message": string, "errorId"?: string } }`.
Codes: `Unauthorized` 401, `Forbidden` 403, `ValidationFailed` 400,
`NotFound` 404, `InvalidTransition` / `StaleWorkflowAction` /
`SegregationOfDuties` 409, `SignatureFailed` 403/429, `<Module>Disabled` 503,
`InternalError` 500. Messages are written for the end user (they are shown
verbatim in forms).

## 6. Electronic signatures

Implemented for document versions (`src/lib/signatures.ts`):
```ts
verifySignerOrRecordFailure(user, password, versionId, req): Promise<void>   // throws SignatureError
recordSignature(tx, { context, version: { id, documentId, versionNumber, hash }, meaning, comment?, sourceIp?, requestUrl? })
signatureFailedResponse(error: SignatureError): NextResponse
```
**Proposed** generalisation (Claude, VER-02): `recordSignature` with a
`target: { recordType, recordId, snapshotSha256 }` and module meanings. UI is
always `SignatureDialog`; request body `{ comment | reason, password }`.

## 7. Files (Implemented) — `src/lib/controlled-storage.ts`

Client: `prepareDocumentFile(file)` (`src/lib/document-file-upload.ts`) uploads
directly and returns `{ fileName, mimeType, uploadKey, sha256 }` (or
`contentBase64` for files up to 3 MB when storage is unreachable) to send. Server:
`resolveControlledUpload` → verify → `createControlledObjectKey` → store →
`cleanupUncontrolledObject` on failure. Reuse for module attachments once an
attachment contract is agreed; do not create a second storage path.

## 8. Quality relationship graph (Proposed, ADR-001)

Types (to be created in `src/lib/quality-graph/taxonomy.ts`):
```ts
type NodeType = 'DOCUMENT' | 'DOCUMENT_VERSION' | 'TRAINING_REQUIREMENT' | 'TRAINING_ASSIGNMENT' | 'CHANGE_CONTROL'
              | 'DEVIATION' | 'CAPA' | 'CAPA_ACTION' | 'CONTROL' | 'EVIDENCE' | 'PERSON';
type LinkType = 'IMPLEMENTS' | 'DERIVES_FROM' | 'TRAINS_ON' | 'AFFECTS' | 'IMPLEMENTED_BY' | 'REFERENCES'
              | 'ADDRESSES' | 'RESULTS_IN' | 'SUPPORTS' | 'VERIFIES' | 'OWNS';
type LinkStatus = 'CONFIRMED' | 'SUGGESTED' | 'NOT_APPLICABLE' | 'RETIRED';
type Provenance = 'USER_ASSERTED' | 'SYSTEM_DERIVED' | 'RULE_SUGGESTED' | 'IMPORTED';
```
Allowed triples: the table in ADR-001; enforced in code and by a database
trigger. Server API (in-transaction) and HTTP API shapes: handover chapter 9.
Traversal: bounded depth (default 3, max 5), ≤ 500 nodes, cycle-safe, every
node with its path, nodes the caller cannot read dropped with `hidden: true`.

## 9. Workflow primitives (Proposed, ADR-002)

- Lifecycle guard per record type (Implemented pattern:
  `src/lib/document-lifecycle.ts`; `examples/change-control-lifecycle.example.ts`).
- Record numbering `allocateRecordNumber(tx, tenantId, prefix)` → `CC-2026-0001`.
- `QualityTask` (source node, assignee, due date, status, completion evidence)
  driving "My work".
- No workflow engine.

## 10. Adding a tenant-owned table (process, Implemented pattern)

1. Agree it on the issue (Claude reviews every schema change).
2. Model with `tenantId`, `@@unique([id, tenantId])`, composite FKs, an index
   serving its list query.
3. Migration with `ENABLE ROW LEVEL SECURITY` and the `<Table>_tenant_isolation`
   policy (copy `20261007140000_tenant_row_level_security`).
4. A two-tenant test in `src/db-tests/` (copy `tenant-isolation.dbtest.ts`).
5. One migration in flight at a time (`CONTRIBUTING.md` rule 5).
