import type { ReactNode } from "react";
import type { UserRole } from "../api/types";
import { Banner } from "../components/ui/Banner";
import { Screen } from "../components/ui/Screen";
import { useSession } from "../session/SessionContext";

interface RequireRoleProps {
  role: UserRole;
  children: ReactNode;
}

/** Bloqueio de acesso cruzado entre papéis, com a razão explícita (US-015.EC-3). */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { user } = useSession();
  if (user !== null && user.role === role) return <>{children}</>;
  return (
    <Screen title="Acesso restrito">
      <Banner tone="error">
        {role === "operador"
          ? "Esta tela é exclusiva do papel operador."
          : "Esta tela é exclusiva do papel gerente."}
      </Banner>
    </Screen>
  );
}
