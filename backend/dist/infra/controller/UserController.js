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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const CreateUser_1 = __importDefault(require("../../application/usecase/CreateUser"));
const DeactivateUser_1 = __importDefault(require("../../application/usecase/DeactivateUser"));
const ListUsers_1 = __importDefault(require("../../application/usecase/ListUsers"));
const ReactivateUser_1 = __importDefault(require("../../application/usecase/ReactivateUser"));
const ResetPassword_1 = __importDefault(require("../../application/usecase/ResetPassword"));
const UpdateUser_1 = __importDefault(require("../../application/usecase/UpdateUser"));
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const Roles_1 = require("../guard/Roles");
const UserDto_1 = require("./dto/UserDto");
/** Um id fora do formato UUID nunca corresponde a um usuário — responde 404, não 400. */
const userIdParam = () => new common_1.ParseUUIDPipe({ exceptionFactory: () => new DomainErrors_1.NotFoundError("Usuário não encontrado") });
/**
 * Gestão de contas: exclusiva do admin (US-012). Basta `@Roles("admin")` no controller —
 * o bypass de admin do `RoleGuard` (ADR-006) só afrouxa rotas de outros papéis, e
 * operador/gerente continuam recusados aqui.
 */
let UserController = class UserController {
    constructor(listUsers, createUser, updateUser, deactivateUser, reactivateUser, resetPassword) {
        this.listUsers = listUsers;
        this.createUser = createUser;
        this.updateUser = updateUser;
        this.deactivateUser = deactivateUser;
        this.reactivateUser = reactivateUser;
        this.resetPassword = resetPassword;
    }
    list() {
        return this.listUsers.execute();
    }
    create(body) {
        return this.createUser.execute({
            name: body.name,
            email: body.email,
            cpf: body.cpf,
            birthDate: body.birthDate,
            role: body.role,
        });
    }
    update(id, body) {
        return this.updateUser.execute({
            id,
            name: body.name,
            birthDate: body.birthDate,
            role: body.role,
        });
    }
    deactivate(id) {
        return this.deactivateUser.execute({ id });
    }
    reactivate(id) {
        return this.reactivateUser.execute({ id });
    }
    reset(id) {
        return this.resetPassword.execute({ id });
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UserController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UserDto_1.CreateUserDto]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":id"),
    __param(0, (0, common_1.Param)("id", userIdParam())),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UserDto_1.UpdateUserDto]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(":id/deactivate"),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)("id", userIdParam())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Post)(":id/reactivate"),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)("id", userIdParam())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "reactivate", null);
__decorate([
    (0, common_1.Post)(":id/reset-password"),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)("id", userIdParam())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UserController.prototype, "reset", null);
exports.UserController = UserController = __decorate([
    (0, Roles_1.Roles)("admin"),
    (0, common_1.Controller)("users"),
    __param(0, (0, common_1.Inject)(ListUsers_1.default)),
    __param(1, (0, common_1.Inject)(CreateUser_1.default)),
    __param(2, (0, common_1.Inject)(UpdateUser_1.default)),
    __param(3, (0, common_1.Inject)(DeactivateUser_1.default)),
    __param(4, (0, common_1.Inject)(ReactivateUser_1.default)),
    __param(5, (0, common_1.Inject)(ResetPassword_1.default)),
    __metadata("design:paramtypes", [ListUsers_1.default,
        CreateUser_1.default,
        UpdateUser_1.default,
        DeactivateUser_1.default,
        ReactivateUser_1.default,
        ResetPassword_1.default])
], UserController);
//# sourceMappingURL=UserController.js.map