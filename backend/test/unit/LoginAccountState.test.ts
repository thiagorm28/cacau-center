import { randomUUID } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it } from "vitest";
import Login from "../../src/application/usecase/Login";
import { UnauthorizedError } from "../../src/domain/error/DomainErrors";
import TokenGeneratorJwt, { type JwtPayload } from "../../src/infra/auth/TokenGenerator";
import PasswordHasherBcrypt from "../../src/infra/util/PasswordHasher";
import { FakeUnitOfWork } from "../support/InMemoryRepositories";

const SECRET = "segredo-de-teste";
const USER_ID = randomUUID();

describe("Login (estado da conta)", () => {
  let unitOfWork: FakeUnitOfWork;
  let login: Login;
  const hasher = new PasswordHasherBcrypt(4);

  const seed = async (overrides: { active: boolean; mustChangePassword: boolean }) => {
    unitOfWork.users.records.push({
      userId: USER_ID,
      name: "Ana Operadora",
      email: "operador@loja.com",
      cpf: "52998224725",
      birthDate: "1990-03-15",
      passwordHash: await hasher.hash("senha-correta"),
      role: "operador",
      ...overrides,
    });
  };

  beforeEach(() => {
    unitOfWork = new FakeUnitOfWork();
    login = new Login(
      unitOfWork,
      hasher,
      new TokenGeneratorJwt(new JwtService({ secret: SECRET })),
    );
  });

  it("UT-039 recusa usuário desativado com a mesma mensagem genérica de credenciais", async () => {
    await seed({ active: false, mustChangePassword: false });

    const error = await login
      .execute({ email: "operador@loja.com", password: "senha-correta" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as Error).message).toBe("Credenciais inválidas");
  });

  it("UT-040 propaga mustChangePassword para o Output e para o payload do JWT", async () => {
    await seed({ active: true, mustChangePassword: true });

    const output = await login.execute({
      email: "operador@loja.com",
      password: "senha-correta",
    });

    expect(output.user.mustChangePassword).toBe(true);
    const payload = new JwtService({ secret: SECRET }).verify<JwtPayload>(output.token);
    expect(payload.mustChangePassword).toBe(true);
  });
});
