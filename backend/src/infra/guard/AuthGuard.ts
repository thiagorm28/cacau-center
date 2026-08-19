import { type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard as PassportAuthGuard } from "@nestjs/passport";
import type { Observable } from "rxjs";
import { UnauthorizedError } from "../../domain/error/DomainErrors";
import { IS_PUBLIC_KEY } from "./Public";

/**
 * Exige um cookie de sessão válido em toda rota que não esteja marcada com `@Public()`.
 * A extração e a verificação do JWT ficam no `JwtStrategy` (passport-jwt); aqui só mora
 * a decisão de deixar passar ou recusar.
 */
@Injectable()
export class AuthGuard extends PassportAuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;
    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: unknown, user: TUser | false): TUser {
    if (err !== null && err !== undefined) throw err;
    if (user === false || user === null || user === undefined) {
      throw new UnauthorizedError("Sessão inválida ou expirada");
    }
    return user;
  }
}
