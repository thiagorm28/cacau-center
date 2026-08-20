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
var DeactivateUser_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_CANNOT_BE_DEACTIVATED = void 0;
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const SessionRevocationStore_1 = require("../../infra/auth/SessionRevocationStore");
exports.ADMIN_CANNOT_BE_DEACTIVATED = "A conta admin não pode ser desativada";
let DeactivateUser = DeactivateUser_1 = class DeactivateUser {
    constructor(unitOfWork, revocations) {
        this.unitOfWork = unitOfWork;
        this.revocations = revocations;
        this.logger = new common_1.Logger(DeactivateUser_1.name);
    }
    async execute(input) {
        await this.unitOfWork.run(async ({ users }) => {
            const target = await users.findById(input.id);
            if (target === null)
                throw new DomainErrors_1.NotFoundError("Usuário não encontrado");
            // Existe exatamente um admin e a rota é admin-only: esta checagem cobre tanto a
            // autodesativação quanto qualquer chamada direta à API (US-013).
            if (target.role === "admin")
                throw new DomainErrors_1.ForbiddenError(exports.ADMIN_CANNOT_BE_DEACTIVATED);
            await users.setActive(input.id, false);
        });
        // Corte imediato de acesso: a sessão já aberta para de valer sem esperar o token
        // expirar sozinho (ADR-005, US-007.EC-1).
        this.revocations.revoke(input.id);
        this.logger.log(`Usuário ${input.id} desativado; sessões em aberto revogadas`);
        return { id: input.id, active: false };
    }
};
DeactivateUser = DeactivateUser_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __metadata("design:paramtypes", [Object, SessionRevocationStore_1.SessionRevocationStore])
], DeactivateUser);
exports.default = DeactivateUser;
//# sourceMappingURL=DeactivateUser.js.map