import { randomUUID } from "node:crypto";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it } from "vitest";
import Login from "../../src/application/usecase/Login";
import { SESSION_TTL_SECONDS } from "../../src/domain/SessionUser";
import { ForbiddenError, UnauthorizedError } from "../../src/domain/error/DomainErrors";
import TokenGeneratorJwt, { type JwtPayload } from "../../src/infra/auth/TokenGenerator";
import { AuthGuard } from "../../src/infra/guard/AuthGuard";
import { RoleGuard } from "../../src/infra/guard/RoleGuard";
import { ROLES_KEY } from "../../src/infra/guard/Roles";
import { FakeUnitOfWork } from "../support/InMemoryRepositories";
import PasswordHasherBcrypt from "../../src/infra/util/PasswordHasher";

const SECRET = "segredo-de-teste";
const OPERATOR_ID = randomUUID();

const contextFor = (
  request: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => {
      const handler = () => undefined;
      for (const [key, value] of Object.entries(metadata)) Reflect.defineMetadata(key, value, handler);
      return handler;
    },
    getClass: () => class {},
  }) as unknown as ExecutionContext;

describe("Login", () => {
  let unitOfWork: FakeUnitOfWork;
  let login: Login;
  const hasher = new PasswordHasherBcrypt(4);

  beforeEach(async () => {
    unitOfWork = new FakeUnitOfWork();
    unitOfWork.users.records.push({
      userId: OPERATOR_ID,
      name: "Ana Operadora",
      email: "operador@loja.com",
      cpf: "52998224725",
      birthDate: "1990-03-15",
      passwordHash: await hasher.hash("senha-correta"),
      role: "operador",
      active: true,
      mustChangePassword: false,
    });
    login = new Login(
      unitOfWork,
      hasher,
      new TokenGeneratorJwt(new JwtService({ secret: SECRET })),
    );
  });

  it("UT-037 recusa senha incorreta com mensagem genérica", async () => {
    const error = await login
      .execute({ email: "operador@loja.com", password: "senha-errada" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as Error).message).toBe("Credenciais inválidas");
  });

  it("UT-038 recusa e-mail inexistente com a mesma mensagem genérica", async () => {
    const error = await login
      .execute({ email: "ninguem@loja.com", password: "senha-correta" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as Error).message).toBe("Credenciais inválidas");
  });

  it("UT-039 emite JWT com o papel correto e expiração de 8h", async () => {
    const output = await login.execute({
      email: "operador@loja.com",
      password: "senha-correta",
    });

    const payload = new JwtService({ secret: SECRET }).verify<JwtPayload & { exp: number; iat: number }>(
      output.token,
    );
    expect(payload.role).toBe("operador");
    expect(payload.sub).toBe(OPERATOR_ID);
    expect(payload.exp - payload.iat).toBe(SESSION_TTL_SECONDS);
    expect(SESSION_TTL_SECONDS).toBe(8 * 60 * 60);
  });
});

describe("AuthGuard", () => {
  const guard = new AuthGuard(new Reflector());

  it("UT-040 recusa requisição cujo token expirou", () => {
    const jwtService = new JwtService({ secret: SECRET });
    const expired = jwtService.sign({ sub: OPERATOR_ID, role: "operador" }, { expiresIn: "-1s" });
    expect(() => jwtService.verify(expired)).toThrow();

    // passport-jwt entrega `user === false` quando o token não passa na verificação.
    expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedError);
  });

  it("UT-043 aceita requisição com token válido e não expirado", () => {
    const user = { userId: OPERATOR_ID, name: "Ana", email: "a@loja.com", role: "operador" };

    expect(guard.handleRequest(null, user)).toBe(user);
  });
});

describe("RoleGuard", () => {
  const guard = new RoleGuard(new Reflector());

  it("UT-041 recusa operador numa rota exclusiva de gerente", () => {
    const context = contextFor(
      { user: { userId: OPERATOR_ID, name: "Ana", email: "a@loja.com", role: "operador" } },
      { [ROLES_KEY]: ["gerente"] },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it("UT-042 recusa gerente numa rota exclusiva de operador", () => {
    const context = contextFor(
      { user: { userId: randomUUID(), name: "Gil", email: "g@loja.com", role: "gerente" } },
      { [ROLES_KEY]: ["operador"] },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it("libera a rota quando o papel do usuário está entre os permitidos", () => {
    const context = contextFor(
      { user: { userId: OPERATOR_ID, name: "Ana", email: "a@loja.com", role: "operador" } },
      { [ROLES_KEY]: ["operador"] },
    );

    expect(guard.canActivate(context)).toBe(true);
  });
});
