import { useCallback, useEffect, useMemo, useState } from "react";
import { type PendingNote, resolveScan } from "shared";
import { sendScanEvent } from "../../api/client";
import type { NoteItemView, NoteView, ScanEventPayload } from "../../api/types";
import { saveOpenNotes } from "../../offline/noteSnapshotStore";
import type { QueuedScan } from "../../offline/queueStore";

export interface ScanFeedback {
  kind: "matched" | "exceeded" | "unidentified";
  description: string;
}

export interface PendingCandidate {
  noteId: string;
  invoiceNumber: string;
  item: NoteItemView;
}

interface UseScanSessionOptions {
  initialNotes: readonly NoteView[];
  isOnline: boolean;
  /** Fila local ainda com ações a enviar — inclusive as que já estão sendo drenadas. */
  hasPendingQueue: boolean;
  enqueue: (action: QueuedScan) => Promise<void>;
}

const toPendingNote = (note: NoteView): PendingNote => ({
  noteId: note.noteId,
  openedAt: note.openedAt,
  items: note.items.map((item) => ({
    itemId: item.itemId,
    cProd: item.cProd,
    cEan: item.cEan,
    expectedQty: item.expectedQty,
    confirmedQty: item.confirmedQty,
  })),
});

const withConfirmedItem = (note: NoteView, itemId: string): NoteView => {
  const items = note.items.map((item) =>
    item.itemId === itemId
      ? {
          ...item,
          confirmedQty: item.confirmedQty + 1,
          missingQty: Math.max(0, item.missingQty - 1),
        }
      : item,
  );
  const isComplete = items.every((item) => item.confirmedQty >= item.expectedQty);
  return {
    ...note,
    items,
    confirmedTotal: note.confirmedTotal + 1,
    status: isComplete ? "completed" : note.status,
  };
};

const findItem = (notes: readonly NoteView[], itemId: string): NoteItemView | undefined =>
  notes.flatMap((note) => note.items).find((item) => item.itemId === itemId);

/**
 * Estado vivo da bipagem. Toda leitura passa por `resolveScan` do pacote `shared`
 * (ADR-006): o feedback aparece na hora, com ou sem rede, e a confirmação no servidor
 * — que roda exatamente o mesmo algoritmo — acontece em seguida.
 */
export function useScanSession({
  initialNotes,
  isOnline,
  hasPendingQueue,
  enqueue,
}: UseScanSessionOptions) {
  const [notes, setNotes] = useState<readonly NoteView[]>(initialNotes);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [unresolvedCode, setUnresolvedCode] = useState<string | null>(null);

  // O retrato local acompanha a bipagem, e não a última resposta do servidor: o que
  // foi bipado offline só existe aqui e na fila, então salvar apenas o resultado do
  // `GET /notes` faria um reload sem rede reabrir a tela com contadores atrasados e
  // convidaria o operador a bipar as mesmas caixas de novo (US-013).
  useEffect(() => {
    void saveOpenNotes(notes);
  }, [notes]);

  const openNotes = useMemo(() => notes.filter((note) => note.status === "open"), [notes]);

  const candidates = useMemo<readonly PendingCandidate[]>(
    () =>
      openNotes.flatMap((note) =>
        note.items
          .filter((item) => item.confirmedQty < item.expectedQty)
          .map((item) => ({ noteId: note.noteId, invoiceNumber: note.invoiceNumber, item })),
      ),
    [openNotes],
  );

  const submit = useCallback(
    async (payload: ScanEventPayload) => {
      // Enquanto sobrar qualquer coisa na fila a bipagem nova entra atrás dela, mesmo já
      // com rede: no instante em que a conexão volta o flush ainda está enviando o lote
      // antigo, e um `POST /scan-events` direto correria em paralelo com ele. Como o
      // `resolveScan` (ADR-001) aloca a bipagem ambígua pela ordem em que ela é aplicada,
      // chegar na frente do lote decidiria a alocação sobre um retrato atrasado das notas
      // e creditaria a caixa na nota errada (US-009). A fila é o único caminho que
      // preserva a ordem de bipagem.
      if (!isOnline || hasPendingQueue) {
        await enqueue({ kind: "scan", ...payload });
        return;
      }
      try {
        await sendScanEvent(payload);
      } catch {
        // O envio falhou depois de a bipagem já ter contado na tela, então ela não pode
        // ser descartada aqui em silêncio (ADR-003) — nem quando o erro veio do servidor,
        // e não da rede. Toda falha vai para a fila, que é o único lugar que sabe separar
        // o que é temporário (rede, sessão expirada, 5xx) do que é recusa definitiva:
        // o primeiro caso ela retenta sozinha, o segundo ela devolve ao operador como
        // bipagem descartada, em vez de virar uma caixa que só o relatório denunciaria.
        await enqueue({ kind: "scan", ...payload });
      }
    },
    [enqueue, hasPendingQueue, isOnline],
  );

  const confirmItem = useCallback(
    async (noteId: string, itemId: string, payload: ScanEventPayload) => {
      setNotes((current) =>
        current.map((note) => (note.noteId === noteId ? withConfirmedItem(note, itemId) : note)),
      );
      const item = findItem(notes, itemId);
      setFeedback({ kind: "matched", description: item?.description ?? "Item confirmado" });
      await submit(payload);
    },
    [notes, submit],
  );

  const handleScan = useCallback(
    async (scannedCode: string) => {
      const payload: ScanEventPayload = {
        clientEventId: crypto.randomUUID(),
        scannedCode,
        scannedAt: new Date().toISOString(),
      };
      const resolution = resolveScan(openNotes.map(toPendingNote), scannedCode);
      if (resolution.kind === "matched") {
        await confirmItem(resolution.noteId, resolution.itemId, payload);
        return;
      }
      if (resolution.kind === "exceeded") {
        const item = findItem(notes, resolution.itemId);
        setFeedback({
          kind: "exceeded",
          description: item?.description ?? "Este produto",
        });
        await submit(payload);
        return;
      }
      setFeedback({ kind: "unidentified", description: scannedCode });
      // Sem nenhum item pendente não há o que escolher: a caixa vai direto para o
      // fluxo de não identificada (US-006.EC-1).
      if (candidates.length === 0) {
        await submit({ ...payload, markUnidentified: true });
        return;
      }
      setUnresolvedCode(scannedCode);
    },
    [candidates.length, confirmItem, notes, openNotes, submit],
  );

  const chooseManualItem = useCallback(
    async (candidate: PendingCandidate) => {
      if (unresolvedCode === null) return;
      const payload: ScanEventPayload = {
        clientEventId: crypto.randomUUID(),
        scannedCode: unresolvedCode,
        scannedAt: new Date().toISOString(),
        manualItemId: candidate.item.itemId,
      };
      setUnresolvedCode(null);
      await confirmItem(candidate.noteId, candidate.item.itemId, payload);
    },
    [confirmItem, unresolvedCode],
  );

  const registerUnidentified = useCallback(async () => {
    if (unresolvedCode === null) return;
    const scannedCode = unresolvedCode;
    setUnresolvedCode(null);
    await submit({
      clientEventId: crypto.randomUUID(),
      scannedCode,
      scannedAt: new Date().toISOString(),
      markUnidentified: true,
    });
  }, [submit, unresolvedCode]);

  /** Cancelar a seleção manual não envia evento nenhum (US-006.EC-2). */
  const cancelManualSelection = useCallback(() => {
    setUnresolvedCode(null);
    setFeedback(null);
  }, []);

  return {
    notes,
    openNotes,
    candidates,
    feedback,
    unresolvedCode,
    handleScan,
    chooseManualItem,
    registerUnidentified,
    cancelManualSelection,
  };
}
