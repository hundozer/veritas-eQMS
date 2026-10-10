# Validation pack

For every commit, CI generates a validation pack (DEC-081) from two sources:

- `requirements.json` in this folder: the user requirements, each with its
  hazard, severity and likelihood (1 to 3), the control, its source decision,
  and the IDs of the automated tests that verify it;
- the results of that commit's test run (unit tests, and the database and
  two-tenant isolation tests against PostgreSQL).

The pack holds `URS.md`, `risk-assessment.md`, `traceability-matrix.md` and
`OQ-execution.md` (the executed test record), plus a `README.md` summary. The
"Validation pack" job fails when a requirement links no test, links a test that
did not run, or links a test that failed.

## Where to find it

GitHub → Actions → the CI run of the commit → **Validation pack**: the summary
is shown on the run page, and the full pack is the artifact
`validation-pack-<commit>`, kept for 90 days. Download and file the pack of each
release you put into use; GitHub does not keep it longer.

## Maintaining the requirements

A new or changed capability updates `requirements.json` in the same pull
request: the requirement, its rating and the test IDs that verify it. Test IDs
are the prefix of the test title (for example `MFA-T007`). Ratings and wording
are reviewed like code.

The pack is generated evidence for review by a qualified person. It is not a
validation approval and makes no compliance claim.

Run it locally:

```sh
npx vitest run --reporter=default --reporter=json --outputFile.json=reports/unit.json
npm run test:db -- --reporter=default --reporter=json --outputFile.json=reports/db.json
node --experimental-strip-types src/lib/validation-pack.ts --requirements docs/validation/requirements.json \
  --report reports/unit.json --report reports/db.json --out validation-pack --commit local
```
