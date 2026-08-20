import { SetMetadata } from "@nestjs/common";

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = "allowPendingPasswordChange";

/**
 * Dispensa o `PasswordChangeGuard` global: a rota continua acessível a quem tem troca
 * de senha obrigatória pendente (ADR-002) — só a própria troca, o `me` e o `logout`.
 */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
