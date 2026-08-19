import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, NetworkError, finalizeNote, sendScanEvent, syncScanEvents } from "../api/client";
import { readQueue, removeActions } from "../offline/queueStore";
import { useOfflineQueue } from "./useOfflineQueue";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, syncScanEvents: vi.fn(), sendScanEvent: vi.fn(), finalizeNote: vi.fn() };
});

const syncMock = vi.mocked(syncScanEvents);
const sendMock = vi.mocked(sendScanEvent);
const finalizeMock = vi.mocked(finalizeNote);

let online = true;

const setOnline = (value: boolean): void => {
  online = value;
  window.dispatchEvent(new Event(value ? "online" : "offline"));
};

const scan = (clientEventId: string) => ({
  kind: "scan" as const,
  clientEventId,
  scannedCode: "7891234567895",
  scannedAt: "2026-08-17T10:00:00.000Z",
});

const resetDatabase = async (): Promise<void> => {
  const entries = await readQueue();
  await removeActions(entries.map((entry) => entry.key));
};

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDatabase();
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  online = false;
  syncMock.mockResolvedValue({ applied: 1, duplicates: 0 });
  sendMock.mockResolvedValue({ resolution: { kind: "unidentified" } });
  finalizeMock.mockResolvedValue({
    status: "closed_incomplete",
    report: {
      noteId: "note-1",
      invoiceNumber: "004005647",
      supplierName: "Cacau Show",
      status: "closed_incomplete",
      closedAt: null,
      isComplete: false,
      items: [],
      missingItems: [],
      exceededScans: [],
      unidentifiedScans: [],
    },
  });
});

describe("useOfflineQueue", () => {
  it("UT-048: sem conexão, enfileira a bipagem localmente", async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await act(async () => {
      await result.current.enqueue(scan("11111111-1111-4111-8111-111111111111"));
    });

    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    const stored = await readQueue();
    expect(stored.map((entry) => entry.action)).toEqual([
      scan("11111111-1111-4111-8111-111111111111"),
    ]);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("UT-049: ao reconectar, drena a fila para POST /scan-events/sync automaticamente", async () => {
    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => {
      await result.current.enqueue(scan("22222222-2222-4222-8222-222222222222"));
    });

    await act(async () => {
      setOnline(true);
    });

    await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(1));
    expect(syncMock).toHaveBeenCalledWith([
      {
        clientEventId: "22222222-2222-4222-8222-222222222222",
        scannedCode: "7891234567895",
        scannedAt: "2026-08-17T10:00:00.000Z",
      },
    ]);
    await waitFor(() => expect(result.current.pending).toHaveLength(0));
  });

  it("UT-050: reenvio após falha de rede mantém o mesmo clientEventId, sem duplicar eventos", async () => {
    syncMock.mockRejectedValueOnce(new NetworkError());
    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => {
      await result.current.enqueue(scan("33333333-3333-4333-8333-333333333333"));
    });

    await act(async () => {
      setOnline(true);
    });
    await waitFor(() => expect(syncMock).toHaveBeenCalledTimes(1));
    expect(result.current.pending).toHaveLength(1);

    await act(async () => {
      await result.current.flush();
    });

    expect(syncMock).toHaveBeenCalledTimes(2);
    const sentIds = syncMock.mock.calls.flatMap(([events]) =>
      events.map((event) => event.clientEventId),
    );
    expect(sentIds).toEqual([
      "33333333-3333-4333-8333-333333333333",
      "33333333-3333-4333-8333-333333333333",
    ]);
    await waitFor(() => expect(result.current.pending).toHaveLength(0));
  });

  it("UT-051: eventos enfileirados offline continuam presentes após recarregar o app", async () => {
    const first = renderHook(() => useOfflineQueue());
    await act(async () => {
      await first.result.current.enqueue(scan("44444444-4444-4444-8444-444444444444"));
    });
    first.unmount();

    const reloaded = renderHook(() => useOfflineQueue());

    await waitFor(() => expect(reloaded.result.current.pending).toHaveLength(1));
    expect(reloaded.result.current.pending[0]).toEqual(
      scan("44444444-4444-4444-8444-444444444444"),
    );
  });

  it("UT-052: finalização incompleta feita offline entra no flush seguinte", async () => {
    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => {
      await result.current.enqueue({
        kind: "finalize",
        clientEventId: "55555555-5555-4555-8555-555555555555",
        noteId: "note-1",
        confirmIncomplete: true,
      });
    });
    expect(finalizeMock).not.toHaveBeenCalled();

    await act(async () => {
      setOnline(true);
    });

    await waitFor(() => expect(finalizeMock).toHaveBeenCalledWith("note-1", true));
    await waitFor(() => expect(result.current.pending).toHaveLength(0));
  });

  it("recusa definitiva da finalização tira a ação da fila e avisa o operador", async () => {
    finalizeMock.mockRejectedValueOnce(new ApiError(422, "nenhuma conferência ativa"));
    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => {
      await result.current.enqueue({
        kind: "finalize",
        clientEventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        noteId: "note-1",
        confirmIncomplete: true,
      });
    });

    await act(async () => {
      await result.current.flush();
    });

    // Sai da fila para não travar as ações seguintes, mas não some sem aviso.
    await waitFor(() => expect(result.current.pending).toHaveLength(0));
    expect(result.current.discarded).toEqual([
      { kind: "finalize", noteId: "note-1", reason: "nenhuma conferência ativa" },
    ]);
  });

  it("erro retentável na finalização mantém a ação na fila, sem descartá-la", async () => {
    finalizeMock.mockRejectedValue(new NetworkError());
    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => {
      await result.current.enqueue({
        kind: "finalize",
        clientEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        noteId: "note-1",
        confirmIncomplete: true,
      });
    });

    await act(async () => {
      expect(await result.current.flush()).toBe(false);
    });

    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    expect(result.current.discarded).toEqual([]);
  });

  it("recusa definitiva no meio do lote descarta só a bipagem recusada, não o lote inteiro", async () => {
    // O backend aplica uma transação por evento: a segunda bipagem é recusada, mas a
    // primeira já foi gravada e a terceira sequer chegou a ser tentada.
    syncMock.mockRejectedValueOnce(new ApiError(422, "nenhuma conferência ativa"));
    sendMock
      .mockResolvedValueOnce({ resolution: { kind: "unidentified" } })
      .mockRejectedValueOnce(new ApiError(422, "nenhuma conferência ativa"))
      .mockResolvedValueOnce({ resolution: { kind: "unidentified" } });
    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => {
      await result.current.enqueue(scan("66666666-6666-4666-8666-666666666666"));
      await result.current.enqueue(scan("77777777-7777-4777-8777-777777777777"));
      await result.current.enqueue(scan("88888888-8888-4888-8888-888888888888"));
    });

    await act(async () => {
      setOnline(true);
    });

    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(3));
    expect(sendMock.mock.calls.map(([payload]) => payload.clientEventId)).toEqual([
      "66666666-6666-4666-8666-666666666666",
      "77777777-7777-4777-8777-777777777777",
      "88888888-8888-4888-8888-888888888888",
    ]);
    await waitFor(() => expect(result.current.pending).toHaveLength(0));
    expect(result.current.discarded).toEqual([
      {
        kind: "scan",
        clientEventId: "77777777-7777-4777-8777-777777777777",
        scannedCode: "7891234567895",
        reason: "nenhuma conferência ativa",
      },
    ]);
  });

  it("erro retentável durante o reenvio individual mantém na fila o que ainda não foi aplicado", async () => {
    syncMock.mockRejectedValueOnce(new ApiError(422, "nenhuma conferência ativa"));
    sendMock
      .mockResolvedValueOnce({ resolution: { kind: "unidentified" } })
      .mockRejectedValue(new NetworkError());
    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => {
      await result.current.enqueue(scan("99999999-9999-4999-8999-999999999999"));
      await result.current.enqueue(scan("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    });

    await act(async () => {
      await result.current.flush();
    });

    expect(sendMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    expect(result.current.pending[0]).toEqual(scan("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
    expect(result.current.discarded).toEqual([]);
  });

  it("o operador confirma o aviso e a lista de bipagens descartadas é limpa", async () => {
    syncMock.mockRejectedValueOnce(new ApiError(422, "nenhuma conferência ativa"));
    sendMock.mockRejectedValueOnce(new ApiError(422, "nenhuma conferência ativa"));
    const { result } = renderHook(() => useOfflineQueue());
    await act(async () => {
      await result.current.enqueue(scan("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
    });

    await act(async () => {
      await result.current.flush();
    });
    await waitFor(() => expect(result.current.discarded).toHaveLength(1));

    act(() => {
      result.current.acknowledgeDiscarded();
    });

    expect(result.current.discarded).toEqual([]);
  });
});
