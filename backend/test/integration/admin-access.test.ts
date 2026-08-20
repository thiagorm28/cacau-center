import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN,
  OPERADOR,
  type TestApp,
  jsonRequest,
  sessionCookieFrom,
  startTestApp,
} from "../support/TestApp";

describe("Acesso irrestrito do admin (HTTP)", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.reset();
  });

  it("IT-001 POST /auth/login como admin devolve mustChangePassword no corpo", async () => {
    const response = await fetch(`${app.baseUrl}/auth/login`, jsonRequest("", "POST", ADMIN));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      role: "admin",
      mustChangePassword: false,
    });
  });

  it("IT-002 admin acessa rota @Roles(\"operador\") existente sem alteração na rota", async () => {
    const cookie = await app.login(ADMIN);

    const response = await fetch(`${app.baseUrl}/notes`, jsonRequest(cookie, "GET"));

    expect(response.status).toBe(200);
  });

  it("IT-003 admin acessa rota @Roles(\"gerente\") existente sem alteração na rota", async () => {
    const cookie = await app.login(ADMIN);

    const response = await fetch(`${app.baseUrl}/notes/history`, jsonRequest(cookie, "GET"));

    expect(response.status).toBe(200);
  });

  it("IT-004 sessão encerrada por logout não autentica mais uma rota protegida", async () => {
    const cookie = await app.login(OPERADOR);

    const logout = await fetch(`${app.baseUrl}/auth/logout`, jsonRequest(cookie, "POST"));
    expect(logout.status).toBe(204);

    const protectedRoute = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(sessionCookieFrom(logout), "GET"),
    );

    expect(protectedRoute.status).toBe(401);
  });
});
