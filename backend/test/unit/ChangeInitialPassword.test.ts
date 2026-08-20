import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import ChangeInitialPassword, {
  PASSWORDS_DO_NOT_MATCH,
  SAME_AS_INITIAL_PASSWORD,
} from "../../src/application/usecase/ChangeInitialPassword";
import PasswordHasherBcrypt from "../../src/infra/util/PasswordHasher";
import { FakeUnitOfWork } from "../support/InMemoryRepositories";

const hasher = new PasswordHasherBcrypt(4);
const USER_ID = randomUUID();
/** Senha inicial derivada do CPF/nascimento semeados abaixo (ADR-002). */
const INITIAL_PASSWORD = "11144477735@15031990";

const caught = (promise: Promise<unknown>): Promise<unknown> =>
  promise.catch((error: unknown) => error);

describe("ChangeInitialPassword", () => {
  let unitOfWork: FakeUnitOfWork;
  let changeInitialPassword: ChangeInitialPassword;

  beforeEach(async () => {
    unitOfWork = new FakeUnitOfWork();
    unitOfWork.users.records.push({
      userId: USER_ID,
      name: "Ana Operadora",
      email: "ana@loja.com",
      cpf: "11144477735",
      birthDate: "1990-03-15",
      passwordHash: await hasher.hash(INITIAL_PASSWORD),
      role: "operador",
      active: true,
      mustChangePassword: true,
    });
    changeInitialPassword = new ChangeInitialPassword(unitOfWork, hasher);
  });

  it("UT-035 troca a senha e encerra a obrigatoriedade", async () => {
    await changeInitialPassword.execute({
      userId: USER_ID,
      newPassword: "novaSenha1",
      confirmPassword: "novaSenha1",
    });

    const stored = unitOfWork.users.records[0];
    expect(stored?.mustChangePassword).toBe(false);
    await expect(hasher.compare("novaSenha1", stored?.passwordHash ?? "")).resolves.toBe(true);
  });

  it("UT-036 recusa quando a confirmação não coincide", async () => {
    const error = await caught(
      changeInitialPassword.execute({
        userId: USER_ID,
        newPassword: "novaSenha1",
        confirmPassword: "novaSenha2",
      }),
    );

    expect((error as Error).message).toBe(PASSWORDS_DO_NOT_MATCH);
    expect(unitOfWork.users.records[0]?.mustChangePassword).toBe(true);
  });

  it("UT-037 recusa nova senha igual à senha inicial recomputada", async () => {
    const error = await caught(
      changeInitialPassword.execute({
        userId: USER_ID,
        newPassword: INITIAL_PASSWORD,
        confirmPassword: INITIAL_PASSWORD,
      }),
    );

    expect((error as Error).message).toBe(SAME_AS_INITIAL_PASSWORD);
    expect(unitOfWork.users.records[0]?.mustChangePassword).toBe(true);
  });

  it("UT-038 aplica a política de senha: ≥8 caracteres e ≥1 dígito", async () => {
    const attempt = (password: string) =>
      caught(
        changeInitialPassword.execute({
          userId: USER_ID,
          newPassword: password,
          confirmPassword: password,
        }),
      );

    expect((await attempt("abc1234")) as Error).toBeInstanceOf(Error);
    expect(((await attempt("abcdefgh")) as Error).message).toBe(
      "A senha deve conter ao menos um dígito",
    );
    await expect(attempt("abcdefg1")).resolves.toBeUndefined();
    expect(unitOfWork.users.records[0]?.mustChangePassword).toBe(false);
  });
});
