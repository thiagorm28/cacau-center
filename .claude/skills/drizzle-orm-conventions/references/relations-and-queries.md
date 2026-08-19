# Relations and query API

## Choosing a relations API

Drizzle ships two ways to declare relations:

- **`relations()`** (v1) — the long-standing, widely documented API. Default
  to this unless the project has already opted into v2.
- **`defineRelations()`** (v2) — newer, requires passing `relations` into
  `drizzle(...)` alongside `schema`, and simplifies many-to-many joins with
  `.through(...)`.

Pick one API per project and never mix `relations()` and `defineRelations()`
in the same schema. If the installed `drizzle-orm` version supports
`defineRelations` and the project has many-to-many tables, prefer it for new
schemas — `.through()` removes the need to hand-write the junction-table
relation on both sides.

## Declaring relations (v1 — default)

```ts
import { relations } from "drizzle-orm";
import { users, posts } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

Pass every `*Relations` object into `drizzle({ client, schema: { users, posts, usersRelations, postsRelations } })`
(or a dedicated `schema` object merging tables and relations) — relations
declared but not passed into `drizzle(...)` are silently invisible to
`db.query`.

Many-to-many (v1) always goes through an explicit junction table declared on
both sides:

```ts
export const usersToGroupsRelations = relations(usersToGroups, ({ one }) => ({
  user: one(users, { fields: [usersToGroups.userId], references: [users.id] }),
  group: one(groups, { fields: [usersToGroups.groupId], references: [groups.id] }),
}));
```

## Declaring relations (v2 — `defineRelations`)

```ts
import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  posts: {
    author: r.one.users({ from: r.posts.authorId, to: r.users.id }),
  },
  users: {
    groups: r.many.groups({
      from: r.users.id.through(r.usersToGroups.userId),
      to: r.groups.id.through(r.usersToGroups.groupId),
    }),
  },
}));

const db = drizzle({ client, schema, relations });
```

## Relational queries (`db.query`)

Use `db.query.<table>.findMany` / `findFirst` for parent/child reads:

```ts
const result = await db.query.posts.findMany({
  with: { author: true },
  where: (posts, { eq }) => eq(posts.published, true),
});
```

- Nest `with` for multi-level relations; use `columns: {}` on an
  intermediate junction relation to hide it from the result shape.
- Prefer this API by default for reads — it produces one round trip and the
  correctly nested/typed result without manual row-grouping.

## SQL-like query builder (CRUD)

Use the query builder for writes, and for reads that need aggregation, joins
across unrelated tables, or shapes `db.query` cannot express.

**Select**

```ts
import { eq, and } from "drizzle-orm";

const active = await db
  .select({ id: users.id, name: users.name })
  .from(users)
  .where(and(eq(users.isActive, true), eq(users.role, "admin")));
```

**Insert**

```ts
const [created] = await db.insert(users).values({ name: "Dan" }).returning();
```

**Update**

```ts
await db.update(users).set({ isActive: false }).where(eq(users.id, id));
```

**Delete**

```ts
await db.delete(users).where(eq(users.id, id));
```

**Upsert**

```ts
await db
  .insert(products)
  .values(data)
  .onConflictDoUpdate({
    target: products.id,
    set: { price: data.price, stock: data.stock },
  });
```

Rules:

- Build every filter with drizzle-orm operators (`eq`, `ne`, `and`, `or`,
  `inArray`, `gt`, `lt`, `isNull`, ...) imported from `"drizzle-orm"`. Never
  interpolate a variable directly into a `sql\`...\`` template.
- Call `.where()` at most once per query; combine multiple conditions with
  `and(...)`/`or(...)` instead of chaining `.where().where()` (a type error).
- Always call `.returning()` (optionally scoped to specific columns) on an
  `insert`/`update`/`delete` when the caller needs the affected row(s)
  instead of issuing a follow-up `select`.

## Transactions

```ts
await db.transaction(async (tx) => {
  await tx.update(accounts).set({ balance: sql`${accounts.balance} - ${amount}` }).where(eq(accounts.id, fromId));
  await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${amount}` }).where(eq(accounts.id, toId));
});
```

- Every statement inside a transaction callback must run through the `tx`
  parameter, never the outer `db`.
- Call `tx.rollback()` to abort and roll back explicitly on a business-rule
  failure detected mid-transaction (e.g. insufficient balance).
- A transaction callback may `return` a value; `db.transaction(...)`
  resolves to that value once the transaction commits.

## Prepared statements

For a query executed repeatedly with only parameter values changing (hot
request paths), prepare it once and reuse it:

```ts
const findUserById = db.query.users.findFirst({
  where: (users, { eq }) => eq(users.id, sql.placeholder("id")),
}).prepare();

const user = await findUserById.execute({ id });
```

Do not prepare one-off or rarely executed queries — it adds no benefit and
adds a statement-lifecycle to manage.
