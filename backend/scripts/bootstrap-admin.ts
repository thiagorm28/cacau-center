/**
 * Provisionamento da conta admin única (ADR-001).
 *
 * Roda uma vez na implantação, fora do ciclo de request/resposta — nenhuma rota da
 * aplicação cria um admin. É idempotente: se já existir uma linha com `role = "admin"`,
 * a execução não cria nada e não falha (risco explicitamente levantado na ADR-001).
 *
 * Uso: `npm run bootstrap:admin -w backend`, com `DATABASE_URL` e as variáveis
 * `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_CPF`, `ADMIN_BIRTH_DATE` (`YYYY-MM-DD`) e
 * `ADMIN_PASSWORD` definidas.
 */
import { eq } from "drizzle-orm";
import { assertPasswordPolicy } from "../src/domain/service/PasswordPolicy";
import Cpf from "../src/domain/valueobject/Cpf";
import DatabaseConnectionPg, { type DbClient } from "../src/infra/database/DatabaseConnection";
import { users } from "../src/infra/database/schema";
import PasswordHasherBcrypt, { type PasswordHasher } from "../src/infra/util/PasswordHasher";
import { requireEnv } from "../src/infra/util/Env";

export type AdminInput = {
  name: string;
  email: string;
  cpf: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  password: string;
};

export type BootstrapResult = { created: boolean; userId: string };

const assertBirthDate = (birthDate: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error("ADMIN_BIRTH_DATE deve estar no formato YYYY-MM-DD");
  }
};

export const readAdminInputFromEnv = (): AdminInput => ({
  name: requireEnv("ADMIN_NAME"),
  email: requireEnv("ADMIN_EMAIL"),
  cpf: requireEnv("ADMIN_CPF"),
  birthDate: requireEnv("ADMIN_BIRTH_DATE"),
  password: requireEnv("ADMIN_PASSWORD"),
});

export async function bootstrapAdmin(
  db: DbClient,
  input: AdminInput,
  hasher: PasswordHasher,
): Promise<BootstrapResult> {
  const cpf = Cpf.create(input.cpf);
  assertBirthDate(input.birthDate);
  assertPasswordPolicy(input.password);

  const [existing] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (existing !== undefined) return { created: false, userId: existing.id };

  const [row] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      cpf: cpf.digits,
      birthDate: input.birthDate,
      passwordHash: await hasher.hash(input.password),
      role: "admin",
      active: true,
      // A senha vem de variável de ambiente: mais seguro exigir a troca no primeiro
      // acesso, reaproveitando o mecanismo de ADR-002 em vez de um caso especial.
      mustChangePassword: true,
    })
    .returning();
  if (row === undefined) throw new Error("Falha ao inserir a conta admin");
  return { created: true, userId: row.id };
}

async function main(): Promise<void> {
  const connection = new DatabaseConnectionPg(requireEnv("DATABASE_URL"));
  try {
    const result = await bootstrapAdmin(
      connection.getDb(),
      readAdminInputFromEnv(),
      new PasswordHasherBcrypt(),
    );
    console.log(
      result.created
        ? `Conta admin criada (${result.userId}); troca de senha obrigatória no primeiro acesso.`
        : `Conta admin já existe (${result.userId}); nada a fazer.`,
    );
  } finally {
    await connection.close();
  }
}

// Só executa quando chamado como script; o teste de integração importa `bootstrapAdmin`.
if (process.argv[1] !== undefined && process.argv[1].includes("bootstrap-admin")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
