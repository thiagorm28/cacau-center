import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { SessionUser } from "../../domain/SessionUser";
import type { SessionRevocationStore } from "./SessionRevocationStore";
import type { JwtPayload } from "./TokenGenerator";

/** `iat` (issued-at, em segundos) é adicionado pelo `@nestjs/jwt` a cada token. */
type SignedJwtPayload = JwtPayload & { iat: number };

/** Nome do cookie `httpOnly` que carrega o JWT de sessão (ADR-009). */
export const SESSION_COOKIE = "session";

export const cookieExtractor = (request: Request): string | null => {
  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    secret: string,
    private readonly revocations: SessionRevocationStore,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * `false` reaproveita o caminho de 401 que o `AuthGuard.handleRequest` já trata —
   * não existe erro novo aqui (ADR-005).
   */
  validate(payload: SignedJwtPayload): SessionUser | false {
    if (this.revocations.isRevoked(payload.sub, payload.iat)) return false;
    return {
      userId: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      mustChangePassword: payload.mustChangePassword,
    };
  }
}
