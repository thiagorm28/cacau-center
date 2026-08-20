import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, changePassword } from "../../api/client";
import { OPERADOR, withSession } from "../../test/session";
import { ChangePasswordScreen } from "./ChangePasswordScreen";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return { ...actual, changePassword: vi.fn() };
});

const changePasswordMock = vi.mocked(changePassword);

const renderScreen = () => {
  const onChanged = vi.fn();
  const applyUser = vi.fn();
  render(withSession(<ChangePasswordScreen onChanged={onChanged} />, { applyUser }));
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
});
