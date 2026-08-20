import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../api/types";
import { OPERADOR, withSession } from "../test/session";
import { CHANGE_PASSWORD_PATH, RequirePasswordChange } from "./RequirePasswordChange";

/** Monta a trava sobre uma árvore de rotas mínima, a partir de uma rota qualquer. */
const renderAt = (path: string, user: SessionUser) =>
  render(
    withSession(
      <MemoryRouter initialEntries={[path]}>
        <RequirePasswordChange>
          <Routes>
            <Route path="/notas" element={<p>Fila de notas</p>} />
            <Route path={CHANGE_PASSWORD_PATH} element={<p>Defina uma nova senha</p>} />
          </Routes>
        </RequirePasswordChange>
      </MemoryRouter>,
      { user },
    ),
  );

describe("RequirePasswordChange", () => {
  it("UT-042: com troca pendente, qualquer outra rota devolve à tela de troca", () => {
    renderAt("/notas", { ...OPERADOR, mustChangePassword: true });

    expect(screen.getByText("Defina uma nova senha")).toBeInTheDocument();
    expect(screen.queryByText("Fila de notas")).not.toBeInTheDocument();
  });

  it("UT-043: sem troca pendente, a rota pedida é renderizada normalmente", () => {
    renderAt("/notas", { ...OPERADOR, mustChangePassword: false });

    expect(screen.getByText("Fila de notas")).toBeInTheDocument();
    expect(screen.queryByText("Defina uma nova senha")).not.toBeInTheDocument();
  });

  it("com troca pendente, a própria tela de troca não entra em laço de redirecionamento", () => {
    renderAt(CHANGE_PASSWORD_PATH, { ...OPERADOR, mustChangePassword: true });

    expect(screen.getByText("Defina uma nova senha")).toBeInTheDocument();
  });
});
