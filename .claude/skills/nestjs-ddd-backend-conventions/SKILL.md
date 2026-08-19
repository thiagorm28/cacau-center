---
name: nestjs-ddd-backend-conventions
description: Enforces Clean Architecture and DDD layering for backend-* NestJS services: rich domain entities with private fields and static create() factories, value objects that validate in the constructor, one-usecase-per-file application classes with @Injectable() execute(input), NestJS-native dependency injection via provider tokens, repository/dao/gateway/queue/cache infra adapters, thin controllers with a global exception filter mapping domain errors to 422, and gateway/queue/EventEmitter2 rules for cross-context communication. Do not use for the React frontend or for non-NestJS backend code.
---

# NestJS DDD backend conventions

Applies to any `backend-*/src` code in this monorepo. Each `backend-*` is one
bounded context: own NestJS app, own Postgres database/schema, Clean
Architecture layers (`domain` / `application` / `infra`).

## Procedures

**File and folder conventions**

1. Mirror the layout `src/{domain,application/usecase,infra/{controller,repository,dao,gateway,queue,cache,database,module,retry,util}}`.
2. Put one class per file, file name matching the class name.
3. Use `export default` for plain classes (entities, value objects, use cases, repositories, gateways, adapters). Use `export class` (no `default`) only for Nest-decorated classes (`@Controller`, `@Module`, and other providers that lean on the framework's own naming conventions).
4. Keep a port's interface in the same file as its primary adapter (e.g. `OrderRepository` interface + `OrderRepositoryDatabase` class both in `OrderRepository.ts`).

**Domain layer (`src/domain`)**

1. Write entities as rich models carrying business rules, never as plain DTOs.
2. Make sensitive fields `private` with getters (`getOrderId()`, `getStatus()`); simple immutable fields set once in the constructor may stay `readonly` and public (e.g. `readonly marketId`, `readonly side`).
3. Create entities only via a static factory `static create(...)` that generates the id (`UUID.create()`), applies defaults, and delegates to the full constructor — the same constructor used to rehydrate an entity from persistence.
4. Model every field with its own validation rule as a Value Object (`UUID`, `Email`, `Password`, `Name`, `Document`, ...); validate inside the VO constructor and `throw new Error("message")` on invalid input — no custom exception classes, the message text is the error contract.
5. Put multi-field invariants (e.g. `quantity <= 0`, insufficient balance) in the owning entity's constructor/methods, not inside a Value Object.
6. Put business behavior on the entity itself (`Order.fill()`, `Wallet.processOrder()`, `Wallet.deposit()/withdraw()`, `Book.insert()` performing matching); use cases only orchestrate, they never reimplement entity logic.
7. Keep entities framework-free: no Nest decorators, no infra imports. When domain events need to fire, do it from the orchestrating use case via injected `EventEmitter2`, never from inside the entity.

**Application layer (`src/application/usecase`)**

1. Write one use case per file as a `@Injectable()` class exposing a single public `execute(input)` method.
2. Declare `Input` (and `Output` when needed) as plain `type`s in the same file — no DTO/class, and never reuse the HTTP controller's `class-validator` DTO here.
3. Inject dependencies through NestJS constructor injection only; never `new` a repository/gateway/queue adapter inside a use case.
4. For any port with more than one possible implementation (repository, gateway, queue), depend on the interface and receive it via `@Inject(TOKEN)`, where `TOKEN` is the string/`Symbol` bound in the owning `@Module`.
5. Keep use cases free of HTTP concepts (no `Request`/`Response`, no route decorators) — they take and return primitive/plain data only.
6. Orchestrate: load aggregate(s) via repository, call domain methods, persist, then `emitter.emit(event, payload)` for same-service reactions.

**Dependency injection**

1. Use only the NestJS DI container — no service locator, no other DI library (inversify, tsyringe, ...).
2. Decorate every injectable (use case, repository, gateway, queue adapter) with `@Injectable()`.
3. Bind each port to its implementation with a custom provider keyed by a token constant in the owning `@Module`, e.g. `{ provide: "OrderRepository", useClass: OrderRepositoryDatabase }`.
4. Type consumers' constructor parameters by the port interface, injected via `@Inject("OrderRepository")` — never by the concrete class (Dependency Inversion Principle).
5. Keep each `src/infra/module` module's own `providers`/`controllers`/`exports` self-contained; let `app.module.ts` only import these infra modules.

**Infrastructure layer (`src/infra`)**

1. Pair `interface X { ... }` with `class XDatabase`/`XHttp implements X` in the same file; use cases and controllers depend on the interface, never the concrete class.
2. In `repository`, convert between raw `pg-promise` rows and domain entities; always run Postgres `numeric` columns through `parseFloat` (pg-promise returns them as strings).
3. In `dao`, serve the read/projection side: return raw data (`any`), skip entity reconstruction — reads don't need business invariants.
4. In `gateway`, call another bounded context synchronously over `axios`; ship an interface plus an `XxxHttp` implementation.
5. In `queue`, model `connect`/`setup(exchange, queue)`/`publish(event, data)`/`consume(event, callback)` over `amqplib` via `RabbitMQAdapter`. Name the exchange after the domain event (e.g. `"orderPlaced"`) and the queue `"<event>.<consuming usecase>"` (e.g. `"orderPlaced.executeOrder"`). Wire each (event, consumer) pair with its own `queue.setup(...)` call inside the owning infra module. Only `ack` after the callback succeeds; log failures instead of relying on automatic requeue.
6. For same-service coupling, emit and listen with `@nestjs/event-emitter` (`EventEmitter2.emit(...)` from the producing use case, `@OnEvent("event")` on the listener) instead of building a custom mediator. In-process events are synchronous and never cross a process boundary, unlike the queue.
7. In `cache`, keep an in-memory map of live aggregates for the process lifetime (e.g. `BookCache` holding one `Book` per `marketId`) to avoid rehydrating on every request.
8. In `database`, expose `DatabaseConnection` (`query`/`close`) implemented by `PgPromiseAdapter`.
9. Build HTTP with the standard Nest adapter (`@nestjs/platform-express`) — no hand-rolled `HttpServer`/`ExpressAdapter`. Register one global `@Catch(Error)` exception filter that turns domain `Error`s into HTTP 422, keeping "exception message = error body" without a custom exception hierarchy.
10. Keep `controller` classes thin: `@Controller()`, receive use cases via constructor injection, validate the input DTO with `class-validator` when needed, call `useCase.execute(input)`, return its output — no business logic, no manual route registration.
11. Put cross-cutting infra helpers (`Retry.execute(fn, retries, timeout)`, `sleep`, ...) under `retry`/`util`.

**Composition root**

1. Let `app.module.ts` import each infra module (`OrderModule`, `WalletModule`, ...); each module already declares its own controllers/providers/imports.
2. In `main.ts`, follow the fixed bootstrap order: `NestFactory.create(AppModule)` → register global pipes/filters (DTO validation, the domain-error-to-422 exception filter) → let modules that need an async connection (e.g. the queue module) connect via their own `onModuleInit`/`onApplicationBootstrap` rather than a loose manual step in `main.ts` → `app.listen(port)`.
3. Keep each backend's port fixed and defined in its own `main.ts`.

**Cross-context communication and database**

1. Call another bounded context synchronously only through a `gateway` (`axios`) when the immediate response is required.
2. Propagate domain events to other services only through the RabbitMQ `queue`.
3. Inside one service, never call another use case directly — emit an event via `EventEmitter2` and let interested listeners react through `@OnEvent`.
4. Never import code from another `backend-*` directory; the only allowed contact points are `gateway` and `queue`.
5. Use SQL-first Postgres access via `pg-promise`, always parameterized (`$1, $2, ...`), never string concatenation, no ORM.
6. Write to the aggregate's normalized table on the write side; keep any read/query service's projection tables separate and updated asynchronously from queue events.

**TypeScript conventions**

1. Keep `strict: true`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `module: commonjs`, `target: es2016` in each backend's `tsconfig.json`.
2. Restrict `class-validator`/`class-transformer` DTOs to the HTTP boundary (controllers); keep domain/VO validation hand-written and framework-free.
3. Throw business errors as `throw new Error("Message in English")` — short message, becomes the HTTP 422 body via the global exception filter. Do not introduce a custom exception hierarchy.
4. Skip a separate mapper/DTO layer between internal layers; use plain `type Input`/`type Output` between use case and domain, with entity conversion living in the repository. Decorated DTOs exist only at the HTTP boundary.

## Error Handling

1. If a use case needs a dependency with more than one implementation and no provider token exists yet for it, add the token and its `@Module` binding before wiring the constructor injection — do not fall back to `new`.
2. If a business rule spans more than one field, move the check out of the Value Object and into the owning entity rather than adding cross-field logic to the VO.
3. If a domain error needs to reach HTTP callers, confirm the global `@Catch(Error)` filter is registered in `main.ts` instead of adding local `try/catch` + status-code logic to the controller.
