import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  GERENTE,
  OPERADOR,
  type TestApp,
  jsonRequest,
  sessionCookieFrom,
  startTestApp,
} from "../support/TestApp";

describe("Autenticação e papéis (HTTP)", () => {
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

  it("IT-012 login válido devolve cookie de sessão que autentica GET /auth/me", async () => {
    const login = await fetch(
      `${app.baseUrl}/auth/login`,
      jsonRequest("", "POST", OPERADOR),
    );
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");

    const me = await fetch(
      `${app.baseUrl}/auth/me`,
      jsonRequest(sessionCookieFrom(login), "GET"),
    );

    expect(me.status).toBe(200);
    await expect(me.json()).resolves.toMatchObject({ name: "Ana Operadora", role: "operador" });
  });

  it("IT-013 GET /auth/me sem cookie devolve 401", async () => {
    const response = await fetch(`${app.baseUrl}/auth/me`, jsonRequest("", "GET"));

    expect(response.status).toBe(401);
  });

  it("IT-014 GET /notes/history como operador devolve 403", async () => {
    const cookie = await app.login(OPERADOR);

    const response = await fetch(`${app.baseUrl}/notes/history`, jsonRequest(cookie, "GET"));

    expect(response.status).toBe(403);
  });

  it("IT-015 POST /notes como gerente devolve 403", async () => {
    const cookie = await app.login(GERENTE);

    const response = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(cookie, "POST", { invoiceNumber: "004005647" }),
    );

    expect(response.status).toBe(403);
  });

  it("IT-023 login com senha incorreta devolve 401", async () => {
    const response = await fetch(
      `${app.baseUrl}/auth/login`,
      jsonRequest("", "POST", { email: OPERADOR.email, password: "senha-errada" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ message: "Credenciais inválidas" });
  });

  it("IT-024 logout limpa o cookie e a sessão seguinte devolve 401", async () => {
    const cookie = await app.login(OPERADOR);

    const logout = await fetch(`${app.baseUrl}/auth/logout`, jsonRequest(cookie, "POST"));
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie") ?? "").toContain("session=;");

    const me = await fetch(
      `${app.baseUrl}/auth/me`,
      jsonRequest(sessionCookieFrom(logout), "GET"),
    );
    expect(me.status).toBe(401);
  });
});
