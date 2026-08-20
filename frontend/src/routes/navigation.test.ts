import { describe, expect, it } from "vitest";
import type { UserRole } from "../api/types";
import { getHomePathForRole, getNavItemsForRole, NAV_ROUTES } from "./navigation";

describe("navigation", () => {
  it("UT-001: operador enxerga apenas a fila de notas", () => {
    const items = getNavItemsForRole("operador");

    expect(items.map((item) => item.path)).toEqual(["/notas"]);
  });

  it("UT-002: gerente enxerga apenas o histórico", () => {
    const items = getNavItemsForRole("gerente");

    expect(items.map((item) => item.path)).toEqual(["/historico"]);
  });

  it("UT-003: admin enxerga as três rotas, na ordem do registro", () => {
    const items = getNavItemsForRole("admin");

    expect(items).toHaveLength(NAV_ROUTES.length);
    expect(items.map((item) => item.path)).toEqual(NAV_ROUTES.map((item) => item.path));
    expect(items.map((item) => item.path)).toEqual(["/notas", "/historico", "/usuarios"]);
  });

  const homes: readonly [UserRole, string][] = [
    ["operador", "/notas"],
    ["gerente", "/historico"],
    ["admin", "/usuarios"],
  ];

  it.each(homes)("UT-004: a tela inicial de %s é %s", (role, path) => {
    expect(getHomePathForRole(role)).toBe(path);
  });
});
