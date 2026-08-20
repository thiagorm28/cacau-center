import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { SessionUser } from "../../domain/SessionUser";
import { ForbiddenError } from "../../domain/error/DomainErrors";
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from "./AllowPendingPasswordChange";

/**
 * Torna a troca de senha obrigatória inescapável (ADR-002, US-011): enquanto pendente,
 * toda rota que não estiver marcada com `@AllowPendingPasswordChange()` responde 403.
 *
 * Global, registrado depois do `AuthGuard` — depende do usuário já anexado à request.
 * Rota pública não tem usuário, então passa direto.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest<{ user?: SessionUser }>().user;
    if (allowed === true || user?.mustChangePassword !== true) return true;
    throw new ForbiddenError("Troca de senha obrigatória pendente");
  }
}
