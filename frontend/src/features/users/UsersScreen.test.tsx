import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deactivateUser, listUsers, resetUserPassword } from "../../api/client";
import type { SessionUser } from "../../api/types";
import { buildUser } from "../../test/fixtures";
import { withSession } from "../../test/session";
import { UsersScreen } from "./UsersScreen";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return {
    ...actual,
    listUsers: vi.fn(),
    deactivateUser: vi.fn(),
    resetUserPassword: vi.fn(),
  };
});

const listUsersMock = vi.mocked(listUsers);
const deactivateUserMock = vi.mocked(deactivateUser);
const resetUserPasswordMock = vi.mocked(resetUserPassword);

const ADMIN: SessionUser = {
  id: "admin-1",
  name: "Dora Dona",
  role: "admin",
  mustChangePassword: false,
};

const renderScreen = () => {
  render(withSession(<UsersScreen />, { user: ADMIN }));
  return userEvent.setup();
};

/** Botão dentro da folha de confirmação — o mesmo rótulo existe na linha que a abriu. */
const inDialog = (name: string) =>
  within(screen.getByRole("dialog")).getByRole("button", { name });

/** Linha da listagem correspondente a um usuário, pelo nome exibido no cartão. */
const rowOf = (name: string) =>
  within(screen.getAllByRole("listitem").find((item) => within(item).queryByText(name) !== null)!);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UsersScreen", () => {
  it("UT-044: distingue visualmente usuário ativo de desativado", async () => {
    listUsersMock.mockResolvedValue([
      buildUser({ id: "user-1", name: "Marina Souza" }),
      buildUser({
        id: "user-2",
        name: "João Lima",
        email: "joao@loja.com",
        role: "gerente",
        active: false,
      }),
    ]);

    renderScreen();

    const ativo = await screen.findByText("Ativo");
    const desativado = screen.getByText("Desativado");
    expect(rowOf("Marina Souza").getByText("Ativo")).toBe(ativo);
    expect(rowOf("João Lima").getByText("Desativado")).toBe(desativado);
    // O status não é só a palavra: os dois estados têm tratamentos visuais diferentes.
    expect(ativo.className).not.toEqual(desativado.className);
  });

  it("UT-048: a linha do próprio admin não oferece a ação de desativar", async () => {
    listUsersMock.mockResolvedValue([
      buildUser({ id: "admin-1", name: "Dora Dona", email: "admin@loja.com", role: "admin" }),
      buildUser({ id: "user-1", name: "Marina Souza" }),
    ]);

    renderScreen();

    await screen.findByText("Dora Dona");
    expect(rowOf("Dora Dona").queryByRole("button", { name: "Desativar" })).toBeNull();
    expect(rowOf("Dora Dona").queryByRole("button", { name: "Editar" })).toBeNull();
    // A ação continua existindo para os demais usuários.
    expect(rowOf("Marina Souza").getByRole("button", { name: "Desativar" })).toBeInTheDocument();
  });

  it("desativa um usuário depois da confirmação e recarrega a lista", async () => {
    listUsersMock
      .mockResolvedValueOnce([buildUser({ id: "user-1", name: "Marina Souza" })])
      .mockResolvedValueOnce([buildUser({ id: "user-1", name: "Marina Souza", active: false })]);
    deactivateUserMock.mockResolvedValue();

    const user = renderScreen();
    await screen.findByText("Marina Souza");
    await user.click(rowOf("Marina Souza").getByRole("button", { name: "Desativar" }));

    // A ação só acontece depois do passo de confirmação.
    expect(deactivateUserMock).not.toHaveBeenCalled();
    await user.click(inDialog("Desativar"));

    await waitFor(() => expect(deactivateUserMock).toHaveBeenCalledWith("user-1"));
    expect(await screen.findByText("Desativado")).toBeInTheDocument();
  });

  it("mostra a senha inicial depois de resetar, para o admin comunicá-la ao funcionário", async () => {
    listUsersMock.mockResolvedValue([
      buildUser({ id: "user-1", name: "Marina Souza", cpf: "52998224725", birthDate: "1990-03-15" }),
    ]);
    resetUserPasswordMock.mockResolvedValue();

    const user = renderScreen();
    await screen.findByText("Marina Souza");
    await user.click(rowOf("Marina Souza").getByRole("button", { name: "Resetar senha" }));
    await user.click(inDialog("Resetar senha"));

    expect(await screen.findByText(/52998224725@15031990/)).toBeInTheDocument();
  });

  it("mostra a recusa do backend quando a ação falha", async () => {
    listUsersMock.mockResolvedValue([buildUser({ id: "user-1", name: "Marina Souza" })]);
    deactivateUserMock.mockRejectedValue(new Error("A conta admin não pode ser desativada"));

    const user = renderScreen();
    await screen.findByText("Marina Souza");
    await user.click(rowOf("Marina Souza").getByRole("button", { name: "Desativar" }));
    await user.click(inDialog("Desativar"));

    expect(await screen.findByText("A conta admin não pode ser desativada")).toBeInTheDocument();
  });
});
