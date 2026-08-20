import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN,
  GERENTE,
  OPERADOR,
  USER_DEACTIVATED,
  USER_PENDING_CHANGE,
  type TestApp,
  jsonRequest,
  startTestApp,
} from "../support/TestApp";
import { REAL_FIXTURE_INVOICE_NUMBER, readRealNfeFixture } from "../support/nfeFixtures";

type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
};

const NEW_USER = {
  name: "Nina Nova",
  email: "nina@loja.com",
  cpf: "33344455508",
  birthDate: "1995-06-10",
  role: "operador" as const,
};

describe("Gestão de usuários (HTTP)", () => {
  let app: TestApp;
  let adminCookie: string;

  const listUsers = async (cookie = adminCookie): Promise<UserListItem[]> => {
    const response = await fetch(`${app.baseUrl}/users`, jsonRequest(cookie, "GET"));
    expect(response.status).toBe(200);
    return ((await response.json()) as { users: UserListItem[] }).users;
  };

  const idOf = async (email: string): Promise<string> => {
    const found = (await listUsers()).find((user) => user.email === email);
    if (found === undefined) throw new Error(`Usuário ${email} não encontrado na listagem`);
    return found.id;
  };

  const login = (credentials: { email: string; password: string }) =>
    fetch(`${app.baseUrl}/auth/login`, jsonRequest("", "POST", credentials));

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.reset();
    adminCookie = await app.login(ADMIN);
  });

  describe("Cadastro", () => {
    it("IT-005 POST /users com dados válidos cria usuário ativo com troca pendente", async () => {
      const response = await fetch(`${app.baseUrl}/users`, jsonRequest(adminCookie, "POST", NEW_USER));

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        name: NEW_USER.name,
        email: NEW_USER.email,
        role: "operador",
        active: true,
      });
      const created = (await listUsers()).find((user) => user.email === NEW_USER.email);
      expect(created).toMatchObject({ active: true, mustChangePassword: true });
    });

    it("IT-006 POST /users com role admin é recusado pelo DTO", async () => {
      const response = await fetch(
        `${app.baseUrl}/users`,
        jsonRequest(adminCookie, "POST", { ...NEW_USER, role: "admin" }),
      );

      expect(response.status).toBe(422);
      expect((await listUsers()).some((user) => user.email === NEW_USER.email)).toBe(false);
    });

    it("IT-007 POST /users sem cpf devolve 422", async () => {
      const { cpf: _cpf, ...semCpf } = NEW_USER;

      const response = await fetch(`${app.baseUrl}/users`, jsonRequest(adminCookie, "POST", semCpf));

      expect(response.status).toBe(422);
    });

    it("IT-008 POST /users com e-mail já cadastrado devolve 409", async () => {
      const response = await fetch(
        `${app.baseUrl}/users`,
        jsonRequest(adminCookie, "POST", { ...NEW_USER, email: OPERADOR.email }),
      );

      expect(response.status).toBe(409);
    });

    it("IT-009 POST /users com CPF de usuário desativado devolve 409", async () => {
      const response = await fetch(
        `${app.baseUrl}/users`,
        jsonRequest(adminCookie, "POST", { ...NEW_USER, cpf: USER_DEACTIVATED.cpf }),
      );

      expect(response.status).toBe(409);
    });

    it("IT-010 POST /users com CPF de dígito verificador inválido devolve 422", async () => {
      const response = await fetch(
        `${app.baseUrl}/users`,
        jsonRequest(adminCookie, "POST", { ...NEW_USER, cpf: "11144477736" }),
      );

      expect(response.status).toBe(422);
    });

    it("IT-011 dois cadastros simultâneos com o mesmo CPF: um 201 e um 409", async () => {
      const body = { ...NEW_USER, cpf: "44455566619" };

      const [first, second] = await Promise.all([
        fetch(`${app.baseUrl}/users`, jsonRequest(adminCookie, "POST", body)),
        fetch(
          `${app.baseUrl}/users`,
          jsonRequest(adminCookie, "POST", { ...body, email: "outra@loja.com" }),
        ),
      ]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
      expect((await listUsers()).filter((user) => user.name === NEW_USER.name)).toHaveLength(1);
    });
  });

  describe("Listagem e edição", () => {
    it("IT-012 GET /users como operador ou gerente devolve 403", async () => {
      for (const credentials of [OPERADOR, GERENTE]) {
        const cookie = await app.login(credentials);

        const response = await fetch(`${app.baseUrl}/users`, jsonRequest(cookie, "GET"));

        expect(response.status).toBe(403);
      }
    });

    it("IT-013 GET /users como admin devolve todos com nome, papel e status", async () => {
      const users = await listUsers();

      expect(users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: ADMIN.email, role: "admin", active: true }),
          expect.objectContaining({ email: OPERADOR.email, role: "operador", active: true }),
          expect.objectContaining({ email: GERENTE.email, role: "gerente", active: true }),
          expect.objectContaining({ email: USER_DEACTIVATED.email, active: false }),
        ]),
      );
      for (const user of users) expect(user).not.toHaveProperty("passwordHash");
    });

    it("IT-014 PATCH /users/:id altera nome, data e perfil e reflete na listagem", async () => {
      const operadorId = await idOf(OPERADOR.email);

      const response = await fetch(
        `${app.baseUrl}/users/${operadorId}`,
        jsonRequest(adminCookie, "PATCH", {
          name: "Ana Gerente",
          birthDate: "1991-04-16",
          role: "gerente",
        }),
      );

      expect(response.status).toBe(200);
      expect((await listUsers()).find((user) => user.id === operadorId)).toMatchObject({
        name: "Ana Gerente",
        role: "gerente",
      });
    });

    it("IT-015 PATCH /users/:id com role admin devolve 422", async () => {
      const operadorId = await idOf(OPERADOR.email);

      const response = await fetch(
        `${app.baseUrl}/users/${operadorId}`,
        jsonRequest(adminCookie, "PATCH", {
          name: "Ana Operadora",
          birthDate: "1990-03-15",
          role: "admin",
        }),
      );

      expect(response.status).toBe(422);
      expect((await listUsers()).find((user) => user.id === operadorId)?.role).toBe("operador");
    });
  });

  describe("Desativação e reativação", () => {
    it("IT-016 desativar um operador ativo recusa o login seguinte", async () => {
      const operadorId = await idOf(OPERADOR.email);

      const response = await fetch(
        `${app.baseUrl}/users/${operadorId}/deactivate`,
        jsonRequest(adminCookie, "POST"),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ id: operadorId, active: false });
      expect((await login(OPERADOR)).status).toBe(401);
    });

    it("IT-017 histórico preserva o nome de quem finalizou mesmo após a desativação", async () => {
      app.fixtureServer.respondWithXml(REAL_FIXTURE_INVOICE_NUMBER, readRealNfeFixture());
      const operadorCookie = await app.login(OPERADOR);
      const created = await fetch(
        `${app.baseUrl}/notes`,
        jsonRequest(operadorCookie, "POST", { invoiceNumber: REAL_FIXTURE_INVOICE_NUMBER }),
      );
      expect(created.status).toBe(201);
      const { noteId } = (await created.json()) as { noteId: string };
      const finalized = await fetch(
        `${app.baseUrl}/notes/${noteId}/finalize`,
        jsonRequest(operadorCookie, "POST", { confirmIncomplete: true }),
      );
      expect(finalized.status).toBe(200);

      const deactivate = await fetch(
        `${app.baseUrl}/users/${await idOf(OPERADOR.email)}/deactivate`,
        jsonRequest(adminCookie, "POST"),
      );
      expect(deactivate.status).toBe(200);

      const history = await fetch(`${app.baseUrl}/notes/history`, jsonRequest(adminCookie, "GET"));
      expect(history.status).toBe(200);
      await expect(history.json()).resolves.toEqual([
        expect.objectContaining({ noteId, closedByName: "Ana Operadora" }),
      ]);
    });

    it("IT-018 sessão já aberta perde o acesso assim que o usuário é desativado", async () => {
      const operadorCookie = await app.login(OPERADOR);
      expect((await fetch(`${app.baseUrl}/notes`, jsonRequest(operadorCookie, "GET"))).status).toBe(
        200,
      );

      const deactivate = await fetch(
        `${app.baseUrl}/users/${await idOf(OPERADOR.email)}/deactivate`,
        jsonRequest(adminCookie, "POST"),
      );
      expect(deactivate.status).toBe(200);

      const afterRevocation = await fetch(
        `${app.baseUrl}/notes`,
        jsonRequest(operadorCookie, "GET"),
      );

      expect(afterRevocation.status).toBe(401);
    });

    it("IT-019 desativar a própria conta admin devolve 403", async () => {
      const adminId = await idOf(ADMIN.email);

      const response = await fetch(
        `${app.baseUrl}/users/${adminId}/deactivate`,
        jsonRequest(adminCookie, "POST"),
      );

      expect(response.status).toBe(403);
      expect((await listUsers()).find((user) => user.id === adminId)?.active).toBe(true);
    });

    it("IT-020 reativar devolve o acesso com a senha anterior à desativação", async () => {
      const desativadoId = await idOf(USER_DEACTIVATED.email);
      expect((await login(USER_DEACTIVATED)).status).toBe(401);

      const response = await fetch(
        `${app.baseUrl}/users/${desativadoId}/reactivate`,
        jsonRequest(adminCookie, "POST"),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ id: desativadoId, active: true });
      expect((await login(USER_DEACTIVATED)).status).toBe(200);
    });
  });

  describe("Reset de senha", () => {
    /** Senha inicial recomputada do CPF/nascimento semeados para o operador. */
    const OPERADOR_INITIAL_PASSWORD = "52998224725@15031990";

    it("IT-021 resetar a senha invalida a antiga e reabre a troca obrigatória", async () => {
      const operadorId = await idOf(OPERADOR.email);

      const response = await fetch(
        `${app.baseUrl}/users/${operadorId}/reset-password`,
        jsonRequest(adminCookie, "POST"),
      );

      expect(response.status).toBe(200);
      expect((await login(OPERADOR)).status).toBe(401);
      const relogin = await login({
        email: OPERADOR.email,
        password: OPERADOR_INITIAL_PASSWORD,
      });
      expect(relogin.status).toBe(200);
      await expect(relogin.json()).resolves.toMatchObject({ mustChangePassword: true });
    });

    it("IT-022 resetar a senha de um usuário desativado devolve 409", async () => {
      const desativadoId = await idOf(USER_DEACTIVATED.email);

      const response = await fetch(
        `${app.baseUrl}/users/${desativadoId}/reset-password`,
        jsonRequest(adminCookie, "POST"),
      );

      expect(response.status).toBe(409);
    });

    it("IT-023 dois resets seguidos deixam o mesmo estado final, sem erro", async () => {
      const operadorId = await idOf(OPERADOR.email);
      const reset = () =>
        fetch(`${app.baseUrl}/users/${operadorId}/reset-password`, jsonRequest(adminCookie, "POST"));

      expect((await reset()).status).toBe(200);
      expect((await reset()).status).toBe(200);

      expect((await listUsers()).find((user) => user.id === operadorId)).toMatchObject({
        active: true,
        mustChangePassword: true,
      });
      expect(
        (await login({ email: OPERADOR.email, password: OPERADOR_INITIAL_PASSWORD })).status,
      ).toBe(200);
    });
  });

  describe("Controle de acesso", () => {
    it("IT-027 POST /users direto como operador devolve 403 sem vazar dados de usuários", async () => {
      const operadorCookie = await app.login(OPERADOR);

      const response = await fetch(
        `${app.baseUrl}/users`,
        jsonRequest(operadorCookie, "POST", NEW_USER),
      );

      expect(response.status).toBe(403);
      const body = await response.text();
      for (const email of [ADMIN.email, GERENTE.email, USER_PENDING_CHANGE.email]) {
        expect(body).not.toContain(email);
      }
      expect((await listUsers()).some((user) => user.email === NEW_USER.email)).toBe(false);
    });
  });
});
