import { Client } from "pg";

/**
 * Postgres da suíte E2E. O banco é exclusivo da suíte (nunca o de desenvolvimento),
 * porque cada teste trunca todas as tabelas antes de começar — daí a porta `55432`,
 * servida pelo `docker-compose.e2e.yaml` (`npm run e2e:db:up`).
 */
export const DEFAULT_DATABASE_URL = "postgres://cacau:cacau@localhost:55432/cacau_e2e";

/** Comando que provisiona o Postgres esperado por `DEFAULT_DATABASE_URL`. */
const E2E_DB_COMMAND = "npm run e2e:db:up";

export const databaseUrl = (): string => process.env.E2E_DATABASE_URL ?? DEFAULT_DATABASE_URL;

const adminUrlFor = (url: string): { admin: string; database: string } => {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  parsed.pathname = "/postgres";
  return { admin: parsed.toString(), database };
};

/**
 * Sem Postgres de pé, o `pg` devolve um `ECONNREFUSED` cru que não diz o que fazer.
 * Como esse é o primeiro passo da suíte, o erro vira a instrução de provisionamento —
 * é o que separa uma falha diagnosticável de um "connect ECONNREFUSED" solto no log.
 */
const connectOrExplain = async (client: Client, url: string): Promise<void> => {
  try {
    await client.connect();
  } catch (cause) {
    const { hostname, port } = new URL(url);
    throw new Error(
      `Não foi possível conectar ao Postgres da suíte E2E em ${hostname}:${port || "5432"}. ` +
        `Suba o banco com \`${E2E_DB_COMMAND}\` ou aponte \`E2E_DATABASE_URL\` para um Postgres já ativo.`,
      { cause },
    );
  }
};

/**
 * Cria o banco da suíte se ele ainda não existir. Roda antes do `backend` subir, porque
 * é ele quem aplica as migrations — e migrar exige o banco já criado.
 */
export async function ensureDatabase(): Promise<void> {
  const { admin, database } = adminUrlFor(databaseUrl());
  const client = new Client({ connectionString: admin });
  await connectOrExplain(client, admin);
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    // `CREATE DATABASE` não aceita parâmetros nem `IF NOT EXISTS` com identificador ligado,
    // então a checagem vem antes e o nome é escapado como identificador.
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
    }
  } finally {
    await client.end();
  }
}
