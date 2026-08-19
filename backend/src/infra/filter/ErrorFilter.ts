import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { Response } from "express";
import {
  ConflictError,
  ForbiddenError,
  NfeServiceUnavailableError,
  NotFoundError,
  UnauthorizedError,
} from "../../domain/error/DomainErrors";

/**
 * Filtro global: a mensagem da exceção é o corpo do erro.
 *
 * Erro de regra de negócio (`Error` puro) vira `422`; os erros de domínio tipados
 * carregam os status que o contrato de API exige explicitamente.
 */
@Catch(Error)
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  catch(error: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    const status = ErrorFilter.statusOf(error);
    if (status >= 500) this.logger.error(`${error.name}: ${error.message}`, error.stack);
    response.status(status).json({ statusCode: status, message: error.message });
  }

  private static statusOf(error: Error): number {
    if (error instanceof UnauthorizedError) return 401;
    if (error instanceof ForbiddenError) return 403;
    if (error instanceof NotFoundError) return 404;
    if (error instanceof ConflictError) return 409;
    if (error instanceof NfeServiceUnavailableError) return 502;
    return 422;
  }
}
