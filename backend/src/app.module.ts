import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./infra/guard/AuthGuard";
import { PasswordChangeGuard } from "./infra/guard/PasswordChangeGuard";
import { RoleGuard } from "./infra/guard/RoleGuard";
import { AuthModule } from "./infra/module/AuthModule";
import { DatabaseModule } from "./infra/module/DatabaseModule";
import { NoteModule } from "./infra/module/NoteModule";
import { ScanEventModule } from "./infra/module/ScanEventModule";
import { UserModule } from "./infra/module/UserModule";

@Module({
  imports: [DatabaseModule, AuthModule, NoteModule, ScanEventModule, UserModule],
  providers: [
    // Ordem importa: o AuthGuard precisa anexar o usuário antes dos guards seguintes o
    // lerem; a troca de senha pendente (ADR-002) barra antes mesmo da checagem de papel.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
})
export class AppModule {}
