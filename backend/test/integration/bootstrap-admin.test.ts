import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootstrapAdmin } from "../../scripts/bootstrap-admin";
import PasswordHasherBcrypt from "../../src/infra/util/PasswordHasher";
import { type TestApp, startTestApp } from "../support/TestApp";

const ADMIN_INPUT = {
  name: "Dona da Loja",
  email: "dona@loja.com",
  cpf: "111.444.777-35",
  birthDate: "1980-01-10",
  password: "senha-admin-1",
};

describe("bootstrap-admin (ADR-001)", () => {
  let app: TestApp;
  const hasher = new PasswordHasherBcrypt(4);

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.reset();
    // O `reset` semeia a fixture ADMIN; o provisionamento parte de um banco sem admin.
    await app.connection.getDb().execute(sql`DELETE FROM users WHERE role = 'admin'`);
  });

  it("IT-028 rodar duas vezes em sequência não duplica a conta admin", async () => {
    const db = app.connection.getDb();

    const first = await bootstrapAdmin(db, ADMIN_INPUT, hasher);
    const second = await bootstrapAdmin(db, ADMIN_INPUT, hasher);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);

    const [{ total }] = (
      await db.execute(sql`SELECT count(*)::int AS total FROM users WHERE role = 'admin'`)
    ).rows as { total: number }[];
    expect(total).toBe(1);
  });

  it("cria a conta admin ativa e com troca de senha obrigatória pendente", async () => {
    const db = app.connection.getDb();

    await bootstrapAdmin(db, ADMIN_INPUT, hasher);

    const [row] = (
      await db.execute(
        sql`SELECT cpf, active, must_change_password FROM users WHERE role = 'admin'`,
      )
    ).rows as { cpf: string; active: boolean; must_change_password: boolean }[];
    expect(row).toMatchObject({ cpf: "11144477735", active: true, must_change_password: true });
  });
});
