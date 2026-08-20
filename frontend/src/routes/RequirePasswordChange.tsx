import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../session/SessionContext";

export const CHANGE_PASSWORD_PATH = "/trocar-senha";

/**
 * Trava de navegação da troca obrigatória (ADR-002, US-011): enquanto o servidor disser
 * que a troca está pendente, qualquer rota devolve o usuário à tela de troca.
 *
 * A decisão sai de `session.user.mustChangePassword` a cada render — o mesmo valor que o
 * backend acabou de emitir no JWT —, e não de um sinalizador local de "já trocou": assim
 * o desbloqueio acontece na hora em que o servidor confirma a troca, e nem antes.
 */
export function RequirePasswordChange({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const { pathname } = useLocation();
  if (user !== null && user.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }
  return <>{children}</>;
}
