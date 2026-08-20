import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, finalizeNote, sendScanEvent, syncScanEvents } from "../../api/client";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import { readOpenNotes } from "../../offline/noteSnapshotStore";
import { readQueue, removeActions } from "../../offline/queueStore";
import { buildItem, buildNote } from "../../test/fixtures";
import { withSession } from "../../test/session";
import { ScanScreen } from "./ScanScreen";

vi.mock("../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/client")>();
  return { ...actual, sendScanEvent: vi.fn(), syncScanEvents: vi.fn(), finalizeNote: vi.fn() };
});

// A câmera é a borda de I/O do hook: o teste injeta a leitura no lugar dela.
vi.mock("../../hooks/useBarcodeScanner", () => ({ useBarcodeScanner: vi.fn() }));

const sendScanEventMock = vi.mocked(sendScanEvent);
const syncScanEventsMock = vi.mocked(syncScanEvents);
const finalizeNoteMock = vi.mocked(finalizeNote);
const scannerMock = vi.mocked(useBarcodeScanner);

let emitScan: (code: string) => void = () => undefined;

const renderScan = (notes: Parameters<typeof ScanScreen>[0]["notes"]) => {
  const onFinalized = vi.fn();
  render(withSession(<ScanScreen notes={notes} activeNoteId="note-1" onFinalized={onFinalized} />));
  return { onFinalized, user: userEvent.setup() };
};

beforeEach(async () => {
  vi.clearAllMocks();
  await removeActions((await readQueue()).map((entry) => entry.key));
  scannerMock.mockImplementation(({ onScan }) => {
    emitScan = onScan;
    return { videoRef: { current: null }, error: null, isScanning: true };
  });
  sendScanEventMock.mockResolvedValue({
    resolution: { kind: "matched", noteId: "note-1", itemId: "item-1" },
  });
  syncScanEventsMock.mockResolvedValue({ applied: 1, duplicates: 0 });
});

describe("ScanScreen", () => {
  it("UT-058: atualiza o contador de progresso do item a cada bipagem", async () => {
    const note = buildNote({ items: [buildItem({ expectedQty: 3 })] });
    renderScan([note]);
    expect(screen.getByLabelText("Panetone Trufado 400g: caixas confirmadas")).toHaveTextContent(
      "0/3",
    );

    act(() => emitScan("1001"));

    await waitFor(() =>
      expect(screen.getByLabelText("Panetone Trufado 400g: caixas confirmadas")).toHaveTextContent(
        "1/3",
      ),
    );
    expect(screen.getByText(/Confirmado: Panetone Trufado 400g/)).toBeInTheDocument();
  });

  it("UT-059: mostra 'quantidade já atingida' sem incrementar o contador", async () => {
    const note = buildNote({
      items: [buildItem({ expectedQty: 2, confirmedQty: 2, missingQty: 0 })],
    });
    renderScan([note]);

    act(() => emitScan("1001"));

    expect(await screen.findByText(/Quantidade já atingida/)).toBeInTheDocument();
    expect(screen.getByLabelText("Panetone Trufado 400g: caixas confirmadas")).toHaveTextContent(
      "2/2",
    );
  });

  it("UT-060: oferece seleção manual de item quando o resultado é não identificado", async () => {
    const note = buildNote({ items: [buildItem({ expectedQty: 3 })] });
    renderScan([note]);

    act(() => emitScan("codigo-desconhecido"));

    const dialog = await screen.findByRole("dialog", { name: "Código não reconhecido" });
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Panetone Trufado 400g/ }),
    ).toBeInTheDocument();
  });

  it("UT-061: cancelar a seleção manual mantém o item pendente e não envia evento", async () => {
    const note = buildNote({ items: [buildItem({ expectedQty: 3 })] });
    const { user } = renderScan([note]);
    act(() => emitScan("codigo-desconhecido"));
    await screen.findByRole("dialog", { name: "Código não reconhecido" });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Panetone Trufado 400g: caixas confirmadas")).toHaveTextContent(
      "0/3",
    );
    expect(sendScanEventMock).not.toHaveBeenCalled();
  });

  it("offline: a bipagem dá feedback imediato e o evento fica na fila local", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    const note = buildNote({ items: [buildItem({ expectedQty: 3 })] });
    renderScan([note]);

    act(() => emitScan("1001"));

    await waitFor(() =>
      expect(screen.getByLabelText("Panetone Trufado 400g: caixas confirmadas")).toHaveTextContent(
        "1/3",
      ),
    );
    expect(sendScanEventMock).not.toHaveBeenCalled();
    await waitFor(async () =>
      expect(
        (await readQueue()).map((entry) =>
          entry.action.kind === "scan" ? entry.action.scannedCode : entry.action.kind,
        ),
      ).toEqual(["1001"]),
    );
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  });

  it("US-013.EC-1: o retrato local guarda o progresso da bipagem, não a resposta do servidor", async () => {
    const note = buildNote({ items: [buildItem({ expectedQty: 3 })] });
    renderScan([note]);

    act(() => emitScan("1001"));

    // É este retrato que a `ScanRoute` reabre quando o app é recarregado sem rede: se
    // ele ficasse no 0/3 vindo do `GET /notes`, a caixa já bipada voltaria a aparecer
    // como pendente.
    await waitFor(async () => {
      const snapshot = await readOpenNotes();
      expect(snapshot?.[0]?.items[0]).toMatchObject({ confirmedQty: 1, missingQty: 2 });
      expect(snapshot?.[0]?.confirmedTotal).toBe(1);
    });
  });

  it("US-010.AC-1: a última bipagem exibe a confirmação de nota completa sem nenhum clique", async () => {
    const note = buildNote({
      items: [buildItem({ expectedQty: 2, confirmedQty: 1, missingQty: 1 })],
    });
    renderScan([note]);
    expect(screen.queryByText(/Nota completa!/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalizar conferência" })).toBeInTheDocument();

    act(() => emitScan("1001"));

    // O resumo vem junto da confirmação: caixas conferidas sobre o total e itens da nota.
    expect(
      await screen.findByText("Nota completa! 2 de 2 caixas conferidas em 1 item."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver relatório da nota" })).toBeInTheDocument();
    expect(finalizeNoteMock).not.toHaveBeenCalled();
  });

  it("US-010.AC-1: a nota que ainda tem item pendente não anuncia conclusão", async () => {
    const note = buildNote({
      items: [
        buildItem({ expectedQty: 1 }),
        buildItem({ itemId: "item-2", cProd: "1002", cEan: null, description: "Trufa Sortida", expectedQty: 1 }),
      ],
    });
    renderScan([note]);

    act(() => emitScan("1001"));

    await waitFor(() =>
      expect(screen.getByLabelText("Panetone Trufado 400g: caixas confirmadas")).toHaveTextContent(
        "1/1",
      ),
    );
    expect(screen.queryByText(/Nota completa!/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalizar conferência" })).toBeInTheDocument();
  });

  it("UT-062: cancelar a confirmação de finalização mantém a nota aberta, sem chamada à API", async () => {
    const note = buildNote({ items: [buildItem({ expectedQty: 3, confirmedQty: 1, missingQty: 2 })] });
    const { user, onFinalized } = renderScan([note]);

    await user.click(screen.getByRole("button", { name: "Finalizar conferência" }));
    expect(await screen.findByRole("dialog", { name: "Finalizar mesmo assim?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(finalizeNoteMock).not.toHaveBeenCalled();
    expect(onFinalized).not.toHaveBeenCalled();
  });

  it("erro do servidor no envio online preserva a bipagem na fila em vez de descartá-la", async () => {
    // 5xx é falha temporária: a tela já contou a caixa, então o evento tem de sobreviver
    // para a próxima tentativa — descartá-lo deixaria a nota curta no servidor sem aviso.
    sendScanEventMock.mockRejectedValue(new ApiError(503, "Service Unavailable"));
    syncScanEventsMock.mockRejectedValue(new ApiError(503, "Service Unavailable"));
    const note = buildNote({ items: [buildItem({ expectedQty: 3 })] });
    renderScan([note]);

    act(() => emitScan("1001"));

    await waitFor(() => expect(sendScanEventMock).toHaveBeenCalled());
    await waitFor(async () =>
      expect(
        (await readQueue()).map((entry) =>
          entry.action.kind === "scan" ? entry.action.scannedCode : entry.action.kind,
        ),
      ).toEqual(["1001"]),
    );
  });

  it("bipagem feita com rede entra na fila enquanto o lote antigo ainda está sendo enviado", async () => {
    // A bipagem ambígua é alocada pela ordem em que o servidor a aplica (ADR-001, US-009):
    // deixar a caixa nova ir direto para `POST /scan-events` durante o flush criaria duas
    // requisições concorrentes e a mais nova poderia ser aplicada primeiro, creditando a
    // caixa na nota errada. Enquanto a fila não esvazia, tudo passa por ela.
    sendScanEventMock.mockRejectedValueOnce(new ApiError(503, "Service Unavailable"));
    let releaseSync: () => void = () => undefined;
    syncScanEventsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSync = () => resolve({ applied: 1, duplicates: 0 });
        }),
    );
    // Códigos exclusivos deste teste: a espera pelo flush precisa reconhecer o lote desta
    // tela, e não uma sincronização atrasada de outro caso.
    const note = buildNote({
      items: [
        buildItem({ cProd: "2001", cEan: null, expectedQty: 1 }),
        buildItem({
          itemId: "item-2",
          cProd: "2002",
          cEan: null,
          description: "Trufa Sortida",
          expectedQty: 1,
        }),
      ],
    });
    renderScan([note]);

    // A primeira bipagem falha com 5xx e cai na fila, que dispara o flush — travado aqui
    // no `syncScanEvents` para manter a janela do lote em trânsito aberta.
    act(() => emitScan("2001"));
    await waitFor(() =>
      expect(syncScanEventsMock).toHaveBeenCalledWith([
        expect.objectContaining({ scannedCode: "2001" }),
      ]),
    );

    // Segunda bipagem: a rede está de pé, mas o lote anterior ainda está em trânsito.
    act(() => emitScan("2002"));

    await waitFor(async () =>
      expect(
        (await readQueue()).map((entry) =>
          entry.action.kind === "scan" ? entry.action.scannedCode : entry.action.kind,
        ),
      ).toEqual(["2001", "2002"]),
    );
    // A caixa nova entrou atrás do lote em vez de correr por fora dele.
    expect(sendScanEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ scannedCode: "2002" }),
    );

    await act(async () => {
      releaseSync();
    });
  });

  it("recusa definitiva do servidor avisa o operador em vez de falhar em silêncio", async () => {
    // 4xx de regra de negócio não adianta retentar; o que não pode acontecer é a caixa
    // seguir contada na tela sem ninguém saber que o servidor nunca a registrou.
    sendScanEventMock.mockRejectedValue(new ApiError(422, "Item já conferido"));
    syncScanEventsMock.mockRejectedValue(new ApiError(422, "Item já conferido"));
    const note = buildNote({ items: [buildItem({ expectedQty: 3 })] });
    renderScan([note]);

    act(() => emitScan("1001"));

    expect(await screen.findByText(/O servidor recusou 1 bipagem/)).toHaveTextContent("1001");
    await waitFor(async () => expect(await readQueue()).toEqual([]));
  });
});
