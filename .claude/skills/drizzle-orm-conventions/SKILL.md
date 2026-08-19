---
name: drizzle-orm-conventions
description: Specifies Drizzle ORM as the ORM for SQL/PostgreSQL data access in TypeScript projects: pgTable schema definitions organized per bounded context, drizzle-kit config and migration workflow (generate plus migrate for production, push for prototyping), the relations() API paired with db.query relational queries, type-safe CRUD through the query builder (select, insert, update, delete, returning), db.transaction for multi-statement atomicity, and inferred row types via $inferSelect/$inferInsert instead of hand-written DTOs. Do not use for raw SQL or pg-promise-based backends, Prisma or TypeORM projects, or non-relational databases.
---

# Drizzle ORM conventions

Applies to any TypeScript service that persists to a SQL database through
Drizzle ORM. Examples default to PostgreSQL (`drizzle-orm/pg-core`); swap the
import path (`mysql-core`, `sqlite-core`) when the target dialect differs, the
same rules still apply.

## Procedures

**Project setup and connection**

1. Install `drizzle-orm` plus one driver package (`pg` for `node-postgres`, or
   `postgres` for `postgres.js`), and `drizzle-kit` as a dev dependency.
2. Create the database client in exactly one module (e.g.
   `src/infra/database/db.ts`) via `drizzle({ client, schema, relations })`
   from `drizzle-orm/node-postgres` (or `/postgres-js`) — never instantiate a
   second client elsewhere.
3. Always pass the full `schema` object into `drizzle(...)`, and pass
   `relations` too whenever any code uses `db.query.*`; omitting either
   silently disables relational queries and type inference for `with`.
4. Read `references/migrations-and-config.md` before creating or editing
   `drizzle.config.ts` or running any `drizzle-kit` command.

**Schema definition**

1. Define tables with `pgTable` (or the dialect equivalent), one table — or a
   small tightly related group — per file under a `schema/` directory, file
   name matching the table name.
2. Read `references/schema-and-types.md` before writing or modifying a table:
   it covers column type selection, constraints, indexes, and enum
   conventions.
3. Never hand-write row types or persistence DTOs; derive them with
   `typeof table.$inferSelect` and `typeof table.$inferInsert`.
4. Re-export every table and enum from a single `schema/index.ts` barrel so
   `drizzle-kit` and the app both import from one place.

**Relations and queries**

1. Read `references/relations-and-queries.md` before writing any join,
   relational query, or multi-statement operation.
2. Declare relations separately from table definitions and prefer
   `db.query.<table>.findMany` / `findFirst` with a `with` clause over manual
   joins whenever the shape is a straightforward parent/child fetch.
3. Fall back to the SQL-like builder (`db.select().from().leftJoin(...)`)
   only for aggregations, computed columns, or shapes the relational query
   API cannot express.
4. Wrap every multi-statement write in `db.transaction(async (tx) => {...})`
   and perform every statement inside it through `tx` — never mix `tx` and
   `db` calls within the same logical operation.
5. Build `where` conditions with drizzle-orm operators (`eq`, `and`, `or`,
   `inArray`, ...); never interpolate untrusted values into a `sql` template
   string.

**Migrations**

1. Treat `drizzle-kit generate` + `drizzle-kit migrate` as the only path for
   schema changes anywhere real data exists; reserve `drizzle-kit push` for
   local prototyping before the first migration is committed.
2. Commit every generated file under the configured migrations folder (e.g.
   `drizzle/`); never hand-edit a generated SQL migration once it has been
   applied anywhere.
3. Keep one `drizzle.config.ts` per database, pointing `schema` at the
   barrel file and `out` at that database's own migrations folder.

## Error Handling

1. If a query needs a shape the relational query API can't express (window
   functions, custom aggregates), switch to the SQL-like query builder or a
   `sql\`...\`` fragment instead of contorting `db.query`.
2. If `drizzle-kit generate` produces an unexpected diff, check the schema
   for an unintended type change or column rename before touching the
   generated SQL by hand.
3. If a write requires values computed from a prior read to stay consistent
   under concurrent access, put the read and the write in the same
   `db.transaction`, not as two sequential top-level calls.
