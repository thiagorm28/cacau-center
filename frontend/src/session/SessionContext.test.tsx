import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listNotes } from "../api/client";
import { LoginScreen } from "../features/auth/LoginScreen";
import { SessionProvider, useSession } from "./SessionContext";

const OPERATOR = {
  id: "user-1",
  name: "Marina Souza",
  role: "operador" as const,
  mustChangePassword: false,
};

const jsonResponse = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

const fetchMock = vi.fn<typeof fetch>();

/**
 * Fala com o `fetch` global em vez de dublar `api/client`: o elo que este teste protege é
 * justamente o do cliente HTTP com a sessão — dublar o cliente apagaria o que se quer medir.
 */
const routeFetch = (routes: Record<string, Response>): void => {
  const entries = Object.entries(routes);
  fetchMock.mockImplementation((input) => {
    const path = String(input);
    const match = entries.find(([route]) => path.endsWith(route));
    return Promise.resolve(match === undefined ? jsonResponse(404, {}) : match[1]);
  });
};

/** Tela mínima que só dispara uma chamada autenticada quando o operador manda. */
function AuthenticatedScreen() {
  const { status, user } = useSession();
  if (status === "loading") return <p>Carregando…</p>;
  if (user === null) return <LoginScreen />;
  return (
    <div>
      <p>Olá, {user.name}</p>
      <button type="button" onClick={() => void listNotes("open").catch(() => undefined)}>
        Carregar notas
      </button>
    </div>
  );
}

const renderApp = () =>
  render(
    <SessionProvider>
      <AuthenticatedScreen />
    </SessionProvider>,
  );

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

describe("SessionProvider", () => {
  it("US-015.EC-2: 401 numa chamada autenticada derruba a sessão e pede novo login", async () => {
    const user = userEvent.setup();
    routeFetch({
      "/auth/me": jsonResponse(200, OPERATOR),
      "/notes?status=open": jsonResponse(401, { message: "Sessão inválida ou expirada" }),
    });

    renderApp();

    expect(await screen.findByText("Olá, Marina Souza")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Carregar notas" }));

    expect(await screen.findByText(/Sua sessão expirou/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("US-015.EC-2: novo login limpa o aviso de expiração e devolve o operador ao app", async () => {
    const user = userEvent.setup();
    routeFetch({
      "/auth/me": jsonResponse(200, OPERATOR),
      "/notes?status=open": jsonResponse(401, { message: "Sessão inválida ou expirada" }),
      "/auth/login": jsonResponse(200, OPERATOR),
    });

    renderApp();

    expect(await screen.findByText("Olá, Marina Souza")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Carregar notas" }));
    expect(await screen.findByText(/Sua sessão expirou/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("E-mail"), "marina@cacau.com");
    await user.type(screen.getByLabelText("Senha"), "senha-valida");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Olá, Marina Souza")).toBeInTheDocument();
    expect(screen.queryByText(/Sua sessão expirou/)).not.toBeInTheDocument();
  });

  it("401 do `/auth/me` da carga inicial é sessão ausente, não expirada", async () => {
    routeFetch({ "/auth/me": jsonResponse(401, { message: "Sessão inválida ou expirada" }) });

    renderApp();

    expect(await screen.findByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByText(/Sua sessão expirou/)).not.toBeInTheDocument();
  });

  it("401 de senha errada mostra só o erro de credencial, sem falar em expiração", async () => {
    const user = userEvent.setup();
    routeFetch({
      "/auth/me": jsonResponse(401, { message: "Sessão inválida ou expirada" }),
      "/auth/login": jsonResponse(401, { message: "E-mail ou senha inválidos" }),
    });

    renderApp();

    await user.type(await screen.findByLabelText("E-mail"), "marina@cacau.com");
    await user.type(screen.getByLabelText("Senha"), "senha-errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("E-mail ou senha inválidos")).toBeInTheDocument();
    expect(screen.queryByText(/Sua sessão expirou/)).not.toBeInTheDocument();
  });

  it("logout do operador volta ao login sem o aviso de expiração", async () => {
    routeFetch({
      "/auth/me": jsonResponse(200, OPERATOR),
      "/auth/logout": jsonResponse(204, {}),
    });

    function SignOutScreen() {
      const { status, user, expired, signOut } = useSession();
      if (status === "loading") return <p>Carregando…</p>;
      if (user === null) return <p>Saiu{expired ? " (expirada)" : ""}</p>;
      return (
        <button type="button" onClick={() => void signOut()}>
          Sair
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <SessionProvider>
        <SignOutScreen />
      </SessionProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Sair" }));

    await waitFor(() => expect(screen.getByText("Saiu")).toBeInTheDocument());
  });
});
