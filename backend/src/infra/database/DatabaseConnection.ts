import { Injectable } from "@nestjs/common";
import { type NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DbClient = NodePgDatabase<typeof schema>;

/** Cliente Drizzle ou transação — as duas expõem a mesma superfície de query. */
export type Executor = DbClient | Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export interface DatabaseConnection {
  getDb(): DbClient;
  close(): Promise<void>;
}

@Injectable()
export default class DatabaseConnectionPg implements DatabaseConnection {
  private readonly pool: Pool;
  private readonly db: DbClient;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  getDb(): DbClient {
    return this.db;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
