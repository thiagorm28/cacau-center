import { Injectable } from "@nestjs/common";

/**
 * Corte imediato de acesso para contas desativadas (ADR-005).
 *
 * Singleton do processo Nest: guarda o instante da revogação por usuário e compara com
 * o `iat` do JWT apresentado. Reativar não precisa limpar nada — um token emitido
 * depois da revogação já tem `iat` posterior e passa naturalmente.
 *
 * Risco aceito em ADR-005: o estado vive só na memória do processo e não sobrevive a um
 * restart do backend.
 */
@Injectable()
export class SessionRevocationStore {
  private readonly revokedAtMs = new Map<string, number>();

  revoke(userId: string): void {
    this.revokedAtMs.set(userId, Date.now());
  }

  isRevoked(userId: string, tokenIssuedAtSeconds: number): boolean {
    const revokedAt = this.revokedAtMs.get(userId);
    return revokedAt !== undefined && tokenIssuedAtSeconds * 1000 < revokedAt;
  }
}
