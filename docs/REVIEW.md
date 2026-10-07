# Pull Request Review Checklist

Veritas is developed and self-reviewed by Claude. The product owner approves and
merges every pull request and signs off every phase gate. Claude reviewing its own
work is a quality tool; it is not independent GxP review and does not replace the
qualified human reviewer of record.

## Roles

| Role | Who | Responsibility |
| --- | --- | --- |
| Author | Claude | Spec, implementation, tests, PR description |
| Reviewer | Claude | Review its own diff against this checklist before asking for approval |
| Approver | Product owner | Approve, merge, sign phase gates |
| Independent review | External CSV/QA consultant, pentester | Before the first customer pilot |

## How to review

1. Read the PR description first: what capability, which roadmap phase, which
   requirement IDs.
2. Review the diff against every section below. Report each finding with
   `file:line`, the concrete failure (input → wrong result), and a severity:
   **blocker**, **should fix**, or **nit**.
3. Do not add self-audit documents, containment stubs, or new process files.
   Findings go in PR comments only.
4. Fix every blocker and should-fix before asking the product owner to merge.
   Anything left open goes in the PR description for the owner to decide.

## Checklist

### Tenant isolation
- [ ] Every query on a tenant-owned model filters by `tenantId` in the database
      predicate (not after fetching).
- [ ] IDs taken from the request (user, document, version) are verified to
      belong to the caller's tenant before use.
- [ ] Storage keys are built server-side and are tenant-prefixed.

### Authorization
- [ ] Every handler calls `getContext` then `hasPermission` with a persisted
      permission name before reading input or data.
- [ ] Workflow actions also check the per-record assignment (reviewer, approver,
      trainee) where one exists.
- [ ] No decision depends on `User.role`, department, or any role-name string.

### Data integrity and audit
- [ ] Every regulated mutation writes `writeMandatoryAudit` inside the same
      `prisma.$transaction` as the change.
- [ ] Audit payloads carry before and after values for changed fields, and the
      reason where the action requires one.
- [ ] State changes use status-guarded `updateMany` and check the count
      (optimistic concurrency).
- [ ] Lifecycle transitions go through `assertTransition`.
- [ ] No path can change an EFFECTIVE, SUPERSEDED, or OBSOLETE version's content.

### Electronic signatures (once the signature service exists)
- [ ] Signing re-verifies the signer's password server-side in the same
      transaction as the state change and audit row.
- [ ] The signature row stores printed name, server time, enum meaning, and the
      hash of the signed content.

### API hygiene
- [ ] Unexpected errors return `unexpectedErrorResponse`; no exception text,
      IDs, or stack traces reach the client or the logs.
- [ ] Responses select explicit fields; no full user, IAM, or quiz-answer data.
- [ ] Regulated reads return `Cache-Control: no-store`.

### Database changes
- [ ] Schema changes come with a migration; destructive steps are called out.
- [ ] New tenant-owned models have `tenantId` and an index that serves their
      list query.

### Tests
- [ ] New behaviour has tests that exercise the route or library, not grep the
      source text.
- [ ] Each fix includes a test that fails without the fix.
- [ ] Negative cases: wrong tenant, missing permission, wrong assignee, stale
      state.
- [ ] `npx vitest run`, `npx tsc --noEmit`, and `npx eslint .` pass.
- [ ] Both CI jobs (`.github/workflows/ci.yml`) are green on the PR head: unit
      tests, types and lint; migration drift check and `npm run test:db`.

### Scope
- [ ] The PR delivers one capability from the current roadmap phase.
- [ ] No new module, route, or UI outside the current phase.
