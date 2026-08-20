import { boolean, date, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["operador", "gerente", "admin"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  /** Somente dígitos (11 caracteres); a validação de formato mora em `Cpf`. */
  cpf: text("cpf").notNull().unique(),
  birthDate: date("birth_date").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  /** Desativação lógica (ADR-003): a linha nunca é excluída, preservando o histórico. */
  active: boolean("active").notNull().default(true),
  /** Troca obrigatória de senha pendente (ADR-002). */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
