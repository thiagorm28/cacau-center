import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { withSession } from "../test/session";
import { RequireRole } from "./RequireRole";

/**
 * A tela de acesso restrito é um `Screen`, que agora renderiza a gaveta de navegação —
 * e ela lê a rota atual.
 */
const routed = (screenElement: ReactElement) => <MemoryRouter>{screenElement}</MemoryRouter>;

/**
 * IDs deste arquivo vêm do catálogo `_tests.md` da feature de gestão de usuários, que
 * reaproveita numeração já usada por outras suítes — daí o arquivo próprio.
 */
describe("RequireRole", () => {
  it("UT-041: admin acessa uma rota exigida para operador, sem estar listado nela", () => {
    render(
      withSession(
        routed(
          <RequireRole role="operador">
            <p>Fila de notas</p>
          </RequireRole>,
        ),
        { user: { id: "admin-1", name: "Dona da Loja", role: "admin", mustChangePassword: false } },
      ),
    );

    expect(screen.getByText("Fila de notas")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Acesso restrito" })).not.toBeInTheDocument();
  });

  it("gerente continua barrado numa rota de operador (regressão do bypass)", () => {
    render(
      withSession(
        routed(
          <RequireRole role="operador">
            <p>Fila de notas</p>
          </RequireRole>,
        ),
        { user: { id: "user-2", name: "Gil", role: "gerente", mustChangePassword: false } },
      ),
    );

    expect(screen.queryByText("Fila de notas")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Acesso restrito" })).toBeInTheDocument();
  });
});
