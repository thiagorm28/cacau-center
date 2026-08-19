import { createServer } from "node:http";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { databaseUrl, ensureDatabase } from "./database.ts";
import { xmlFor } from "./nfeFixtures.ts";

/**
 * Servidor de apoio da suíte E2E, com dois papéis:
 *
 * 1. substituir a API interna da Cacau Show — o `backend` sobe com
 *    `NFE_BASE_URL` apontando para cá, então a suíte nunca toca
 *    `hybrisreports.cacaushow.com.br`;
 * 2. expor um canal de controle para semear dados determinísticos por teste
 *    (`POST /__control/reset`).
 */

export const CONTROL_PORT = Number.parseInt(process.env.E2E_CONTROL_PORT ?? "3002", 10);

/** Contas semeadas em todo reset — mesmas credenciais usadas pelos testes do `backend`. */
export const OPERADOR = {
  name: "Ana Operadora",
  email: "operador@loja.com",
  password: "senha-operador",
  role: "operador",
} as const;

export const GERENTE = {
  name: "Gil Gerente",
  email: "gerente@loja.com",
  password: "senha-gerente",
  role: "gerente",
} as const;

// Custo mínimo do bcrypt: a suíte semeia usuários a cada teste e o hash não é o objeto
// sob teste aqui — o custo de produção vive no `PasswordHasher` do backend.
const BCRYPT_ROUNDS = 4;

/**
 * Zera o estado e recria as duas contas. `TRUNCATE ... CASCADE` mantém o schema (já
 * migrado pelo backend) e devolve o banco ao mesmo ponto de partida para todo teste.
 */
const reset = async (): Promise<void> => {
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query(
      "TRUNCATE TABLE scan_events, note_items, invoice_notes, users RESTART IDENTITY CASCADE",
    );
    for (const user of [OPERADOR, GERENTE]) {
      await client.query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        [user.name, user.email, await bcrypt.hash(user.password, BCRYPT_ROUNDS), user.role],
      );
    }
  } finally {
    await client.end();
  }
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${CONTROL_PORT}`);

  if (url.pathname === "/__control/ready") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ready");
    return;
  }

  if (url.pathname === "/__control/reset" && request.method === "POST") {
    reset()
      .then(() => {
        response.writeHead(204);
        response.end();
      })
      .catch((error: unknown) => {
        response.writeHead(500, { "content-type": "text/plain" });
        response.end(error instanceof Error ? error.message : String(error));
      });
    return;
  }

  if (url.pathname === "/ConsultaNotaFiscal/GerarXML") {
    response.writeHead(200, { "content-type": "text/xml; charset=utf-8" });
    response.end(xmlFor(url.searchParams.get("documento") ?? ""));
    return;
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("not found");
});

// O banco é criado aqui e no `prepare-db`, porque os dois processos sobem em paralelo e
// qualquer um dos dois pode chegar primeiro.
await ensureDatabase();
server.listen(CONTROL_PORT, "127.0.0.1", () => {
  process.stdout.write(`servidor de fixtures NFe ouvindo na porta ${CONTROL_PORT}\n`);
});
