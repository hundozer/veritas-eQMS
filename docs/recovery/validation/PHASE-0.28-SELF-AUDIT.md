# Phase 0.28 Self-Audit — Training Quiz and Sign-Off Containment

Date: 2026-08-24

## Scope and intended outcome

Prevent invalid training completion/e-signature evidence and browser disclosure of quiz answer keys while retaining least-privilege, tenant-safe assignment status views.

## Change review

- Replaced training POST with a no-argument, non-cacheable `503 TrainingCompletionDisabled` handler.
- Removed executable quiz grading, non-verified password acceptance, quiz-result creation, assignment completion, and success/failure audit paths.
- Removed quiz/sign-off submission state, handler, modal, password field, answer controls, and completion button from the UI.
- Removed fabricated fallback score `100` and regulatory-completeness language from training views.
- Retained GET behind persisted `training.read_own` or `training.read_all`.
- Added explicit current-user plus tenant scoping for own assignments and tenant relationship scoping for matrix reads.
- Replaced full relation includes with explicit assignment, limited user, document-summary, and quiz-result projections.
- Excluded `quizQuestions`, `correctAnswerIndex`, document versions/storage, and other document/user internals from training responses.
- Removed `training.complete_own` from the executable route contract without deleting its future canonical permission definition.
- Removed the dormant completion error event and reduced the unexpected-error path inventory from 26 to 25.

## Architecture, security, tenancy, UI, legal, and GxP audit

- **Identity/e-signature:** the route can no longer accept an arbitrary non-empty value as signer verification. Re-enablement requires current IAM credential reauthentication bound to assignment, document version, meaning, time, and result.
- **Assessment integrity:** correct answers and raw quiz definitions are not returned. A future assessment must store/version answer keys server-side and expose only question/option material appropriate for the attempt.
- **Authorization:** `training.read_all` selects the tenant matrix; otherwise `training.read_own` selects only current-user records. Role names do not grant access.
- **Tenant isolation:** matrix reads traverse users in the current tenant. Own reads require both current operational user ID and its tenant relationship.
- **Data minimization/privacy:** matrix user data is limited to ID, name, operational role, and department. Assignment/document/quiz-result projections contain only status-display fields. Training status remains personal/employment data requiring an approved purpose and retention policy.
- **Mutation/audit integrity:** disabled completion creates no quiz result, assignment update, or misleading audit evidence. Failed attempts also create no orphan results.
- **UI/truthfulness:** assigned items state that completion is unavailable. Historical completions display recorded evidence only when present and no longer invent a 100% score.
- **Legal/GxP:** this phase removes invalid evidence generation but does not establish training compliance, Part 11 signatures, qualification, or validated assessment effectiveness.

## Verification evidence

- Focused training route, UI, authorization, transaction-contract, error, and server-event tests: **33 passed** in six test files.
- Focused TypeScript validation: **passed**.
- Focused Prisma schema validation: **passed**.
- Full Vitest suite: **275 passed** in 46 test files.
- Final Prisma schema validation (`npx prisma validate`): **passed**.
- Final TypeScript (`npx tsc --noEmit`): **passed**.
- ESLint (`npm run lint`): **passed with 0 errors and 3 pre-existing warnings**.
- Production build (`npm run build`): **passed**, including Prisma generation, optimized compilation, TypeScript, page-data collection, and generation of 38 static pages.
- Answer-key/password/completion scans: **passed**; prohibited server and UI symbols are absent and POST references only the disabled handler.
- Diff whitespace check (`git diff --check`): **passed**.
- Manual scope/diff review: **passed**; reads are narrower and explicitly scoped, completion is inert, stale transaction contracts were removed, and no external system changed.

## Traceability

- Decision: `DEC-032`.
- Risks: `RISK-009`, `RISK-013`, `RISK-014`, and `RISK-025`.
- Requirement/matrix: `/api/trainings` in `API-AUTHORIZATION-MATRIX.md`.
- Tests: `TRAINING-T001` through `TRAINING-T004`, `TRAINING-UI-T001`, `TRAINING-UI-T002`, central route authorization, transaction-family, error-containment, and server-event contracts.

## Residual risk and closure judgment

- Historical completions, quiz attempts, scores, audit entries, and any shared/non-verified password use require controlled investigation.
- Training assignment and completion remain incomplete as a product workflow; only status reads are retained.
- Assignment creation/retraining triggers, version binding, overdue calculations, competency verification, and training effectiveness require separate design and validation.
- Deployed copies and previously exposed answer keys were not available for verification.

Closure status: **closed for repository training quiz and sign-off containment**. Validated completion redesign and historical evidence review remain pending.
