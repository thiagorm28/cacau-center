import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, changePassword } from "../../api/client";
import { OPERADOR, withSession } from "../../test/session";
import { ChangePasswordScreen, PASSWORDS_DO_NOT_MATCH } from "./ChangePasswordScreen";

/**
 * O `Screen` renderiza a gaveta de navegação, que lê a rota atual — daí o `MemoryRouter`
 * em volta de qualquer tela nos testes.
 */
const routed = (screenElement: ReactElement) => <MemoryRouter>{screenElement}</MemoryRouter>;


vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return { ...actual, changePassword: vi.fn() };
});

const changePasswordMock = vi.mocked(changePassword);

const renderScreen = () => {
  const onChanged = vi.fn();
  const applyUser = vi.fn();
  render(withSession(routed(<ChangePasswordScreen onChanged={onChanged} />), { applyUser }));
  return { onChanged, applyUser, user: userEvent.setup() };
};

const fill = async (
  user: ReturnType<typeof userEvent.setup>,
  newPassword: string,
  confirmation: string,
) => {
  await user.type(screen.getByLabelText("Nova senha"), newPassword);
  await user.type(screen.getByLabelText("Confirme a nova senha"), confirmation);
  await user.click(screen.getByRole("button", { name: "Salvar nova senha" }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ChangePasswordScreen", () => {
  it("UT-049: confirmação diferente da nova senha bloqueia o envio", async () => {
    const { user, onChanged } = renderScreen();

    await fill(user, "chocolate1", "chocolate2");

    expect(changePasswordMock).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("As senhas não coincidem");
  });

  it("senha válida troca a senha, atualiza a sessão com a resposta do servidor e libera o app", async () => {
    const changed = { ...OPERADOR, mustChangePassword: false };
    changePasswordMock.mockResolvedValue(changed);
    const { user, onChanged, applyUser } = renderScreen();

    await fill(user, "chocolate1", "chocolate1");

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(changePasswordMock).toHaveBeenCalledWith({
      newPassword: "chocolate1",
      confirmPassword: "chocolate1",
    });
    expect(applyUser).toHaveBeenCalledWith(changed);
  });

  it("mostra a mensagem do backend quando a nova senha é recusada pela política", async () => {
    // A regra tem um dono só, no backend: a tela repassa o texto, não o reimplementa.
    changePasswordMock.mockRejectedValue(
      new ApiError(422, "A senha deve conter ao menos um dígito"),
    );
    const { user, onChanged } = renderScreen();

    await fill(user, "chocolate", "chocolate");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "A senha deve conter ao menos um dígito",
    );
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("UT-022: os dois campos alternam a visibilidade de forma independente", async () => {
    const { user } = renderScreen();
    const nova = screen.getByLabelText("Nova senha");
    const confirmacao = screen.getByLabelText("Confirme a nova senha");
    // Cada campo traz o seu próprio botão dentro do mesmo `div` do `<input>`.
    const toggleOf = (input: HTMLElement) =>
      within(input.parentElement as HTMLElement).getByRole("button");

    // Act — mostra só a "Nova senha"
    await user.click(toggleOf(nova));

    expect(nova).toHaveAttribute("type", "text");
    expect(confirmacao).toHaveAttribute("type", "password");

    // Act — mostra também a confirmação e volta a ocultar a nova senha
    await user.click(toggleOf(confirmacao));
    await user.click(toggleOf(nova));

    expect(nova).toHaveAttribute("type", "password");
    expect(confirmacao).toHaveAttribute("type", "text");
  });

  it("UT-023: erro de senhas diferentes não reseta a visibilidade de nenhum dos campos", async () => {
    const { user } = renderScreen();
    const nova = screen.getByLabelText("Nova senha");
    const confirmacao = screen.getByLabelText("Confirme a nova senha");

    // Arrange — só a "Nova senha" visível antes de tentar salvar
    await user.click(within(nova.parentElement as HTMLElement).getByRole("button"));

    await fill(user, "chocolate1", "chocolate2");

    expect(screen.getByRole("status")).toHaveTextContent(PASSWORDS_DO_NOT_MATCH);
    expect(nova).toHaveAttribute("type", "text");
    expect(confirmacao).toHaveAttribute("type", "password");
  });
});
