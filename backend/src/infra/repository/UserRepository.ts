import { eq, inArray } from "drizzle-orm";
import type { Role } from "../../domain/SessionUser";
import type { Executor } from "../database/DatabaseConnection";
import { users } from "../database/schema";

export type UserRecord = {
  userId: string;
  name: string;
  email: string;
  /** Somente dígitos. */
  cpf: string;
  /** `YYYY-MM-DD`, como o Postgres devolve uma coluna `date`. */
  birthDate: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
};

export type NewUserInput = Omit<UserRecord, "userId">;

export type UserUpdateInput = Pick<UserRecord, "name" | "birthDate" | "role">;

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
  findByIds(userIds: readonly string[]): Promise<UserRecord[]>;
  findByCpf(cpf: string): Promise<UserRecord | null>;
  list(): Promise<UserRecord[]>;
  create(data: NewUserInput): Promise<UserRecord>;
  update(userId: string, data: UserUpdateInput): Promise<UserRecord>;
  setActive(userId: string, active: boolean): Promise<void>;
  setPassword(userId: string, passwordHash: string, mustChangePassword: boolean): Promise<void>;
}

const toRecord = (row: typeof users.$inferSelect): UserRecord => ({
  userId: row.id,
  name: row.name,
  email: row.email,
  cpf: row.cpf,
  birthDate: row.birthDate,
  passwordHash: row.passwordHash,
  role: row.role,
  active: row.active,
  mustChangePassword: row.mustChangePassword,
});

export default class UserRepositoryDatabase implements UserRepository {
  constructor(private readonly exec: Executor) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.exec.select().from(users).where(eq(users.email, email)).limit(1);
    return row === undefined ? null : toRecord(row);
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const [row] = await this.exec.select().from(users).where(eq(users.id, userId)).limit(1);
    return row === undefined ? null : toRecord(row);
  }

  async findByIds(userIds: readonly string[]): Promise<UserRecord[]> {
    if (userIds.length === 0) return [];
    const rows = await this.exec
      .select()
      .from(users)
      .where(inArray(users.id, [...userIds]));
    return rows.map(toRecord);
  }

  async findByCpf(cpf: string): Promise<UserRecord | null> {
    const [row] = await this.exec.select().from(users).where(eq(users.cpf, cpf)).limit(1);
    return row === undefined ? null : toRecord(row);
  }

  /** Sem filtro nem paginação: o volume é de poucos funcionários por loja (TechSpec). */
  async list(): Promise<UserRecord[]> {
    const rows = await this.exec.select().from(users).orderBy(users.name);
    return rows.map(toRecord);
  }

  async create(data: NewUserInput): Promise<UserRecord> {
    const [row] = await this.exec
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        cpf: data.cpf,
        birthDate: data.birthDate,
        passwordHash: data.passwordHash,
        role: data.role,
        active: data.active,
        mustChangePassword: data.mustChangePassword,
      })
      .returning();
    if (row === undefined) throw new Error("Falha ao inserir usuário");
    return toRecord(row);
  }

  async update(userId: string, data: UserUpdateInput): Promise<UserRecord> {
    const [row] = await this.exec
      .update(users)
      .set({ name: data.name, birthDate: data.birthDate, role: data.role })
      .where(eq(users.id, userId))
      .returning();
    if (row === undefined) throw new Error("Usuário não encontrado");
    return toRecord(row);
  }

  async setActive(userId: string, active: boolean): Promise<void> {
    await this.exec.update(users).set({ active }).where(eq(users.id, userId));
  }

  async setPassword(
    userId: string,
    passwordHash: string,
    mustChangePassword: boolean,
  ): Promise<void> {
    await this.exec.update(users).set({ passwordHash, mustChangePassword }).where(eq(users.id, userId));
  }
}
