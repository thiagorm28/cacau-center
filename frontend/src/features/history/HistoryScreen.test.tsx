import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listHistory } from "../../api/client";
import { buildHistoryEntry } from "../../test/fixtures";
import { HistoryScreen } from "./HistoryScreen";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return { ...actual, listHistory: vi.fn() };
});

const listHistoryMock = vi.mocked(listHistory);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HistoryScreen", () => {
  it("UT-066: lista notas finalizadas com status e quem conferiu", async () => {
    listHistoryMock.mockResolvedValue([
      buildHistoryEntry({ status: "closed_incomplete", closedByName: "Marina Souza" }),
      buildHistoryEntry({
        noteId: "note-2",
        invoiceNumber: "004005648",
        status: "completed",
        closedByName: "João Lima",
      }),
    ]);

    render(<HistoryScreen onOpenReport={vi.fn()} />);

    expect(await screen.findByText("Nota 004005647")).toBeInTheDocument();
    expect(screen.getByText("Com divergência")).toBeInTheDocument();
    expect(screen.getByText(/conferida por Marina Souza/)).toBeInTheDocument();
    expect(screen.getByText("Nota 004005648")).toBeInTheDocument();
    expect(screen.getByText("Completa")).toBeInTheDocument();
    expect(screen.getByText(/conferida por João Lima/)).toBeInTheDocument();
  });

  it("UT-067: mostra estado vazio quando não há notas finalizadas", async () => {
    listHistoryMock.mockResolvedValue([]);

    render(<HistoryScreen onOpenReport={vi.fn()} />);

    expect(await screen.findByText("Nenhuma conferência finalizada ainda.")).toBeInTheDocument();
  });
});
