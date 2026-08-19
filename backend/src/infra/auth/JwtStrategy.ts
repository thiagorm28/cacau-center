import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { SessionUser } from "../../domain/SessionUser";
import type { JwtPayload } from "./TokenGenerator";

/** Nome do cookie `httpOnly` que carrega o JWT de sessão (ADR-009). */
export const SESSION_COOKIE = "session";

export const cookieExtractor = (request: Request): string | null => {
  const cookies = (request as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(secret: string) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): SessionUser {
    return {
      userId: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  }
}
