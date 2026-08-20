import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateUser, { DUPLICATE_CPF, DUPLICATE_EMAIL } from "../../src/application/usecase/CreateUser";
import DeactivateUser, {
  ADMIN_CANNOT_BE_DEACTIVATED,
} from "../../src/application/usecase/DeactivateUser";
import ListUsers from "../../src/application/usecase/ListUsers";
import ReactivateUser from "../../src/application/usecase/ReactivateUser";
import ResetPassword from "../../src/application/usecase/ResetPassword";
import UpdateUser from "../../src/application/usecase/UpdateUser";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../src/domain/error/DomainErrors";
import { SessionRevocationStore } from "../../src/infra/auth/SessionRevocationStore";
import type { UserRecord } from "../../src/infra/repository/UserRepository";
import PasswordHasherBcrypt from "../../src/infra/util/PasswordHasher";
import { FakeUnitOfWork } from "../support/InMemoryRepositories";

const hasher = new PasswordHasherBcrypt(4);

const VALID_INPUT = {
  name: "Nova Operadora",
  email: "nova@loja.com",
  cpf: "11144477735",
  birthDate: "1990-03-15",
  role: "operador" as const,
};

/** Senha inicial esperada para `VALID_INPUT` (ADR-002). */
const INITIAL_PASSWORD = "11144477735@15031990";

const seedUser = (
  unitOfWork: FakeUnitOfWork,
  overrides: Partial<UserRecord> = {},
): UserRecord => {
  const record: UserRecord = {
    userId: randomUUID(),
    name: "Ana Operadora",
    email: "ana@loja.com",
    cpf: "52998224725",
    birthDate: "1990-03-15",
    passwordHash: "hash-antigo",
    role: "operador",
    active: true,
    mustChangePassword: false,
    ...overrides,
  };
  unitOfWork.users.records.push(record);
  return record;
};

const caught = (promise: Promise<unknown>): Promise<unknown> =>
  promise.catch((error: unknown) => error);

describe("Gestão de usuários (casos de uso)", () => {
  let unitOfWork: FakeUnitOfWork;

  beforeEach(() => {
    unitOfWork = new FakeUnitOfWork();
  });

  describe("CreateUser", () => {
    let createUser: CreateUser;

    beforeEach(() => {
      createUser = new CreateUser(unitOfWork, hasher);
    });

    it("UT-017 cria usuário ativo, com troca pendente e senha inicial CPF@DDMMAAAA", async () => {
      const output = await createUser.execute(VALID_INPUT);

      expect(output).toMatchObject({
        name: VALID_INPUT.name,
        email: VALID_INPUT.email,
        role: "operador",
        active: true,
      });
      const [stored] = unitOfWork.users.records;
      expect(stored).toMatchObject({ active: true, mustChangePassword: true, cpf: "11144477735" });
      await expect(
        hasher.compare(INITIAL_PASSWORD, stored?.passwordHash ?? ""),
      ).resolves.toBe(true);
    });

    it("UT-018 recusa role admin vindo de chamada direta ao usecase (ADR-001)", async () => {
      const error = await caught(
        createUser.execute({ ...VALID_INPUT, role: "admin" as unknown as "operador" }),
      );

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("A conta admin não pode ser criada por esta rota");
      expect(unitOfWork.users.records).toHaveLength(0);
    });

    it("UT-019 recusa e-mail já usado por um usuário ativo", async () => {
      seedUser(unitOfWork, { email: VALID_INPUT.email, active: true });

      const error = await caught(createUser.execute(VALID_INPUT));

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as Error).message).toBe(DUPLICATE_EMAIL);
    });

    it("UT-020 recusa CPF já usado por um usuário desativado", async () => {
      seedUser(unitOfWork, { cpf: VALID_INPUT.cpf, active: false });

      const error = await caught(createUser.execute(VALID_INPUT));

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as Error).message).toBe(DUPLICATE_CPF);
    });

    it("UT-021 propaga o erro de CPF com dígito verificador inválido", async () => {
      const error = await caught(createUser.execute({ ...VALID_INPUT, cpf: "11144477736" }));

      expect((error as Error).message).toBe("CPF inválido");
      expect(unitOfWork.users.records).toHaveLength(0);
    });
  });

  describe("ListUsers", () => {
    let listUsers: ListUsers;

    beforeEach(() => {
      listUsers = new ListUsers(unitOfWork);
    });

    it("UT-022 devolve admin, operador e gerente com nome, papel e status", async () => {
      seedUser(unitOfWork, { name: "Dona da Loja", email: "admin@loja.com", role: "admin" });
      seedUser(unitOfWork, { name: "Ana Operadora", role: "operador" });
      seedUser(unitOfWork, {
        name: "Gil Gerente",
        email: "gil@loja.com",
        role: "gerente",
        active: false,
      });

      const output = await listUsers.execute();

      expect(output.users).toHaveLength(3);
      expect(output.users.map((user) => [user.name, user.role, user.active])).toEqual([
        ["Ana Operadora", "operador", true],
        ["Dona da Loja", "admin", true],
        ["Gil Gerente", "gerente", false],
      ]);
    });

    it("UT-023 devolve só o admin quando não há mais ninguém cadastrado", async () => {
      seedUser(unitOfWork, { name: "Dona da Loja", role: "admin" });

      const output = await listUsers.execute();

      expect(output.users).toHaveLength(1);
      expect(output.users[0]?.role).toBe("admin");
    });
  });

  describe("UpdateUser", () => {
    let updateUser: UpdateUser;

    beforeEach(() => {
      updateUser = new UpdateUser(unitOfWork);
    });

    it("UT-024 altera nome, data de nascimento e perfil e devolve o registro atualizado", async () => {
      const target = seedUser(unitOfWork);

      const output = await updateUser.execute({
        id: target.userId,
        name: "Ana Gerente",
        birthDate: "1991-04-16",
        role: "gerente",
      });

      expect(output).toMatchObject({
        id: target.userId,
        name: "Ana Gerente",
        birthDate: "1991-04-16",
        role: "gerente",
      });
      expect(unitOfWork.users.records[0]).toMatchObject({ name: "Ana Gerente", role: "gerente" });
    });

    it("UT-025 recusa id inexistente", async () => {
      const error = await caught(
        updateUser.execute({
          id: randomUUID(),
          name: "Fantasma",
          birthDate: "1991-04-16",
          role: "gerente",
        }),
      );

      expect(error).toBeInstanceOf(NotFoundError);
    });

    it("UT-026 recusa alvo com papel admin", async () => {
      const target = seedUser(unitOfWork, { role: "admin" });

      const error = await caught(
        updateUser.execute({
          id: target.userId,
          name: "Outro Nome",
          birthDate: "1991-04-16",
          role: "gerente",
        }),
      );

      expect(error).toBeInstanceOf(ForbiddenError);
      expect(unitOfWork.users.records[0]?.name).toBe("Ana Operadora");
    });
  });

  describe("DeactivateUser", () => {
    let revocations: SessionRevocationStore;
    let deactivateUser: DeactivateUser;

    beforeEach(() => {
      revocations = new SessionRevocationStore();
      deactivateUser = new DeactivateUser(unitOfWork, revocations);
    });

    it("UT-027 desativa e revoga as sessões abertas exatamente uma vez", async () => {
      const target = seedUser(unitOfWork);
      const revoke = vi.spyOn(revocations, "revoke");

      const output = await deactivateUser.execute({ id: target.userId });

      expect(output).toEqual({ id: target.userId, active: false });
      expect(unitOfWork.users.records[0]?.active).toBe(false);
      expect(revoke).toHaveBeenCalledExactlyOnceWith(target.userId);
    });

    it("UT-028 recusa id inexistente", async () => {
      const revoke = vi.spyOn(revocations, "revoke");

      const error = await caught(deactivateUser.execute({ id: randomUUID() }));

      expect(error).toBeInstanceOf(NotFoundError);
      expect(revoke).not.toHaveBeenCalled();
    });

    it("UT-029 recusa desativar a conta admin", async () => {
      const target = seedUser(unitOfWork, { role: "admin" });
      const revoke = vi.spyOn(revocations, "revoke");

      const error = await caught(deactivateUser.execute({ id: target.userId }));

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as Error).message).toBe(ADMIN_CANNOT_BE_DEACTIVATED);
      expect(unitOfWork.users.records[0]?.active).toBe(true);
      expect(revoke).not.toHaveBeenCalled();
    });
  });

  describe("ReactivateUser", () => {
    let reactivateUser: ReactivateUser;

    beforeEach(() => {
      reactivateUser = new ReactivateUser(unitOfWork);
    });

    it("UT-030 reativa sem tocar na senha nem na troca obrigatória", async () => {
      const target = seedUser(unitOfWork, { active: false, passwordHash: "hash-preservado" });

      const output = await reactivateUser.execute({ id: target.userId });

      expect(output).toEqual({ id: target.userId, active: true });
      expect(unitOfWork.users.records[0]).toMatchObject({
        active: true,
        passwordHash: "hash-preservado",
        mustChangePassword: false,
      });
    });

    it("UT-031 recusa id inexistente", async () => {
      const error = await caught(reactivateUser.execute({ id: randomUUID() }));

      expect(error).toBeInstanceOf(NotFoundError);
    });
  });

  describe("ResetPassword", () => {
    let resetPassword: ResetPassword;

    beforeEach(() => {
      resetPassword = new ResetPassword(unitOfWork, hasher);
    });

    it("UT-032 recoloca a senha inicial e reabre a troca obrigatória", async () => {
      const target = seedUser(unitOfWork, { cpf: "11144477735", birthDate: "1990-03-15" });

      await resetPassword.execute({ id: target.userId });

      const stored = unitOfWork.users.records[0];
      expect(stored?.mustChangePassword).toBe(true);
      await expect(hasher.compare(INITIAL_PASSWORD, stored?.passwordHash ?? "")).resolves.toBe(
        true,
      );
    });

    it("UT-033 recusa reset de usuário desativado", async () => {
      const target = seedUser(unitOfWork, { active: false });

      const error = await caught(resetPassword.execute({ id: target.userId }));

      expect(error).toBeInstanceOf(ConflictError);
      expect(unitOfWork.users.records[0]?.passwordHash).toBe("hash-antigo");
    });

    it("UT-034 é idempotente: dois resets seguidos deixam o mesmo estado final", async () => {
      const target = seedUser(unitOfWork, { cpf: "11144477735", birthDate: "1990-03-15" });

      await resetPassword.execute({ id: target.userId });
      await resetPassword.execute({ id: target.userId });

      const stored = unitOfWork.users.records[0];
      expect(stored?.mustChangePassword).toBe(true);
      expect(stored?.active).toBe(true);
      await expect(hasher.compare(INITIAL_PASSWORD, stored?.passwordHash ?? "")).resolves.toBe(
        true,
      );
    });
  });
});
