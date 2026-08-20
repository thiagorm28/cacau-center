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
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const ListUsers_1 = require("./ListUsers");
/** CPF e e-mail não são editáveis por regra de negócio do PRD — não há campo para eles. */
let UpdateUser = class UpdateUser {
    constructor(unitOfWork) {
        this.unitOfWork = unitOfWork;
    }
    execute(input) {
        return this.unitOfWork.run((repositories) => this.updateWithin(repositories, input));
    }
    async updateWithin(repositories, input) {
        const target = await repositories.users.findById(input.id);
        if (target === null)
            throw new DomainErrors_1.NotFoundError("Usuário não encontrado");
        // Espelha `DeactivateUser`: a conta admin é provisionada fora da aplicação e não é
        // administrável por esta rota (ADR-001).
        if (target.role === "admin")
            throw new DomainErrors_1.ForbiddenError("A conta admin não pode ser editada");
        const updated = await repositories.users.update(input.id, {
            name: input.name,
            birthDate: input.birthDate,
            role: input.role,
        });
        return (0, ListUsers_1.toUserListItem)(updated);
    }
};
UpdateUser = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __metadata("design:paramtypes", [Object])
], UpdateUser);
exports.default = UpdateUser;
//# sourceMappingURL=UpdateUser.js.map