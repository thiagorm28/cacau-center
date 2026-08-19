import { eq, inArray } from "drizzle-orm";
import type { Executor } from "../database/DatabaseConnection";
import { users } from "../database/schema";

export type UserRecord = {
  userId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "operador" | "gerente";
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
  findByIds(userIds: readonly string[]): Promise<UserRecord[]>;
}

const toRecord = (row: typeof users.$inferSelect): UserRecord => ({
  userId: row.id,
  name: row.name,
  email: row.email,
  passwordHash: row.passwordHash,
  role: row.role,
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
}
