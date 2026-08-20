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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAME_AS_INITIAL_PASSWORD = exports.PASSWORDS_DO_NOT_MATCH = void 0;
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const InitialPassword_1 = require("../../domain/service/InitialPassword");
const PasswordPolicy_1 = require("../../domain/service/PasswordPolicy");
exports.PASSWORDS_DO_NOT_MATCH = "As senhas não coincidem";
exports.SAME_AS_INITIAL_PASSWORD = "A nova senha deve ser diferente da senha inicial";
/**
 * Troca self-service que encerra a obrigatoriedade de ADR-002. Todo erro aqui é um
 * `Error` puro: o filtro global traduz para 422, como o contrato de API exige.
 */
let ChangeInitialPassword = class ChangeInitialPassword {
    constructor(unitOfWork, passwordHasher) {
        this.unitOfWork = unitOfWork;
        this.passwordHasher = passwordHasher;
    }
    async execute(input) {
        if (input.newPassword !== input.confirmPassword)
            throw new Error(exports.PASSWORDS_DO_NOT_MATCH);
        (0, PasswordPolicy_1.assertPasswordPolicy)(input.newPassword);
        await this.unitOfWork.run(async ({ users }) => {
            const account = await users.findById(input.userId);
            if (account === null)
                throw new DomainErrors_1.NotFoundError("Usuário não encontrado");
            // A senha inicial é derivável do CPF e da data de nascimento: mantê-la esvaziaria
            // o propósito da troca obrigatória (US-010.EC-1).
            if (input.newPassword === (0, InitialPassword_1.initialPasswordFor)(account.cpf, account.birthDate)) {
                throw new Error(exports.SAME_AS_INITIAL_PASSWORD);
            }
            await users.setPassword(input.userId, await this.passwordHasher.hash(input.newPassword), false);
        });
    }
};
ChangeInitialPassword = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __param(1, (0, common_1.Inject)("PasswordHasher")),
    __metadata("design:paramtypes", [Object, Object])
], ChangeInitialPassword);
exports.default = ChangeInitialPassword;
//# sourceMappingURL=ChangeInitialPassword.js.map