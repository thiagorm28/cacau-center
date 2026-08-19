import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./infra/guard/AuthGuard";
import { RoleGuard } from "./infra/guard/RoleGuard";
import { AuthModule } from "./infra/module/AuthModule";
import { DatabaseModule } from "./infra/module/DatabaseModule";
import { NoteModule } from "./infra/module/NoteModule";
import { ScanEventModule } from "./infra/module/ScanEventModule";

@Module({
  imports: [DatabaseModule, AuthModule, NoteModule, ScanEventModule],
  providers: [
    // Ordem importa: o AuthGuard precisa anexar o usuário antes do RoleGuard lê-lo.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
})
export class AppModule {}
