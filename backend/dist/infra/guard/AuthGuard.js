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
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const passport_1 = require("@nestjs/passport");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const Public_1 = require("./Public");
/**
 * Exige um cookie de sessão válido em toda rota que não esteja marcada com `@Public()`.
 * A extração e a verificação do JWT ficam no `JwtStrategy` (passport-jwt); aqui só mora
 * a decisão de deixar passar ou recusar.
 */
let AuthGuard = class AuthGuard extends (0, passport_1.AuthGuard)("jwt") {
    constructor(reflector) {
        super();
        this.reflector = reflector;
    }
    canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(Public_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic === true)
            return true;
        return super.canActivate(context);
    }
    handleRequest(err, user) {
        if (err !== null && err !== undefined)
            throw err;
        if (user === false || user === null || user === undefined) {
            throw new DomainErrors_1.UnauthorizedError("Sessão inválida ou expirada");
        }
        return user;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], AuthGuard);
//# sourceMappingURL=AuthGuard.js.map