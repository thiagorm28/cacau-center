import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role, SessionUser } from "../../domain/SessionUser";
import { ForbiddenError, UnauthorizedError } from "../../domain/error/DomainErrors";
import { ROLES_KEY } from "./Roles";

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<readonly Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<{ user?: SessionUser }>().user;
    if (user === undefined) throw new UnauthorizedError("Sessão inválida ou expirada");
    if (!roles.includes(user.role)) {
      throw new ForbiddenError("Seu papel não tem acesso a este recurso");
    }
    return true;
  }
}
