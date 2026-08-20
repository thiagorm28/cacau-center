import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildUser } from "../../test/fixtures";
import { UserFormDialog } from "./UserFormDialog";

const renderDialog = (props: Partial<Parameters<typeof UserFormDialog>[0]> = {}) => {
  const onSubmit = vi.fn();
  render(
    <UserFormDialog
      isSubmitting={false}
      error={null}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
      {...props}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
};

const fillCreateForm = async (
  user: ReturnType<typeof userEvent.setup>,
  overrides: { name?: string; birthDate?: string; cpf?: string; email?: string } = {},
) => {
  const values = {
    name: "Novo Operador",
    birthDate: "1995-05-20",
    cpf: "11144477735",
    email: "novo@loja.com",
    ...overrides,
  };
  if (values.name !== "") await user.type(screen.getByLabelText("Nome"), values.name);
  if (values.birthDate !== "")
    await user.type(screen.getByLabelText("Data de nascimento"), values.birthDate);
  if (values.cpf !== "") await user.type(screen.getByLabelText("CPF"), values.cpf);
  if (values.email !== "") await user.type(screen.getByLabelText("E-mail"), values.email);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UserFormDialog", () => {
  it("UT-045: campo obrigatório vazio bloqueia o cadastro e aponta o campo faltante", async () => {
    const { onSubmit, user } = renderDialog();

    await fillCreateForm(user, { cpf: "" });
    await user.click(screen.getByRole("radio", { name: "Operador" }));
    await user.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Informe o CPF.");
  });

  it("UT-046: cadastro sem perfil selecionado é bloqueado", async () => {
    const { onSubmit, user } = renderDialog();

    await fillCreateForm(user);
    await user.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Escolha um perfil: operador ou gerente.");
  });

  it("UT-047: o seletor de perfil só oferece operador e gerente", () => {
    renderDialog();

    expect(screen.getAllByRole("radio").map((option) => option.getAttribute("value"))).toEqual([
      "operador",
      "gerente",
    ]);
    expect(screen.queryByRole("radio", { name: /admin/i })).toBeNull();
  });

  it("cadastro completo entrega os valores preenchidos", async () => {
    const { onSubmit, user } = renderDialog();

    await fillCreateForm(user);
    await user.click(screen.getByRole("radio", { name: "Gerente" }));
    await user.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Novo Operador",
      email: "novo@loja.com",
      cpf: "11144477735",
      birthDate: "1995-05-20",
      role: "gerente",
    });
  });

  it("na edição, CPF e e-mail vêm preenchidos e travados", async () => {
    const editado = buildUser({ name: "Marina Souza", email: "marina@loja.com" });
    const { onSubmit, user } = renderDialog({ user: editado });

    expect(screen.getByLabelText("CPF")).toBeDisabled();
    expect(screen.getByLabelText("E-mail")).toBeDisabled();

    await user.clear(screen.getByLabelText("Nome"));
    await user.type(screen.getByLabelText("Nome"), "Marina S. Lima");
    await user.click(screen.getByRole("radio", { name: "Gerente" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Marina S. Lima",
      email: "marina@loja.com",
      cpf: "52998224725",
      birthDate: "1990-03-15",
      role: "gerente",
    });
  });

  // O seletor nunca é pré-marcado com "admin" nem oferece a opção (US-006.EC-1).
  it("na edição, o perfil atual já vem marcado", () => {
    renderDialog({ user: buildUser({ role: "gerente" }) });

    expect(screen.getByRole("radio", { name: "Gerente" })).toBeChecked();
  });
});
