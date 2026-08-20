import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listNotes, me, setSessionExpiredListener } from "../../api/client";
import { ChangePasswordScreen } from "../../features/auth/ChangePasswordScreen";
import { LoginScreen } from "../../features/auth/LoginScreen";
import { NotesQueueScreen } from "../../features/notes/NotesQueueScreen";
import { SessionProvider } from "../../session/SessionContext";
import { OPERADOR, withSession } from "../../test/session";
import { Screen } from "./Screen";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    me: vi.fn(),
    listNotes: vi.fn(),
    setSessionExpiredListener: vi.fn(),
  };
});

/** Ouvinte de sessão expirada que o `SessionProvider` registrou (IT-009). */
let expireSession: (() => void) | null = null;

const renderRouted = (element: ReactElement) =>
  render(<MemoryRouter initialEntries={["/notas"]}>{element}</MemoryRouter>);

const queryTrigger = () => screen.queryByRole("button", { name: "Abrir menu de navegação" });

beforeEach(() => {
  expireSession = null;
  vi.mocked(listNotes).mockResolvedValue([]);
  vi.mocked(setSessionExpiredListener).mockImplementation((listener) => {
    expireSession = listener;
  });
});

describe("Screen + NavDrawer", () => {
  it("IT-001: sessão autenticada ganha o gatilho da gaveta sem nenhuma prop nova", () => {
    renderRouted(withSession(<Screen title="Notas em conferência">{null}</Screen>));

    expect(queryTrigger()).toBeInTheDocument();
  });

  it("IT-002: troca de senha obrigatória pendente não ganha o gatilho", () => {
    renderRouted(
      withSession(<Screen title="Trocar senha">{null}</Screen>, {
        user: { ...OPERADOR, mustChangePassword: true },
      }),
    );

    expect(queryTrigger()).not.toBeInTheDocument();
  });

  it("IT-003: tela de login (sessão anônima) não ganha o gatilho", async () => {
    vi.mocked(me).mockRejectedValue(new Error("sem sessão"));

    renderRouted(
      <SessionProvider>
        <LoginScreen />
      </SessionProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Conferência de notas" })).toBeInTheDocument();
    expect(queryTrigger()).not.toBeInTheDocument();
  });

  it("IT-004: a troca de senha mantém seu próprio botão de sair e segue sem gaveta", () => {
    renderRouted(
      withSession(<ChangePasswordScreen onChanged={() => undefined} />, {
        user: { ...OPERADOR, mustChangePassword: true },
      }),
    );

    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(queryTrigger()).not.toBeInTheDocument();
  });

  it("IT-005: a fila de notas perde o botão de sair avulso e fica só com a gaveta", async () => {
    renderRouted(withSession(<NotesQueueScreen onOpenNote={() => undefined} />));

    await waitFor(() => expect(vi.mocked(listNotes)).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
    expect(queryTrigger()).toBeInTheDocument();
  });

  it("IT-009: sessão expirada com a gaveta aberta remove gaveta e gatilho", async () => {
    vi.mocked(me).mockResolvedValue(OPERADOR);
    const user = userEvent.setup();
    renderRouted(
      <SessionProvider>
        <Screen title="Notas em conferência">{null}</Screen>
      </SessionProvider>,
    );

    await waitFor(() => expect(queryTrigger()).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Abrir menu de navegação" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    expect(expireSession).not.toBeNull();
    act(() => expireSession?.());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(queryTrigger()).not.toBeInTheDocument();
  });

  it("IT-010: gesto de voltar do sistema com a gaveta aberta fecha a gaveta, sem estado inconsistente", async () => {
    // `navigate(-1)` é o equivalente programático do botão/gesto de voltar do sistema —
    // ambos disparam uma navegação POP que não passa pelos handlers de fechar da gaveta
    // (fundo, swipe, item da lista), daí precisar de cobertura própria (US-002.EC-1).
    function GoBackButton() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate(-1)}>
          Voltar
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/notas", "/historico"]} initialIndex={1}>
        <GoBackButton />
        {withSession(<Screen title="Histórico">{null}</Screen>)}
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Abrir menu de navegação" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(queryTrigger()).toBeInTheDocument();
  });
});
