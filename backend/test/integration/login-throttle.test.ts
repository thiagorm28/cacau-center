import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GERENTE, OPERADOR, type TestApp, jsonRequest, startTestApp } from "../support/TestApp";

const LIMIT = 3;

const attemptLogin = (app: TestApp, email: string, password: string): Promise<Response> =>
  fetch(`${app.baseUrl}/auth/login`, jsonRequest("", "POST", { email, password }));

describe("Freio de força bruta em POST /auth/login", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await startTestApp({ LOGIN_RATE_LIMIT: String(LIMIT), LOGIN_RATE_TTL_SECONDS: "60" });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.reset();
  });

  it("bloqueia com 429 depois do limite de tentativas, mesmo com a senha correta", async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      const failed = await attemptLogin(app, OPERADOR.email, "senha-errada");
      expect(failed.status).toBe(401);
    }

    const blocked = await attemptLogin(app, OPERADOR.email, OPERADOR.password);

    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toMatchObject({
      statusCode: 429,
      message: "Muitas tentativas de login. Tente novamente em instantes.",
    });
  });

  it("não pune outras contas do mesmo IP: a chave combina IP e e-mail", async () => {
    for (let attempt = 0; attempt <= LIMIT; attempt++) {
      await attemptLogin(app, OPERADOR.email, "senha-errada");
    }

    const other = await attemptLogin(app, GERENTE.email, GERENTE.password);

    expect(other.status).toBe(200);
  });
});
