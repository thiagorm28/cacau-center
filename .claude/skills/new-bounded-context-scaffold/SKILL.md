---
name: new-bounded-context-scaffold
description: Guides creation of a new backend-* bounded context or microservice in this monorepo: requires discussing and confirming the split with the user before creating any backend-* directory, then scaffolds the package.json, tsconfig, vitest config, the domain/application/infra source tree, docker-compose registration, and the app.module.ts/main.ts composition root. Do not use for adding code inside an already-existing backend-* service or for frontend changes.
---

# New bounded context scaffold

Use only when the task is standing up a brand-new `backend-*` microservice/
bounded context in this monorepo, not for adding features inside one that
already exists.

## Procedures

1. **Stop and confirm first.** Before creating any file, raise the proposed split with the user and get explicit agreement that a new bounded context is warranted versus fitting the work into an existing `backend-*`. Creating a new `backend-*` directory is never a unilateral decision — do not proceed past this step without that confirmation.
2. Once confirmed, create `backend-<contexto>/` with `package.json`, `tsconfig.json`, and `vitest.config.js` matching the existing backends (Nest CLI/`nest new` as the starting point).
3. Replicate the standard tree: `src/domain`, `src/application/usecase`, `src/infra/{controller,repository,database,module,queue,...}` (see `nestjs-ddd-backend-conventions` for what belongs in each).
4. Register the new container in `docker/docker-compose.yaml`.
5. Add `app.module.ts` + `main.ts` as the composition root, following the same bootstrap order as other backends: import infra modules → register global pipes/filters → connect async infra (e.g. queue) via module lifecycle hooks → `app.listen(port)` on a fixed, unused port.
6. Wire communication with other services exclusively through a `gateway` (HTTP) or a `queue` (event) — never by importing code from another `backend-*` directory.

## Error Handling

1. If the user hasn't explicitly agreed a new bounded context is needed, stop and ask — do not scaffold speculatively "to see how it looks."
2. If the new service needs data or an event from an existing service, add a `gateway`/`queue` integration point rather than reaching into the other backend's source or database.
