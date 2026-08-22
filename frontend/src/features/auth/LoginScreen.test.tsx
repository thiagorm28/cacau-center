import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withSession } from "../../test/session";
import { LoginScreen } from "./LoginScreen";

/** O `Screen` renderiza a gaveta de navegação, que lê a rota atual. */
const routed = (screenElement: ReactElement) => <MemoryRouter>{screenElement}</MemoryRouter>;

const renderScreen = () => {
  const signIn = vi.fn(() => Promise.resolve());
  // A tela de login é a única renderizada sem usuário na sessão.
  const view = render(withSession(routed(<LoginScreen />), { user: null, signIn }));
  return { signIn, user: userEvent.setup(), view };
};

const passwordInput = () => screen.getByLabelText("Senha");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoginScreen", () => {
  it("UT-019: o campo de senha começa oculto, com o botão de alternar visível", () => {
    renderScreen();

    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
  });

  it("UT-020: envio com a senha visível chama signIn com o valor digitado", async () => {
    const { user, signIn } = renderScreen();

    await user.type(screen.getByLabelText("E-mail"), "operador@loja.com");
    await user.type(passwordInput(), "chocolate1");
    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(passwordInput()).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith("operador@loja.com", "chocolate1");
  });

  it("UT-021: remontar a tela volta a senha ao estado oculto", async () => {
    const { user, view } = renderScreen();

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(passwordInput()).toHaveAttribute("type", "text");

    view.unmount();
    render(withSession(routed(<LoginScreen />), { user: null }));

    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toBeInTheDocument();
  });
});
