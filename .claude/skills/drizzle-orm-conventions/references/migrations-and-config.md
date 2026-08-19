# drizzle-kit: config and migrations

## `drizzle.config.ts`

One config file per database, at the project root of the service that owns
that database:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
```

- `schema` must point at the barrel file that re-exports every table, enum,
  and relations object — not at the `schema/` directory glob, unless the
  project has no barrel yet.
- `out` is the migrations folder; keep it inside the owning service (e.g.
  `backend-orders/drizzle`), never shared across services/databases.
- Set `strict: true` and `verbose: true` so `generate`/`push` prompt on
  ambiguous changes (e.g. column rename vs. drop+add) instead of guessing.

## Workflow: generate + migrate (default, any real environment)

1. Change the schema in TypeScript.
2. Run `npx drizzle-kit generate` — this diffs the schema against the
   migrations folder and writes a new timestamped SQL file plus a snapshot;
   it does not touch the database.
3. Review the generated SQL like any other code change.
4. Run `npx drizzle-kit migrate` (or call the `migrate()` helper from
   `drizzle-orm/<driver>/migrator` at service startup) to apply pending
   migration files to the target database.
5. Commit the new files under `out` together with the schema change in the
   same commit/PR.

Once a migration file has been applied to any shared environment (staging,
prod), never edit it — write a new migration for further changes, even to
fix a mistake in the previous one.

## Workflow: push (local prototyping only)

`npx drizzle-kit push` diffs the schema against the live database and applies
the difference directly, with no migration file and no history. Use it only
for local, disposable databases before the first `generate` has run for a
given feature. Switch to generate+migrate as soon as the schema needs to
reach any environment other than the developer's own machine.

## Programmatic migration at startup

When a service should self-migrate on boot instead of via a separate deploy
step, call the driver-specific `migrate()` once, before the app starts
accepting traffic:

```ts
import { migrate } from "drizzle-orm/node-postgres/migrator";

await migrate(db, { migrationsFolder: "./drizzle" });
```

Use this only for the `generate`+`migrate` workflow's output folder — never
point it at a `push`-managed schema, since there are no migration files to
apply.
