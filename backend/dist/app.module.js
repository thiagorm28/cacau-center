"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const AuthGuard_1 = require("./infra/guard/AuthGuard");
const PasswordChangeGuard_1 = require("./infra/guard/PasswordChangeGuard");
const RoleGuard_1 = require("./infra/guard/RoleGuard");
const AuthModule_1 = require("./infra/module/AuthModule");
const DatabaseModule_1 = require("./infra/module/DatabaseModule");
const NoteModule_1 = require("./infra/module/NoteModule");
const ScanEventModule_1 = require("./infra/module/ScanEventModule");
const UserModule_1 = require("./infra/module/UserModule");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [DatabaseModule_1.DatabaseModule, AuthModule_1.AuthModule, NoteModule_1.NoteModule, ScanEventModule_1.ScanEventModule, UserModule_1.UserModule],
        providers: [
            // Ordem importa: o AuthGuard precisa anexar o usuário antes dos guards seguintes o
            // lerem; a troca de senha pendente (ADR-002) barra antes mesmo da checagem de papel.
            { provide: core_1.APP_GUARD, useClass: AuthGuard_1.AuthGuard },
            { provide: core_1.APP_GUARD, useClass: PasswordChangeGuard_1.PasswordChangeGuard },
            { provide: core_1.APP_GUARD, useClass: RoleGuard_1.RoleGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map