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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const ChangeInitialPassword_1 = __importDefault(require("../../application/usecase/ChangeInitialPassword"));
const Login_1 = __importDefault(require("../../application/usecase/Login"));
const JwtStrategy_1 = require("../auth/JwtStrategy");
const AllowPendingPasswordChange_1 = require("../guard/AllowPendingPasswordChange");
const LoginThrottleGuard_1 = require("../guard/LoginThrottleGuard");
const Public_1 = require("../guard/Public");
const CurrentUser_1 = require("./CurrentUser");
const AuthDto_1 = require("./dto/AuthDto");
const UserDto_1 = require("./dto/UserDto");
/** Cookie de sessão conforme ADR-009: inacessível a JavaScript, só sobre TLS. */
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
};
let AuthController = AuthController_1 = class AuthController {
    constructor(login, changeInitialPassword, tokenGenerator) {
        this.login = login;
        this.changeInitialPassword = changeInitialPassword;
        this.tokenGenerator = tokenGenerator;
    }
    /** Rota pública e sensível: o throttle freia adivinhação de senha (ver ADR-009). */
    async signIn(body, response) {
        const output = await this.login.execute({ email: body.email, password: body.password });
        this.issueSession(response, output.token, output.ttlInSeconds);
        return AuthController_1.identity(output.user);
    }
    signOut(response) {
        response.clearCookie(JwtStrategy_1.SESSION_COOKIE, COOKIE_OPTIONS);
    }
    me(user) {
        return AuthController_1.identity(user);
    }
    /**
     * Única rota de escrita liberada com a troca pendente (ADR-002): completa a troca e
     * reemite o cookie com um JWT novo, já sem a pendência — sem isso o usuário
     * continuaria barrado pelo `PasswordChangeGuard` até relogar.
     */
    async changePassword(body, user, response) {
        await this.changeInitialPassword.execute({
            userId: user.userId,
            newPassword: body.newPassword,
            confirmPassword: body.confirmPassword,
        });
        const refreshed = { ...user, mustChangePassword: false };
        this.issueSession(response, await this.tokenGenerator.generate(refreshed), this.tokenGenerator.ttlInSeconds());
        return AuthController_1.identity(refreshed);
    }
    issueSession(response, token, ttlInSeconds) {
        response.cookie(JwtStrategy_1.SESSION_COOKIE, token, {
            ...COOKIE_OPTIONS,
            maxAge: ttlInSeconds * 1000,
        });
    }
    static identity(user) {
        return {
            id: user.userId,
            name: user.name,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, Public_1.Public)(),
    (0, common_1.UseGuards)(LoginThrottleGuard_1.LoginThrottleGuard),
    (0, common_1.Post)("login"),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AuthDto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "signIn", null);
__decorate([
    (0, AllowPendingPasswordChange_1.AllowPendingPasswordChange)(),
    (0, common_1.Post)("logout"),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "signOut", null);
__decorate([
    (0, AllowPendingPasswordChange_1.AllowPendingPasswordChange)(),
    (0, common_1.Get)("me"),
    __param(0, (0, CurrentUser_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, AllowPendingPasswordChange_1.AllowPendingPasswordChange)(),
    (0, common_1.Post)("change-password"),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, CurrentUser_1.CurrentUser)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UserDto_1.ChangePasswordDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, common_1.Controller)("auth"),
    __param(0, (0, common_1.Inject)(Login_1.default)),
    __param(1, (0, common_1.Inject)(ChangeInitialPassword_1.default)),
    __param(2, (0, common_1.Inject)("TokenGenerator")),
    __metadata("design:paramtypes", [Login_1.default,
        ChangeInitialPassword_1.default, Object])
], AuthController);
//# sourceMappingURL=AuthController.js.map