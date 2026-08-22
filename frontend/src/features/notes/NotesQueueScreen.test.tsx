import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteNote, listNotes } from "../../api/client";
import type { NoteView } from "../../api/types";
import { buildNote } from "../../test/fixtures";
import { withSession } from "../../test/session";
import { NotesQueueScreen } from "./NotesQueueScreen";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return { ...actual, listNotes: vi.fn(), deleteNote: vi.fn() };
});

const listNotesMock = vi.mocked(listNotes);
const deleteNoteMock = vi.mocked(deleteNote);

/** `buildNote` deriva os totais dos itens; a fila só precisa dos agregados. */
const queuedNote = (
  noteId: string,
  invoiceNumber: string,
  confirmedTotal: number,
  expectedTotal: number,
  openedAt: string,
): NoteView =>
  buildNote({ noteId, invoiceNumber, openedAt, items: [], confirmedTotal, expectedTotal });

const renderScreen = async () => {
  const onOpenNote = vi.fn();
  render(
    <MemoryRouter initialEntries={["/notas"]}>
      {withSession(<NotesQueueScreen onOpenNote={onOpenNote} />)}
    </MemoryRouter>,
  );
  await waitFor(() => expect(listNotesMock).toHaveBeenCalledWith("open"));
  return { onOpenNote, user: userEvent.setup() };
};

const quickScanButton = () => screen.getByRole("button", { name: "Bipar" });

beforeEach(() => {
  vi.clearAllMocks();
  listNotesMock.mockResolvedValue([]);
  deleteNoteMock.mockResolvedValue(undefined);
});

describe("NotesQueueScreen", () => {
  it("UT-039: o atalho de bipagem abre a nota de maior percentual concluído", async () => {
    listNotesMock.mockResolvedValue([
      queuedNote("note-a", "001", 2, 10, "2026-08-17T10:00:00.000Z"),
      queuedNote("note-b", "002", 9, 10, "2026-08-17T11:00:00.000Z"),
      queuedNote("note-c", "003", 5, 10, "2026-08-17T12:00:00.000Z"),
    ]);
    const { user, onOpenNote } = await renderScreen();

    await user.click(quickScanButton());

    expect(onOpenNote).toHaveBeenCalledWith("note-b");
  });

  it("UT-040: empate de percentual resolve pela nota aberta há mais tempo", async () => {
    listNotesMock.mockResolvedValue([
      queuedNote("note-nova", "002", 5, 10, "2026-08-17T12:00:00.000Z"),
      queuedNote("note-antiga", "001", 1, 2, "2026-08-17T09:00:00.000Z"),
    ]);
    const { user, onOpenNote } = await renderScreen();

    await user.click(quickScanButton());

    expect(onOpenNote).toHaveBeenCalledWith("note-antiga");
  });

  it("UT-041: sem nota aberta, o atalho de bipagem fica desabilitado", async () => {
    await renderScreen();

    expect(quickScanButton()).toBeDisabled();
  });

  it("UT-042: excluir uma nota recarrega a fila e o card some", async () => {
    const remaining = queuedNote("note-b", "002", 0, 4, "2026-08-17T11:00:00.000Z");
    listNotesMock
      .mockResolvedValueOnce([
        queuedNote("note-a", "001", 0, 10, "2026-08-17T10:00:00.000Z"),
        remaining,
      ])
      .mockResolvedValue([remaining]);
    const { user } = await renderScreen();
    expect(await screen.findByText("Nota 001")).toBeInTheDocument();

    const cardA = screen.getByText("Nota 001").closest("li") as HTMLElement;
    await user.click(within(cardA).getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Excluir nota" }));

    expect(deleteNoteMock).toHaveBeenCalledWith("note-a");
    await waitFor(() => expect(listNotesMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Nota 001")).not.toBeInTheDocument());
    expect(screen.getByText("Nota 002")).toBeInTheDocument();
  });

  it("UT-043: excluir a única nota aberta deixa o estado vazio na tela", async () => {
    listNotesMock
      .mockResolvedValueOnce([queuedNote("note-a", "001", 0, 10, "2026-08-17T10:00:00.000Z")])
      .mockResolvedValue([]);
    const { user } = await renderScreen();
    expect(await screen.findByText("Nota 001")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Excluir nota" }));

    expect(
      await screen.findByText("Nenhuma nota em conferência no momento."),
    ).toBeInTheDocument();
    expect(quickScanButton()).toBeDisabled();
  });

  it("UT-042b: nota excluída some da fila mesmo se o recarregamento falhar", async () => {
    const remaining = queuedNote("note-b", "002", 0, 4, "2026-08-17T11:00:00.000Z");
    listNotesMock
      .mockResolvedValueOnce([
        queuedNote("note-a", "001", 0, 10, "2026-08-17T10:00:00.000Z"),
        remaining,
      ])
      .mockRejectedValue(new Error("offline"));
    const { user } = await renderScreen();
    expect(await screen.findByText("Nota 001")).toBeInTheDocument();

    const cardA = screen.getByText("Nota 001").closest("li") as HTMLElement;
    await user.click(within(cardA).getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Excluir nota" }));

    expect(deleteNoteMock).toHaveBeenCalledWith("note-a");
    await waitFor(() =>
      expect(screen.getByText("Não foi possível atualizar a fila agora.")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Nota 001")).not.toBeInTheDocument();
    expect(screen.getByText("Nota 002")).toBeInTheDocument();
  });

  it("UT-044: nota 100% bipada mas ainda aberta continua sendo alvo do atalho", async () => {
    listNotesMock.mockResolvedValue([
      queuedNote("note-cheia", "001", 10, 10, "2026-08-17T10:00:00.000Z"),
    ]);
    const { user, onOpenNote } = await renderScreen();

    await user.click(quickScanButton());

    expect(onOpenNote).toHaveBeenCalledWith("note-cheia");
  });
});
