import type { UserRole } from "../api/types";

export interface NavRouteItem {
  path: string;
  label: string;
  /** Papel exigido pela rota; o admin passa por todas via `getNavItemsForRole`. */
  role: UserRole;
}

/**
 * Fonte única das funcionalidades de topo: caminho, rótulo e papel exigido (ADR-005).
 *
 * As rotas de sub-fluxo (bipagem, relatório) e a troca de senha ficam de fora de
 * propósito — não são destinos de navegação de topo (ADR-003) e seguem declaradas
 * direto no `App.tsx`. A ordem aqui é a ordem em que a gaveta lista os itens.
 */
export const NAV_ROUTES: readonly NavRouteItem[] = [
  { path: "/notas", label: "Fila de notas", role: "operador" },
  { path: "/historico", label: "Histórico", role: "gerente" },
  { path: "/usuarios", label: "Gestão de usuários", role: "admin" },
];

/**
 * Itens que o papel alcança, na ordem de `NAV_ROUTES`. O admin recebe todos, espelhando
 * o bypass que o `RequireRole` já aplica, em vez de repetir a regra em outro lugar.
 */
export function getNavItemsForRole(role: UserRole): readonly NavRouteItem[] {
  if (role === "admin") return NAV_ROUTES;
  return NAV_ROUTES.filter((item) => item.role === role);
}

/**
 * Tela inicial do papel após o login. O admin cai na gestão de usuários — a rota que
 * exige o papel dele —, e não no primeiro item da sua lista, que é a fila de notas.
 */
export function getHomePathForRole(role: UserRole): string {
  const home = NAV_ROUTES.find((item) => item.role === role);
  if (home === undefined) throw new Error(`Papel sem tela inicial definida: ${role}`);
  return home.path;
}
