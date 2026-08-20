import type { ReactNode } from "react";
import type { UserRole } from "../api/types";
import { Banner } from "../components/ui/Banner";
import { Screen } from "../components/ui/Screen";
import { LogoutButton } from "../features/auth/LogoutButton";
import { useSession } from "../session/SessionContext";

interface RequireRoleProps {
  role: UserRole;
  children: ReactNode;
}

/**
 * Bloqueio de acesso cruzado entre papéis, com a razão explícita (US-015.EC-3).
 *
 * O admin passa por qualquer rota sem estar listado nela (ADR-006), espelhando o
 * `RoleGuard` do backend: rotas novas herdam o acesso irrestrito sem checklist manual.
 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { user } = useSession();
  if (user !== null && (user.role === "admin" || user.role === role)) return <>{children}</>;
  return (
    <Screen title="Acesso restrito" header={<LogoutButton />}>
      <Banner tone="error">
        {role === "operador"
          ? "Esta tela é exclusiva do papel operador."
          : "Esta tela é exclusiva do papel gerente."}
      </Banner>
    </Screen>
  );
}
