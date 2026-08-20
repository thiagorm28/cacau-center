"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModule = void 0;
const common_1 = require("@nestjs/common");
const CreateUser_1 = __importDefault(require("../../application/usecase/CreateUser"));
const DeactivateUser_1 = __importDefault(require("../../application/usecase/DeactivateUser"));
const ListUsers_1 = __importDefault(require("../../application/usecase/ListUsers"));
const ReactivateUser_1 = __importDefault(require("../../application/usecase/ReactivateUser"));
const ResetPassword_1 = __importDefault(require("../../application/usecase/ResetPassword"));
const UpdateUser_1 = __importDefault(require("../../application/usecase/UpdateUser"));
const UserController_1 = require("../controller/UserController");
const AuthModule_1 = require("./AuthModule");
/** `AuthModule` entrega o `PasswordHasher` e o `SessionRevocationStore` (singleton). */
let UserModule = class UserModule {
};
exports.UserModule = UserModule;
exports.UserModule = UserModule = __decorate([
    (0, common_1.Module)({
        imports: [AuthModule_1.AuthModule],
        controllers: [UserController_1.UserController],
        providers: [ListUsers_1.default, CreateUser_1.default, UpdateUser_1.default, DeactivateUser_1.default, ReactivateUser_1.default, ResetPassword_1.default],
    })
], UserModule);
//# sourceMappingURL=UserModule.js.map