import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import DatabaseConnectionPg, { type DatabaseConnection } from "../database/DatabaseConnection";
import UnitOfWorkDatabase from "../database/UnitOfWork";
import { requireEnv } from "../util/Env";

@Global()
@Module({
  providers: [
    {
      provide: "DatabaseConnection",
      useFactory: (): DatabaseConnection =>
        new DatabaseConnectionPg(requireEnv("DATABASE_URL")),
    },
    { provide: "UnitOfWork", useClass: UnitOfWorkDatabase },
  ],
  exports: ["DatabaseConnection", "UnitOfWork"],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject("DatabaseConnection") private readonly connection: DatabaseConnection) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.close();
  }
}
