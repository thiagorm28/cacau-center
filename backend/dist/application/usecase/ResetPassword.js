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
var ResetPassword_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.INACTIVE_TARGET = void 0;
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const InitialPassword_1 = require("../../domain/service/InitialPassword");
exports.INACTIVE_TARGET = "Reative o usuário antes de resetar a senha";
/**
 * Recoloca a senha inicial `CPF@DDMMAAAA` (ADR-002) e reabre a troca obrigatória.
 * Idempotente: duas chamadas seguidas deixam o mesmo estado final (US-009.EC-2).
 */
let ResetPassword = ResetPassword_1 = class ResetPassword {
    constructor(unitOfWork, passwordHasher) {
        this.unitOfWork = unitOfWork;
        this.passwordHasher = passwordHasher;
        this.logger = new common_1.Logger(ResetPassword_1.name);
    }
    async execute(input) {
        await this.unitOfWork.run(async ({ users }) => {
            const target = await users.findById(input.id);
            if (target === null)
                throw new DomainErrors_1.NotFoundError("Usuário não encontrado");
            if (!target.active)
                throw new DomainErrors_1.ConflictError(exports.INACTIVE_TARGET);
            const passwordHash = await this.passwordHasher.hash((0, InitialPassword_1.initialPasswordFor)(target.cpf, target.birthDate));
            await users.setPassword(input.id, passwordHash, true);
        });
        this.logger.log(`Senha do usuário ${input.id} resetada para a senha inicial`);
        return { id: input.id };
    }
};
ResetPassword = ResetPassword_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __param(1, (0, common_1.Inject)("PasswordHasher")),
    __metadata("design:paramtypes", [Object, Object])
], ResetPassword);
exports.default = ResetPassword;
//# sourceMappingURL=ResetPassword.js.map