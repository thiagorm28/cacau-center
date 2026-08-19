/**
 * Erros de domínio que o filtro global traduz para um status HTTP diferente de 422.
 *
 * A convenção do projeto é "mensagem da exceção = corpo do erro", sem hierarquia de
 * exceções elaborada — estas classes existem apenas porque o contrato de API exige
 * distinguir `404`/`409`/`502` de um erro de regra de negócio comum (`422`).
 */

export class NotFoundError extends Error {}

export class ConflictError extends Error {}

export class UnauthorizedError extends Error {}

export class ForbiddenError extends Error {}

export class NfeNotFoundError extends NotFoundError {}

export class NfeServiceUnavailableError extends Error {}
