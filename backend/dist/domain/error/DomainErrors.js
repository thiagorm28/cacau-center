"use strict";
/**
 * Erros de domínio que o filtro global traduz para um status HTTP diferente de 422.
 *
 * A convenção do projeto é "mensagem da exceção = corpo do erro", sem hierarquia de
 * exceções elaborada — estas classes existem apenas porque o contrato de API exige
 * distinguir `404`/`409`/`502` de um erro de regra de negócio comum (`422`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NfeServiceUnavailableError = exports.NfeNotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.ConflictError = exports.NotFoundError = void 0;
class NotFoundError extends Error {
}
exports.NotFoundError = NotFoundError;
class ConflictError extends Error {
}
exports.ConflictError = ConflictError;
class UnauthorizedError extends Error {
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends Error {
}
exports.ForbiddenError = ForbiddenError;
class NfeNotFoundError extends NotFoundError {
}
exports.NfeNotFoundError = NfeNotFoundError;
class NfeServiceUnavailableError extends Error {
}
exports.NfeServiceUnavailableError = NfeServiceUnavailableError;
//# sourceMappingURL=DomainErrors.js.map