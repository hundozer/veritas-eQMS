# Disposable Database and Build Preflight

Date: 2026-08-25
Decision: `DEC-044`
Environment: local PostgreSQL 16.14, isolated temporary cluster

## Build/install result

- `DATABASE_URL=` plus `npx prisma generate`: **passed**. Package installation can generate the client without contacting a database.
- Application build with an absent `DATABASE_URL`: **failed closed as intended** during server-route evaluation with `Database configuration is unavailable`.
- Application build with a syntactically valid URL pointing to unreachable localhost port 1: **passed**, including 38 static pages. This proves compilation requires the configuration contract but does not connect to the database.
- `BLOB_READ_WRITE_TOKEN` was absent during the build and no storage network access occurred.

## Disposable migration result

- PostgreSQL cluster created in a random `/private/tmp` directory, trust-authenticated and bound only to `127.0.0.1:55439`.
- Database: newly created `veritas_recovery_test`; no seed or customer data.
- First `prisma migrate deploy`: all **12** active migrations applied successfully.
- Second `prisma migrate deploy`: **no pending migrations**.
- `prisma migrate status`: **database schema is up to date**.
- Live disposable database versus `prisma/schema.prisma`: **no difference detected** with `--exit-code`.
- Resulting public tables: **43**.
- Resulting canonical IAM permissions: **33**.
- Resulting IAM role-permission assignments: **0**, expected because a clean baseline contains no IAM roles and additive permission migrations deliberately do not create or infer roles.
- Temporary PostgreSQL servers were stopped automatically after each run.

## Deviations encountered and resolved

1. Initial sandboxed `initdb` was denied local System V shared memory; it removed the incomplete data directory. The test was rerun with approved local OS permission only.
2. The first successful migration run ended after migration verification because native `psql` rejected Prisma's `?schema=public` URL parameter. The temporary server stopped normally. A fresh run used separate Prisma/native URLs and completed every count, idempotency, and drift check.
3. A credential-empty application build failed at runtime database-client module evaluation. This is the approved fail-closed behavior, not a defect; the successful unreachable-URL build proves no compilation-time connection is required.

## Interpretation

The repository lineage is internally coherent for a new PostgreSQL database. This does **not** prove that the existing Neon/production database matches the baseline, has all migrations registered, contains safe tenant relationships, or has approved IAM assignments. Target inspection remains read-only until inventory and backup/recovery controls are approved.
