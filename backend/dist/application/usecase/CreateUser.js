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
var CreateUser_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUPLICATE_CPF = exports.DUPLICATE_EMAIL = void 0;
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const InitialPassword_1 = require("../../domain/service/InitialPassword");
const Cpf_1 = __importDefault(require("../../domain/valueobject/Cpf"));
exports.DUPLICATE_EMAIL = "Já existe um usuário com este e-mail";
exports.DUPLICATE_CPF = "Já existe um usuário com este CPF";
/** Violação de unicidade do Postgres, atravessando o wrapper de erro do Drizzle. */
const uniqueViolationConstraint = (error) => {
    let current = error;
    while (current instanceof Error) {
        const candidate = current;
        if (candidate.code === "23505")
            return candidate.constraint ?? "";
        current = candidate.cause;
    }
    return null;
};
let CreateUser = CreateUser_1 = class CreateUser {
    constructor(unitOfWork, passwordHasher) {
        this.unitOfWork = unitOfWork;
        this.passwordHasher = passwordHasher;
        this.logger = new common_1.Logger(CreateUser_1.name);
    }
    async execute(input) {
        // Defesa em profundidade (ADR-001): o tipo já exclui "admin", mas uma chamada
        // direta ao usecase não passa pelo DTO. A conta admin só nasce pelo bootstrap.
        if (input.role === "admin") {
            throw new Error("A conta admin não pode ser criada por esta rota");
        }
        const cpf = Cpf_1.default.create(input.cpf);
        const passwordHash = await this.passwordHasher.hash((0, InitialPassword_1.initialPasswordFor)(cpf.digits, input.birthDate));
        const created = await this.unitOfWork.run((repositories) => this.createWithin(repositories, input, cpf.digits, passwordHash));
        this.logger.log(`Usuário ${created.userId} cadastrado com papel ${created.role}`);
        return {
            id: created.userId,
            name: created.name,
            email: created.email,
            role: created.role,
            active: created.active,
        };
    }
    async createWithin(repositories, input, cpfDigits, passwordHash) {
        // Duplicidade vale para conta ativa e desativada (US-004.AC-2): a busca não filtra
        // por `active`.
        if ((await repositories.users.findByEmail(input.email)) !== null) {
            throw new DomainErrors_1.ConflictError(exports.DUPLICATE_EMAIL);
        }
        if ((await repositories.users.findByCpf(cpfDigits)) !== null) {
            throw new DomainErrors_1.ConflictError(exports.DUPLICATE_CPF);
        }
        try {
            return await repositories.users.create({
                name: input.name,
                email: input.email,
                cpf: cpfDigits,
                birthDate: input.birthDate,
                passwordHash,
                role: input.role,
                active: true,
                // Senha inicial previsível: a troca no primeiro acesso é obrigatória (ADR-002).
                mustChangePassword: true,
            });
        }
        catch (error) {
            // Duas requisições simultâneas passam juntas pelas checagens acima (US-004.EC-2);
            // o índice único do banco é quem decide, e a perdedora vira 409, não 500.
            const constraint = uniqueViolationConstraint(error);
            if (constraint === null)
                throw error;
            throw new DomainErrors_1.ConflictError(constraint.includes("cpf") ? exports.DUPLICATE_CPF : exports.DUPLICATE_EMAIL);
        }
    }
};
CreateUser = CreateUser_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __param(1, (0, common_1.Inject)("PasswordHasher")),
    __metadata("design:paramtypes", [Object, Object])
], CreateUser);
exports.default = CreateUser;
//# sourceMappingURL=CreateUser.js.map