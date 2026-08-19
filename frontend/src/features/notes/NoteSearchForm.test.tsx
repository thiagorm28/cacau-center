import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, createNote } from "../../api/client";
import { NoteSearchForm } from "./NoteSearchForm";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return { ...actual, createNote: vi.fn() };
});

const createNoteMock = vi.mocked(createNote);

const renderForm = (isOnline = true) => {
  const onNoteCreated = vi.fn();
  render(<NoteSearchForm isOnline={isOnline} onNoteCreated={onNoteCreated} />);
  return { onNoteCreated, user: userEvent.setup() };
};

const typeAndSubmit = async (
  user: ReturnType<typeof userEvent.setup>,
  value: string,
): Promise<void> => {
  if (value !== "") await user.type(screen.getByLabelText("Número de faturamento"), value);
  await user.click(screen.getByRole("button", { name: "Buscar nota" }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NoteSearchForm", () => {
  it("UT-053: submete um número válido e exibe a lista de itens retornada", async () => {
    createNoteMock.mockResolvedValue({
      noteId: "note-1",
      status: "open",
      items: [
        { itemId: "item-1", description: "Panetone Trufado 400g", expectedQty: 10, confirmedQty: 0 },
      ],
    });
    const { user, onNoteCreated } = renderForm();

    await typeAndSubmit(user, "004005647");

    expect(createNoteMock).toHaveBeenCalledWith("004005647");
    expect(await screen.findByText("Panetone Trufado 400g")).toBeInTheDocument();
    expect(screen.getByText("0/10")).toBeInTheDocument();
    expect(onNoteCreated).toHaveBeenCalledTimes(1);
  });

  it("UT-054: mostra 'nota não encontrada' na resposta 404", async () => {
    createNoteMock.mockRejectedValue(new ApiError(404, "Nota não encontrada"));
    const { user } = renderForm();

    await typeAndSubmit(user, "004005647");

    expect(await screen.findByText(/nota não encontrada/i)).toBeInTheDocument();
  });

  it("UT-055: mostra 'serviço indisponível' na resposta 502", async () => {
    createNoteMock.mockRejectedValue(new ApiError(502, "API indisponível"));
    const { user } = renderForm();

    await typeAndSubmit(user, "004005647");

    expect(await screen.findByText(/serviço indisponível/i)).toBeInTheDocument();
  });

  it("UT-056: rejeita entrada vazia ou não numérica antes de chamar a API", async () => {
    const { user } = renderForm();

    await typeAndSubmit(user, "");
    expect(await screen.findByText(/informe o número de faturamento/i)).toBeInTheDocument();

    await typeAndSubmit(user, "40a56");
    expect(await screen.findByText(/use apenas dígitos/i)).toBeInTheDocument();
    await waitFor(() => expect(createNoteMock).not.toHaveBeenCalled());
  });

  it("UT-057: offline, informa que a busca de nota nova exige conexão", async () => {
    const { user } = renderForm(false);

    await typeAndSubmit(user, "004005647");

    expect(await screen.findByText(/é preciso estar conectado/i)).toBeInTheDocument();
    expect(createNoteMock).not.toHaveBeenCalled();
  });
});
