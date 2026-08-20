import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  USER_PENDING_CHANGE,
  type TestApp,
  jsonRequest,
  sessionCookieFrom,
  startTestApp,
} from "../support/TestApp";

const NEW_PASSWORD = "senhaNova1";

describe("Troca obrigatória de senha (HTTP)", () => {
  let app: TestApp;
  let cookie: string;

  const changePassword = (sessionCookie: string, body: Record<string, string>) =>
    fetch(`${app.baseUrl}/auth/change-password`, jsonRequest(sessionCookie, "POST", body));

  const protectedRoute = (sessionCookie: string) =>
    fetch(`${app.baseUrl}/notes`, jsonRequest(sessionCookie, "GET"));

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.reset();
    cookie = await app.login(USER_PENDING_CHANGE);
  });

  it("IT-024 troca pendente bloqueia as rotas até a senha ser trocada", async () => {
    expect((await protectedRoute(cookie)).status).toBe(403);

    const changed = await changePassword(cookie, {
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });

    expect(changed.status).toBe(200);
    await expect(changed.json()).resolves.toMatchObject({ mustChangePassword: false });
    // O cookie reemitido carrega um JWT novo, já sem a pendência: sem ele o usuário
    // continuaria barrado até relogar.
    expect((await protectedRoute(sessionCookieFrom(changed))).status).toBe(200);
  });

  it("IT-025 a pendência persiste no servidor após logout e novo login", async () => {
    const logout = await fetch(`${app.baseUrl}/auth/logout`, jsonRequest(cookie, "POST"));
    expect(logout.status).toBe(204);

    const relogin = await fetch(
      `${app.baseUrl}/auth/login`,
      jsonRequest("", "POST", USER_PENDING_CHANGE),
    );
    expect(relogin.status).toBe(200);
    await expect(relogin.json()).resolves.toMatchObject({ mustChangePassword: true });

    expect((await protectedRoute(sessionCookieFrom(relogin))).status).toBe(403);
  });

  it("IT-026 nova senha igual à senha inicial devolve 422", async () => {
    const response = await changePassword(cookie, {
      newPassword: USER_PENDING_CHANGE.password,
      confirmPassword: USER_PENDING_CHANGE.password,
    });

    expect(response.status).toBe(422);
    expect((await protectedRoute(cookie)).status).toBe(403);
  });
});
