import { randomUUID } from "node:crypto";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import type { Role, SessionUser } from "../../src/domain/SessionUser";
import { ForbiddenError, UnauthorizedError } from "../../src/domain/error/DomainErrors";
import { SessionRevocationStore } from "../../src/infra/auth/SessionRevocationStore";
import { JwtStrategy } from "../../src/infra/auth/JwtStrategy";
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from "../../src/infra/guard/AllowPendingPasswordChange";
import { PasswordChangeGuard } from "../../src/infra/guard/PasswordChangeGuard";
import { RoleGuard } from "../../src/infra/guard/RoleGuard";
import { ROLES_KEY } from "../../src/infra/guard/Roles";

/** Mesmo padrão de `ExecutionContext` falso usado em `Auth.test.ts`. */
const contextFor = (
  request: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => {
      const handler = () => undefined;
      for (const [key, value] of Object.entries(metadata)) {
        Reflect.defineMetadata(key, value, handler);
      }
      return handler;
    },
    getClass: () => class {},
  }) as unknown as ExecutionContext;

const sessionUser = (role: Role, mustChangePassword = false): SessionUser => ({
  userId: randomUUID(),
  name: "Fulano",
  email: `${role}@loja.com`,
  role,
  mustChangePassword,
});

describe("RoleGuard (bypass do admin, ADR-006)", () => {
  const guard = new RoleGuard(new Reflector());

  it("UT-009 libera admin numa rota exclusiva de operador, sem consultar a lista", () => {
    const context = contextFor({ user: sessionUser("admin") }, { [ROLES_KEY]: ["operador"] });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("UT-010 continua recusando papel fora da lista da rota", () => {
    const context = contextFor({ user: sessionUser("operador") }, { [ROLES_KEY]: ["gerente"] });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it("UT-011 continua recusando requisição sem usuário anexado", () => {
    const context = contextFor({}, { [ROLES_KEY]: ["gerente"] });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedError);
  });
});

describe("PasswordChangeGuard", () => {
  const guard = new PasswordChangeGuard(new Reflector());

  it("UT-012 libera quem não tem troca de senha pendente", () => {
    const context = contextFor({ user: sessionUser("operador", false) });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("UT-013 libera rota marcada com @AllowPendingPasswordChange mesmo com troca pendente", () => {
    const context = contextFor(
      { user: sessionUser("operador", true) },
      { [ALLOW_PENDING_PASSWORD_CHANGE_KEY]: true },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it("UT-014 recusa rota sem o decorator quando a troca está pendente", () => {
    const context = contextFor({ user: sessionUser("operador", true) });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });
});

describe("JwtStrategy.validate", () => {
  const payloadFor = (userId: string, iat: number) => ({
    sub: userId,
    name: "Dona da Loja",
    email: "admin@loja.com",
    role: "admin" as const,
    mustChangePassword: true,
    iat,
  });

  it("UT-015 devolve o SessionUser com mustChangePassword quando não há revogação", () => {
    const revocations = new SessionRevocationStore();
    const strategy = new JwtStrategy("segredo-de-teste", revocations);
    const userId = randomUUID();

    const result = strategy.validate(payloadFor(userId, Math.floor(Date.now() / 1000)));

    expect(result).toEqual({
      userId,
      name: "Dona da Loja",
      email: "admin@loja.com",
      role: "admin",
      mustChangePassword: true,
    });
  });

  it("UT-016 devolve false quando o token foi emitido antes da revogação", () => {
    const revocations = new SessionRevocationStore();
    const strategy = new JwtStrategy("segredo-de-teste", revocations);
    const userId = randomUUID();
    const iatBefore = Math.floor(Date.now() / 1000) - 60;

    revocations.revoke(userId);

    expect(strategy.validate(payloadFor(userId, iatBefore))).toBe(false);
  });
});
