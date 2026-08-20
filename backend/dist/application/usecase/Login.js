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
var Login_1;
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
/** Mesma mensagem para e-mail inexistente e senha errada: não revela se a conta existe. */
const INVALID_CREDENTIALS = "Credenciais inválidas";
let Login = Login_1 = class Login {
    constructor(unitOfWork, passwordHasher, tokenGenerator) {
        this.unitOfWork = unitOfWork;
        this.passwordHasher = passwordHasher;
        this.tokenGenerator = tokenGenerator;
        this.logger = new common_1.Logger(Login_1.name);
    }
    async execute(input) {
        const account = await this.unitOfWork.run(({ users }) => users.findByEmail(input.email));
        if (account === null) {
            this.logger.warn(`Login recusado para ${input.email}: conta inexistente`);
            throw new DomainErrors_1.UnauthorizedError(INVALID_CREDENTIALS);
        }
        // Conta desativada usa a mesma mensagem genérica: não revela que a conta existe
        // mas está desativada (ADR-003, TechSpec Data Flow passo 2).
        if (!account.active) {
            this.logger.warn(`Login recusado para ${input.email}: conta desativada`);
            throw new DomainErrors_1.UnauthorizedError(INVALID_CREDENTIALS);
        }
        const matches = await this.passwordHasher.compare(input.password, account.passwordHash);
        if (!matches) {
            this.logger.warn(`Login recusado para ${input.email}: senha incorreta`);
            throw new DomainErrors_1.UnauthorizedError(INVALID_CREDENTIALS);
        }
        const user = {
            userId: account.userId,
            name: account.name,
            email: account.email,
            role: account.role,
            mustChangePassword: account.mustChangePassword,
        };
        return {
            user,
            token: await this.tokenGenerator.generate(user),
            ttlInSeconds: this.tokenGenerator.ttlInSeconds(),
        };
    }
};
Login = Login_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __param(1, (0, common_1.Inject)("PasswordHasher")),
    __param(2, (0, common_1.Inject)("TokenGenerator")),
    __metadata("design:paramtypes", [Object, Object, Object])
], Login);
exports.default = Login;
//# sourceMappingURL=Login.js.map