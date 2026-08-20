"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordChangeGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const AllowPendingPasswordChange_1 = require("./AllowPendingPasswordChange");
/**
 * Torna a troca de senha obrigatória inescapável (ADR-002, US-011): enquanto pendente,
 * toda rota que não estiver marcada com `@AllowPendingPasswordChange()` responde 403.
 *
 * Global, registrado depois do `AuthGuard` — depende do usuário já anexado à request.
 * Rota pública não tem usuário, então passa direto.
 */
let PasswordChangeGuard = class PasswordChangeGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const allowed = this.reflector.getAllAndOverride(AllowPendingPasswordChange_1.ALLOW_PENDING_PASSWORD_CHANGE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const user = context.switchToHttp().getRequest().user;
        if (allowed === true || user?.mustChangePassword !== true)
            return true;
        throw new DomainErrors_1.ForbiddenError("Troca de senha obrigatória pendente");
    }
};
exports.PasswordChangeGuard = PasswordChangeGuard;
exports.PasswordChangeGuard = PasswordChangeGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], PasswordChangeGuard);
//# sourceMappingURL=PasswordChangeGuard.js.map