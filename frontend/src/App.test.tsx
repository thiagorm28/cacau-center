import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listHistory, listNotes, listUsers } from "./api/client";
import type { SessionUser, UserRole } from "./api/types";
import { withSession } from "./test/session";
import { App } from "./App";

vi.mock("./api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/client")>();
  return {
    ...actual,
    listNotes: vi.fn(),
    listHistory: vi.fn(),
    listUsers: vi.fn(),
  };
});

const USERS: Record<UserRole, SessionUser> = {
  operador: { id: "user-1", name: "Marina Souza", role: "operador", mustChangePassword: false },
  gerente: { id: "user-2", name: "Gil Prado", role: "gerente", mustChangePassword: false },
  admin: { id: "admin-1", name: "Dora Dona", role: "admin", mustChangePassword: false },
};

const renderAt = (path: string, role: UserRole) =>
  render(
    withSession(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
      { user: USERS[role] },
    ),
  );

const heading = (name: string) => screen.findByRole("heading", { name });

beforeEach(() => {
  vi.mocked(listNotes).mockResolvedValue([]);
  vi.mocked(listHistory).mockResolvedValue([]);
  vi.mocked(listUsers).mockResolvedValue([]);
});

describe("App", () => {
  /**
   * Regressão do ADR-005: com os papéis vindo do `navigation.ts`, o bloqueio por papel
   * das rotas de topo tem que continuar exatamente como era (espelha `RequireRole.test.tsx`,
   * agora exercitado através dos pontos de chamada refatorados).
   */
  describe("IT-006: bloqueio por papel após a refatoração", () => {
    it.each([
      ["/notas", "Notas em conferência"],
      ["/historico", "Histórico"],
      ["/usuarios", "Usuários"],
    ])("admin passa por %s sem estar listado nela", async (path, title) => {
      renderAt(path, "admin");

      expect(await heading(title)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Acesso restrito" })).not.toBeInTheDocument();
    });

    it("operador entra na fila de notas e é barrado no histórico e na gestão de usuários", async () => {
      renderAt("/notas", "operador");
      expect(await heading("Notas em conferência")).toBeInTheDocument();

      for (const path of ["/historico", "/usuarios"]) {
        const { unmount } = renderAt(path, "operador");
        expect(await heading("Acesso restrito")).toBeInTheDocument();
        unmount();
      }
    });

    it("gerente entra no histórico e é barrado na fila de notas", async () => {
      renderAt("/historico", "gerente");
      expect(await heading("Histórico")).toBeInTheDocument();

      const { unmount } = renderAt("/notas", "gerente");
      expect(await heading("Acesso restrito")).toBeInTheDocument();
      unmount();
    });
  });

  describe("IT-007: a raiz redireciona para a tela inicial do papel", () => {
    it.each([
      ["operador", "Notas em conferência"],
      ["gerente", "Histórico"],
      ["admin", "Usuários"],
    ] as readonly [UserRole, string][])("%s cai em %s", async (role, title) => {
      renderAt("/", role);

      expect(await heading(title)).toBeInTheDocument();
    });
  });

  /**
   * IT-008: a gaveta navega de verdade — montada sobre as rotas reais do `App`, não
   * sobre um `useNavigate` falso, é isso que prova a fiação de ponta a ponta.
   */
  describe("IT-008: navegação pela gaveta sobre as rotas reais", () => {
    it("admin abre a gaveta em /usuarios, toca em Histórico e a gaveta fecha na nova rota", async () => {
      const user = userEvent.setup();
      renderAt("/usuarios", "admin");
      expect(await heading("Usuários")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Abrir menu de navegação" }));
      await user.click(screen.getByRole("button", { name: "Histórico" }));

      expect(await heading("Histórico")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Usuários" })).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
