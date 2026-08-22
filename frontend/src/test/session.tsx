import type { ReactElement } from "react";
import type { SessionUser } from "../api/types";
import { SessionContext } from "../session/SessionContext";
import type { SessionStatus } from "../session/SessionContext";

interface SessionOverrides {
  user?: SessionUser | null;
  status?: SessionStatus;
  signIn?: (email: string, password: string) => Promise<void>;
  signOut?: () => Promise<void>;
  applyUser?: (user: SessionUser) => void;
}

export const OPERADOR: SessionUser = {
  id: "user-1",
  name: "Marina Souza",
  role: "operador",
  mustChangePassword: false,
};

/**
 * Injeta uma sessão pronta no lugar do `SessionProvider`: os testes de tela precisam de
 * um usuário autenticado (o botão de sair vive no cabeçalho de todas elas), mas não do
 * `GET /auth/me` da carga inicial.
 */
export function withSession(children: ReactElement, overrides: SessionOverrides = {}) {
  const user = overrides.user === undefined ? OPERADOR : overrides.user;
  return (
    <SessionContext.Provider
      value={{
        status: overrides.status ?? (user === null ? "anonymous" : "authenticated"),
        user,
        expired: false,
        signIn: overrides.signIn ?? (() => Promise.resolve()),
        signOut: overrides.signOut ?? (() => Promise.resolve()),
        applyUser: overrides.applyUser ?? (() => undefined),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
