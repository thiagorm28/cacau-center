import { render, screen, waitFor } from "@testing-library/react";
import { type IDBPDatabase, openDB } from "idb";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetworkError, listNotes } from "../api/client";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { readOpenNotes, saveOpenNotes } from "../offline/noteSnapshotStore";
import { buildItem, buildNote } from "../test/fixtures";
import { ScanRoute } from "./ScanRoute";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, listNotes: vi.fn(), sendScanEvent: vi.fn() };
});

// A câmera é a borda de I/O da tela: aqui só interessa o que a rota consegue montar.
vi.mock("../hooks/useBarcodeScanner", () => ({ useBarcodeScanner: vi.fn() }));

const listNotesMock = vi.mocked(listNotes);
const scannerMock = vi.mocked(useBarcodeScanner);

/** O retrato vive num banco próprio; o teste fala com ele direto para preparar o estado. */
const withSnapshotStore = async (
  run: (store: IDBPDatabase) => Promise<void>,
): Promise<void> => {
  const database = await openDB("cacau-center-notes", 1, {
    upgrade: (db) => {
      db.createObjectStore("open-notes");
    },
  });
  await run(database);
  database.close();
};

const clearOpenNotes = (): Promise<void> =>
  withSnapshotStore((database) => database.clear("open-notes"));

const writeRawSnapshot = (value: unknown): Promise<void> =>
  withSnapshotStore(async (database) => {
    await database.put("open-notes", value, "snapshot");
  });

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={["/notas/note-1/bipagem"]}>
      <Routes>
        <Route path="/notas/:noteId/bipagem" element={<ScanRoute />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(async () => {
  vi.clearAllMocks();
  await clearOpenNotes();
  scannerMock.mockReturnValue({ videoRef: { current: null }, error: null, isScanning: true });
});

describe("ScanRoute", () => {
  it("US-013.EC-1: guarda o retrato das notas abertas a cada carga bem-sucedida", async () => {
    const note = buildNote({ items: [buildItem({ expectedQty: 3 })] });
    listNotesMock.mockResolvedValue([note]);

    renderRoute();

    expect(await screen.findByText("Nota 004005647")).toBeInTheDocument();
    await waitFor(async () => expect(await readOpenNotes()).toEqual([note]));
  });

  it("US-013.EC-1: sem rede, reabre a bipagem pelo retrato local em vez da tela de erro", async () => {
    const note = buildNote({
      items: [buildItem({ expectedQty: 3, confirmedQty: 2, missingQty: 1 })],
    });
    await saveOpenNotes([note]);
    listNotesMock.mockRejectedValue(new NetworkError());

    renderRoute();

    expect(await screen.findByText("Nota 004005647")).toBeInTheDocument();
    expect(screen.getByLabelText("Panetone Trufado 400g: caixas confirmadas")).toHaveTextContent(
      "2/3",
    );
    expect(
      screen.queryByText("Não foi possível carregar as notas em conferência."),
    ).not.toBeInTheDocument();
  });

  it("sem rede e sem retrato local, ainda avisa que a carga falhou", async () => {
    listNotesMock.mockRejectedValue(new NetworkError());

    renderRoute();

    expect(
      await screen.findByText("Não foi possível carregar as notas em conferência."),
    ).toBeInTheDocument();
  });

  it("ignora retrato local fora do formato esperado e cai na mensagem de erro", async () => {
    await writeRawSnapshot([{ noteId: "note-1" }]);
    listNotesMock.mockRejectedValue(new NetworkError());

    renderRoute();

    expect(
      await screen.findByText("Não foi possível carregar as notas em conferência."),
    ).toBeInTheDocument();
  });
});
