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
exports.toUserListItem = void 0;
const common_1 = require("@nestjs/common");
const toUserListItem = (record) => ({
    id: record.userId,
    name: record.name,
    email: record.email,
    cpf: record.cpf,
    birthDate: record.birthDate,
    role: record.role,
    active: record.active,
    mustChangePassword: record.mustChangePassword,
});
exports.toUserListItem = toUserListItem;
let ListUsers = class ListUsers {
    constructor(unitOfWork) {
        this.unitOfWork = unitOfWork;
    }
    /** Sem filtro nem paginação: o volume é de poucos funcionários por loja (TechSpec). */
    async execute() {
        const records = await this.unitOfWork.run(({ users }) => users.list());
        return { users: records.map(exports.toUserListItem) };
    }
};
ListUsers = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __metadata("design:paramtypes", [Object])
], ListUsers);
exports.default = ListUsers;
//# sourceMappingURL=ListUsers.js.map