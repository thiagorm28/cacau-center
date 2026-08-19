"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ErrorFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorFilter = void 0;
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
/**
 * Filtro global: a mensagem da exceção é o corpo do erro.
 *
 * Erro de regra de negócio (`Error` puro) vira `422`; os erros de domínio tipados
 * carregam os status que o contrato de API exige explicitamente.
 */
let ErrorFilter = ErrorFilter_1 = class ErrorFilter {
    constructor() {
        this.logger = new common_1.Logger(ErrorFilter_1.name);
    }
    catch(error, host) {
        const response = host.switchToHttp().getResponse();
        if (error instanceof common_1.HttpException) {
            response.status(error.getStatus()).json(error.getResponse());
            return;
        }
        const status = ErrorFilter_1.statusOf(error);
        if (status >= 500)
            this.logger.error(`${error.name}: ${error.message}`, error.stack);
        response.status(status).json({ statusCode: status, message: error.message });
    }
    static statusOf(error) {
        if (error instanceof DomainErrors_1.UnauthorizedError)
            return 401;
        if (error instanceof DomainErrors_1.ForbiddenError)
            return 403;
        if (error instanceof DomainErrors_1.NotFoundError)
            return 404;
        if (error instanceof DomainErrors_1.ConflictError)
            return 409;
        if (error instanceof DomainErrors_1.NfeServiceUnavailableError)
            return 502;
        return 422;
    }
};
exports.ErrorFilter = ErrorFilter;
exports.ErrorFilter = ErrorFilter = ErrorFilter_1 = __decorate([
    (0, common_1.Catch)(Error)
], ErrorFilter);
//# sourceMappingURL=ErrorFilter.js.map