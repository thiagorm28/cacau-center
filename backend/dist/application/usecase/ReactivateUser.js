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
var ReactivateUser_1;
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
/**
 * Reativar não mexe na senha nem no store de revogação (US-008.AC-2): um token emitido
 * no login seguinte já tem `iat` posterior à revogação e passa naturalmente.
 */
let ReactivateUser = ReactivateUser_1 = class ReactivateUser {
    constructor(unitOfWork) {
        this.unitOfWork = unitOfWork;
        this.logger = new common_1.Logger(ReactivateUser_1.name);
    }
    async execute(input) {
        await this.unitOfWork.run(async ({ users }) => {
            const target = await users.findById(input.id);
            if (target === null)
                throw new DomainErrors_1.NotFoundError("Usuário não encontrado");
            await users.setActive(input.id, true);
        });
        this.logger.log(`Usuário ${input.id} reativado`);
        return { id: input.id, active: true };
    }
};
ReactivateUser = ReactivateUser_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __metadata("design:paramtypes", [Object])
], ReactivateUser);
exports.default = ReactivateUser;
//# sourceMappingURL=ReactivateUser.js.map