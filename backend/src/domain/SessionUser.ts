export type Role = "operador" | "gerente" | "admin";

/** Identidade do usuário autenticado, derivada das claims do JWT de sessão (ADR-009). */
export type SessionUser = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  /** Troca de senha obrigatória pendente (ADR-002); reavaliada a cada emissão de token. */
  mustChangePassword: boolean;
};

/** Duração da sessão: um turno de trabalho (ADR-009). */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
