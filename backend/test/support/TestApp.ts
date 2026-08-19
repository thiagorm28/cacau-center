import { type AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { createApp, runMigrations } from "../../src/bootstrap";
import type { DatabaseConnection } from "../../src/infra/database/DatabaseConnection";
import { users } from "../../src/infra/database/schema";
import PasswordHasherBcrypt from "../../src/infra/util/PasswordHasher";
import FixtureNfeServer from "./FixtureNfeServer";

export const OPERADOR = { email: "operador@loja.com", password: "senha-operador" };
export const GERENTE = { email: "gerente@loja.com", password: "senha-gerente" };

export type TestApp = {
  baseUrl: string;
  fixtureServer: FixtureNfeServer;
  connection: DatabaseConnection;
  /** Faz login e devolve o header `Cookie` pronto para as requisições seguintes. */
  login(credentials: { email: string; password: string }): Promise<string>;
  reset(): Promise<void>;
  close(): Promise<void>;
};

const DEFAULT_DATABASE_URL = "postgres://cacau:cacau@localhost:5432/cacau_test";

/** Extrai o cookie de sessão do `Set-Cookie`; `fetch` do Node não mantém cookie jar. */
export const sessionCookieFrom = (response: Response): string => {
  const header = response.headers.get("set-cookie") ?? "";
  const value = header.split(";")[0] ?? "";
  return value;
};

export async function startTestApp(
  /** Variáveis aplicadas antes do bootstrap e removidas no `close()`. */
  envOverrides: Record<string, string> = {},
): Promise<TestApp> {
  for (const [name, value] of Object.entries(envOverrides)) process.env[name] = value;
  const fixtureServer = new FixtureNfeServer();
  const fixtureUrl = await fixtureServer.start();
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "segredo-de-teste";
  process.env.EMPRESA_CODE = process.env.EMPRESA_CODE ?? "1102";
  process.env.NFE_BASE_URL = fixtureUrl;
  process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";
  // As suítes fazem dezenas de logins seguidos do mesmo IP; o freio de força bruta fica
  // desligado por padrão e é ligado só no teste que o exercita.
  process.env.LOGIN_RATE_LIMIT = process.env.LOGIN_RATE_LIMIT ?? "0";
  const app: INestApplication = await createApp();
  await runMigrations(app);
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as AddressInfo;
  const connection = app.get<DatabaseConnection>("DatabaseConnection");
  const hasher = new PasswordHasherBcrypt(4);

  const reset = async (): Promise<void> => {
    fixtureServer.reset();
    await connection
      .getDb()
      .execute(
        sql`TRUNCATE TABLE scan_events, note_items, invoice_notes, users RESTART IDENTITY CASCADE`,
      );
    await connection.getDb().insert(users).values([
      {
        name: "Ana Operadora",
        email: OPERADOR.email,
        passwordHash: await hasher.hash(OPERADOR.password),
        role: "operador" as const,
      },
      {
        name: "Gil Gerente",
        email: GERENTE.email,
        passwordHash: await hasher.hash(GERENTE.password),
        role: "gerente" as const,
      },
    ]);
  };

  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    baseUrl,
    fixtureServer,
    connection,
    async login(credentials) {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (response.status !== 200) throw new Error(`Login falhou: ${response.status}`);
      return sessionCookieFrom(response);
    },
    reset,
    async close() {
      await app.close();
      await fixtureServer.stop();
      for (const name of Object.keys(envOverrides)) delete process.env[name];
    },
  };
}

export const jsonRequest = (
  cookie: string,
  method: string,
  body?: unknown,
): RequestInit => ({
  method,
  headers: {
    "content-type": "application/json",
    ...(cookie === "" ? {} : { cookie }),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
