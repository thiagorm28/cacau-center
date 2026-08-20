import { Injectable } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { SESSION_TTL_SECONDS, type SessionUser } from "../../domain/SessionUser";

export type JwtPayload = {
  sub: string;
  name: string;
  email: string;
  role: SessionUser["role"];
  /** Estado da troca obrigatória no momento da emissão (ADR-002). */
  mustChangePassword: boolean;
};

export interface TokenGenerator {
  generate(user: SessionUser): Promise<string>;
  /** Segundos de validade do token emitido — usado para o `Max-Age` do cookie. */
  ttlInSeconds(): number;
}

@Injectable()
export default class TokenGeneratorJwt implements TokenGenerator {
  constructor(private readonly jwtService: JwtService) {}

  generate(user: SessionUser): Promise<string> {
    const payload: JwtPayload = {
      sub: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    return this.jwtService.signAsync(payload, { expiresIn: SESSION_TTL_SECONDS });
  }

  ttlInSeconds(): number {
    return SESSION_TTL_SECONDS;
  }
}
