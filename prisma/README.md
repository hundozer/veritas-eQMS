# Prisma migration lineage

Veritas originally used a SQLite prototype migration lineage. Production and
development later moved to PostgreSQL outside Prisma Migrate. During schema
reconciliation, the existing PostgreSQL database was confirmed to match
`schema.prisma`.

The original SQLite migrations are preserved unchanged in
`migrations-sqlite-archive/` as historical evidence. They are not part of the
active Prisma migration lineage.

`20260812000000_postgresql_baseline` is the canonical PostgreSQL baseline. Do
not execute it against the existing Neon database: that database already has
the represented schema. First verify the baseline on a clean, disposable
PostgreSQL database. The existing Neon database may only be registered later
through Prisma-supported baseline resolution.

Generate all future migrations normally from this PostgreSQL baseline.
