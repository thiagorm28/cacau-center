import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DeleteNoteDialog } from "./DeleteNoteDialog";

const renderDialog = (
  overrides: Partial<ComponentProps<typeof DeleteNoteDialog>> = {},
) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <DeleteNoteDialog
      invoiceNumber="004005647"
      confirmedTotal={0}
      expectedTotal={20}
      isSubmitting={false}
      error={null}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel, user: userEvent.setup() };
};

const confirmButton = () => screen.getByRole("button", { name: "Excluir nota" });
const cancelButton = () => screen.getByRole("button", { name: "Cancelar" });

describe("DeleteNoteDialog", () => {
  it("UT-025: sem progresso, avisa a permanência sem falar em caixas conferidas", () => {
    renderDialog({ confirmedTotal: 0 });

    expect(screen.getByText(/permanente e não pode ser desfeita/i)).toBeInTheDocument();
    expect(screen.queryByText(/caixas conferidas/i)).not.toBeInTheDocument();
  });

  it("UT-026: com progresso, declara a contagem exata de caixas que será perdida", () => {
    renderDialog({ confirmedTotal: 7, expectedTotal: 20 });

    expect(screen.getByText(/7 de 20 caixas conferidas/i)).toBeInTheDocument();
    expect(screen.getByText(/permanente e não pode ser desfeita/i)).toBeInTheDocument();
  });

  it("UT-027: nota 100% bipada mas ainda aberta recebe o mesmo aviso de perda", () => {
    renderDialog({ confirmedTotal: 20, expectedTotal: 20 });

    expect(screen.getByText(/20 de 20 caixas conferidas/i)).toBeInTheDocument();
    expect(screen.getByText(/esse progresso será perdido/i)).toBeInTheDocument();
  });

  it("UT-028: confirmar chama apenas onConfirm", async () => {
    const { user, onConfirm, onCancel } = renderDialog();

    await user.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("UT-029: cancelar chama apenas onCancel", async () => {
    const { user, onConfirm, onCancel } = renderDialog();

    await user.click(cancelButton());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("UT-030: isSubmitting desabilita os dois botões", () => {
    renderDialog({ isSubmitting: true });

    expect(confirmButton()).toBeDisabled();
    expect(cancelButton()).toBeDisabled();
  });
});
