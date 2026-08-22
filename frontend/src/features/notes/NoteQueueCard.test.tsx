import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError, NetworkError } from "../../api/client";
import type { NoteView } from "../../api/types";
import { buildItem, buildNote } from "../../test/fixtures";
import { NoteQueueCard } from "./NoteQueueCard";

const renderCard = (
  { note = buildNote(), isOnline = true }: { note?: NoteView; isOnline?: boolean } = {},
) => {
  const onOpen = vi.fn();
  const onDelete = vi.fn<(noteId: string) => Promise<void>>().mockResolvedValue(undefined);
  const view = render(
    <NoteQueueCard note={note} isOnline={isOnline} onOpen={onOpen} onDelete={onDelete} />,
  );
  const rerender = (next: boolean) =>
    view.rerender(
      <NoteQueueCard note={note} isOnline={next} onOpen={onOpen} onDelete={onDelete} />,
    );
  return { onOpen, onDelete, rerender, user: userEvent.setup() };
};

const openButton = () => screen.getByRole("button", { name: "Ver produtos" });
const deleteButton = () => screen.getByRole("button", { name: "Excluir" });
const dialog = () => screen.queryByRole("dialog");

describe("NoteQueueCard", () => {
  it("UT-031: 'Ver produtos' abre a nota e não abre o diálogo de exclusão", async () => {
    const { user, onOpen } = renderCard();

    await user.click(openButton());

    expect(onOpen).toHaveBeenCalledWith("note-1");
    expect(dialog()).not.toBeInTheDocument();
  });

  it("UT-032: 'Excluir' abre o diálogo e não abre a nota", async () => {
    const { user, onOpen } = renderCard();

    await user.click(deleteButton());

    expect(dialog()).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("UT-033: confirmar no diálogo chama onDelete com o id da nota", async () => {
    const { user, onDelete } = renderCard();

    await user.click(deleteButton());
    await user.click(screen.getByRole("button", { name: "Excluir nota" }));

    expect(onDelete).toHaveBeenCalledWith("note-1");
  });

  it("UT-034: rejeição de ApiError aparece no diálogo, que continua aberto", async () => {
    const { user, onDelete, onOpen } = renderCard();
    onDelete.mockRejectedValue(new ApiError(409, "Nota não está mais em conferência"));

    await user.click(deleteButton());
    await user.click(screen.getByRole("button", { name: "Excluir nota" }));

    expect(await screen.findByText("Nota não está mais em conferência")).toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("UT-035: rejeição de NetworkError mostra a mensagem de conexão no diálogo", async () => {
    const { user, onDelete } = renderCard();
    onDelete.mockRejectedValue(new NetworkError());

    await user.click(deleteButton());
    await user.click(screen.getByRole("button", { name: "Excluir nota" }));

    expect(await screen.findByText(/sem conexão: é preciso estar conectado/i)).toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
  });

  it("UT-036: offline desabilita o botão de excluir", () => {
    renderCard({ isOnline: false });

    expect(deleteButton()).toBeDisabled();
    expect(openButton()).toBeEnabled();
  });

  it("UT-037: voltar a ficar online reabilita o botão de excluir", () => {
    const { rerender } = renderCard({ isOnline: false });
    expect(deleteButton()).toBeDisabled();

    rerender(true);

    expect(deleteButton()).toBeEnabled();
  });

  it("UT-038: nota de 1 item esperado funciona nos dois controles", async () => {
    const note = buildNote({
      noteId: "note-unica",
      items: [buildItem({ expectedQty: 1, confirmedQty: 0, missingQty: 1 })],
    });
    const { user, onOpen } = renderCard({ note });

    expect(screen.getByText("0/1")).toBeInTheDocument();
    await user.click(openButton());
    expect(onOpen).toHaveBeenCalledWith("note-unica");

    await user.click(deleteButton());
    expect(dialog()).toBeInTheDocument();
  });
});
