import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, NetworkError, finalizeNote, sendScanEvent, syncScanEvents } from "../api/client";
import type { ScanEventPayload } from "../api/types";
import {
  type QueuedAction,
  type QueuedEntry,
  enqueueAction,
  readQueue,
  removeActions,
} from "../offline/queueStore";
import { useOnlineStatus } from "./useOnlineStatus";

/** Bipagem que o servidor recusou em definitivo e que saiu da fila sem ser aplicada. */
export interface DiscardedScan {
  kind: "scan";
  clientEventId: string;
  scannedCode: string;
  reason: string;
}

/**
 * Finalização recusada em definitivo. Sem esse aviso a nota fica `open` no servidor
 * para sempre, enquanto o operador já saiu da tela achando que fechou a conferência.
 */
export interface DiscardedFinalize {
  kind: "finalize";
  noteId: string;
  reason: string;
}

/** Ação que saiu da fila sem ser aplicada e precisa ser mostrada ao operador. */
export type DiscardedAction = DiscardedScan | DiscardedFinalize;

interface UseOfflineQueueResult {
  pending: readonly QueuedAction[];
  isOnline: boolean;
  isFlushing: boolean;
  /** Ações descartadas na sincronização; só somem quando o operador confirma que viu. */
  discarded: readonly DiscardedAction[];
  acknowledgeDiscarded: () => void;
  enqueue: (action: QueuedAction) => Promise<void>;
  /** Resolve `true` quando a fila terminou vazia. */
  flush: () => Promise<boolean>;
}

/** Espera entre tentativas quando a rede volta a falhar no meio do flush. */
const RETRY_DELAY_MS = 5000;

const toScanPayload = (entry: QueuedEntry): ScanEventPayload | null => {
  if (entry.action.kind !== "scan") return null;
  const { clientEventId, scannedCode, scannedAt, manualItemId, markUnidentified } = entry.action;
  return {
    clientEventId,
    scannedCode,
    scannedAt,
    ...(manualItemId === undefined ? {} : { manualItemId }),
    ...(markUnidentified === undefined ? {} : { markUnidentified }),
  };
};

/**
 * Uma ação só permanece na fila quando faz sentido tentar de novo: queda de rede,
 * sessão expirada (ADR-009) ou erro do servidor. Recusa de regra de negócio é
 * definitiva — mantê-la na fila travaria todas as ações seguintes.
 */
const isRetryable = (error: unknown): boolean =>
  error instanceof NetworkError ||
  (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status >= 500));

const describeError = (error: unknown): string =>
  error instanceof Error && error.message !== "" ? error.message : "Erro desconhecido";

type ScanReplay = { discarded: readonly DiscardedScan[]; halted: boolean };

/**
 * Reenvia o lote bipagem por bipagem quando a sincronização em bloco é recusada.
 * `POST /scan-events/sync` roda uma transação por evento, não uma pelo lote inteiro: uma
 * recusa no meio deixa os eventos anteriores já gravados e os seguintes sequer tentados,
 * enquanto a chamada HTTP falha por inteiro. Só o reenvio individual — idempotente pelo
 * `clientEventId` (ADR-010), então reenviar o que já foi aplicado não duplica nada — diz
 * quais eventos o servidor realmente recusou. Para no primeiro erro retentável, deixando o
 * restante na fila, na ordem de bipagem.
 */
const replayScans = async (scans: readonly QueuedEntry[]): Promise<ScanReplay> => {
  const discarded: DiscardedScan[] = [];
  for (const entry of scans) {
    const payload = toScanPayload(entry);
    if (payload === null) continue;
    try {
      await sendScanEvent(payload);
    } catch (error) {
      if (isRetryable(error)) return { discarded, halted: true };
      discarded.push({
        kind: "scan",
        clientEventId: payload.clientEventId,
        scannedCode: payload.scannedCode,
        reason: describeError(error),
      });
    }
    await removeActions([entry.key]);
  }
  return { discarded, halted: false };
};

/**
 * Fila local de ações feitas offline (ADR-003, ADR-007), persistida em IndexedDB e
 * drenada automaticamente ao reconectar. Cada ação carrega um `clientEventId` gerado
 * no cliente, então reenviar um lote já aplicado é idempotente no backend (ADR-010).
 */
export function useOfflineQueue(): UseOfflineQueueResult {
  const isOnline = useOnlineStatus();
  const [pending, setPending] = useState<readonly QueuedAction[]>([]);
  const [isFlushing, setIsFlushing] = useState(false);
  const [discarded, setDiscarded] = useState<readonly DiscardedAction[]>([]);
  const [retryToken, setRetryToken] = useState(0);
  const flushing = useRef(false);

  const refresh = useCallback(async () => {
    const entries = await readQueue();
    setPending(entries.map((entry) => entry.action));
  }, []);

  // Recarrega a fila persistida: o progresso offline sobrevive ao fechamento do app.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const acknowledgeDiscarded = useCallback(() => setDiscarded([]), []);

  const enqueue = useCallback(
    async (action: QueuedAction) => {
      await enqueueAction(action);
      await refresh();
    },
    [refresh],
  );

  const flush = useCallback(async (): Promise<boolean> => {
    if (flushing.current) return false;
    flushing.current = true;
    setIsFlushing(true);
    try {
      const entries = await readQueue();
      const scans = entries.filter((entry) => entry.action.kind === "scan");
      const payloads = scans.flatMap((entry) => {
        const payload = toScanPayload(entry);
        return payload === null ? [] : [payload];
      });
      if (payloads.length > 0) {
        try {
          await syncScanEvents(payloads);
          await removeActions(scans.map((entry) => entry.key));
        } catch (error) {
          if (isRetryable(error)) return false;
          const replay = await replayScans(scans);
          if (replay.discarded.length > 0) {
            setDiscarded((current) => [...current, ...replay.discarded]);
          }
          if (replay.halted) return false;
        }
      }
      // Finalizações vão depois das bipagens: o relatório precisa contar tudo o
      // que foi bipado offline antes do fechamento da nota.
      for (const entry of entries) {
        if (entry.action.kind !== "finalize") continue;
        const { noteId, confirmIncomplete } = entry.action;
        try {
          await finalizeNote(noteId, confirmIncomplete);
        } catch (error) {
          if (isRetryable(error)) return false;
          // Recusa definitiva: a ação sai da fila para não travar as seguintes, mas o
          // operador precisa saber que a nota continua aberta (rastreabilidade).
          const discard: DiscardedFinalize = { kind: "finalize", noteId, reason: describeError(error) };
          setDiscarded((current) => [...current, discard]);
        }
        await removeActions([entry.key]);
      }
      return true;
    } finally {
      flushing.current = false;
      setIsFlushing(false);
      await refresh();
    }
  }, [refresh]);

  // Reconectou com fila pendente → sincroniza sozinho, sem ação do operador (US-014).
  // A nova tentativa é agendada por tempo, nunca disparada pelo próprio resultado do
  // flush: reagir à atualização do estado da fila viraria um laço de retentativas.
  useEffect(() => {
    if (!isOnline || pending.length === 0) return;
    let retry: ReturnType<typeof setTimeout> | null = null;
    void flush().then((drained) => {
      if (drained) return;
      retry = setTimeout(() => setRetryToken((token) => token + 1), RETRY_DELAY_MS);
    });
    return () => {
      if (retry !== null) clearTimeout(retry);
    };
  }, [isOnline, pending.length, retryToken, flush]);

  return { pending, isOnline, isFlushing, discarded, acknowledgeDiscarded, enqueue, flush };
}
