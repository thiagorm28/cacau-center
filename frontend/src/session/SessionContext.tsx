import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as api from "../api/client";
import type { SessionUser } from "../api/types";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  /** Verdadeiro quando a sessão caiu sozinha (401), não quando o operador saiu. */
  expired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Substitui a identidade em memória pela que o servidor acabou de devolver (hoje só a
   * troca de senha faz isso). O estado continua sendo o do servidor: quem chama passa o
   * corpo da resposta, nunca um `mustChangePassword` inferido no cliente (US-011).
   */
  applyUser: (user: SessionUser) => void;
}

/** Exportado para os testes injetarem uma sessão sem passar pelo `GET /auth/me`. */
export const SessionContext = createContext<SessionState | null>(null);

/**
 * Estado de sessão é genuinamente transversal (roteamento por papel, cabeçalho,
 * guardas de rota), então vive em Context — não em prop drilling.
 * O token nunca é lido no cliente: quem sabe "quem sou eu" é `GET /auth/me` (ADR-009).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((current) => {
        if (!active) return;
        setUser(current);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("anonymous");
      });
    return () => {
      active = false;
    };
  }, []);

  /**
   * Sessão expirada com o app aberto: o cookie some do servidor sem nenhum aviso ao
   * cliente, então o único sinal é o `401` da próxima chamada. Voltar para `anonymous`
   * traz a `LoginScreen` (US-015.EC-2) e, de quebra, desmonta a bipagem — o que encerra a
   * retentativa de 5s de `useOfflineQueue`, que ficaria batendo em 401 para sempre. A fila
   * permanece no IndexedDB e drena sozinha quando o operador entra de novo.
   *
   * O ouvinte só existe enquanto há sessão: `POST /auth/login` com senha errada e o
   * `GET /auth/me` da carga inicial também respondem `401`, e nenhum dos dois é expiração.
   */
  useEffect(() => {
    if (status !== "authenticated") return;
    api.setSessionExpiredListener(() => {
      setUser(null);
      setStatus("anonymous");
      setExpired(true);
    });
    return () => api.setSessionExpiredListener(null);
  }, [status]);

  const signIn = useCallback(async (email: string, password: string) => {
    const current = await api.login(email, password);
    setUser(current);
    setStatus("authenticated");
    setExpired(false);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
    setStatus("anonymous");
    setExpired(false);
  }, []);

  const applyUser = useCallback((current: SessionUser) => {
    setUser(current);
    setStatus("authenticated");
  }, []);

  const value = useMemo<SessionState>(
    () => ({ status, user, expired, signIn, signOut, applyUser }),
    [status, user, expired, signIn, signOut, applyUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const session = useContext(SessionContext);
  if (session === null) throw new Error("useSession precisa estar dentro de <SessionProvider>");
  return session;
}
