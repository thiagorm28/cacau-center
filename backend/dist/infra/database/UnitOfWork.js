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
const common_1 = require("@nestjs/common");
const NoteRepository_1 = __importDefault(require("../repository/NoteRepository"));
const ScanEventRepository_1 = __importDefault(require("../repository/ScanEventRepository"));
const UserRepository_1 = __importDefault(require("../repository/UserRepository"));
const bind = (exec) => ({
    notes: new NoteRepository_1.default(exec),
    scanEvents: new ScanEventRepository_1.default(exec),
    users: new UserRepository_1.default(exec),
});
let UnitOfWorkDatabase = class UnitOfWorkDatabase {
    constructor(connection) {
        this.connection = connection;
    }
    run(work) {
        return this.connection.getDb().transaction((tx) => work(bind(tx)));
    }
};
UnitOfWorkDatabase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("DatabaseConnection")),
    __metadata("design:paramtypes", [Object])
], UnitOfWorkDatabase);
exports.default = UnitOfWorkDatabase;
//# sourceMappingURL=UnitOfWork.js.map