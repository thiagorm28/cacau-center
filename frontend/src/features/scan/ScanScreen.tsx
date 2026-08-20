import { useState } from "react";
import { NetworkError, finalizeNote } from "../../api/client";
import type { FinalizeResult, NoteView } from "../../api/types";
import { Banner } from "../../components/ui/Banner";
import { BigCounter } from "../../components/ui/BigCounter";
import { PillButton } from "../../components/ui/PillButton";
import { Screen } from "../../components/ui/Screen";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { FinalizeDialog } from "./FinalizeDialog";
import { ManualItemDialog } from "./ManualItemDialog";
import { NoteItemList } from "./NoteItemList";
import { ScanFeedbackBanner } from "./ScanFeedbackBanner";
import { useScanSession } from "./useScanSession";

interface ScanScreenProps {
  notes: readonly NoteView[];
  activeNoteId: string;
  onFinalized: (result: FinalizeResult | null) => void;
}

export function ScanScreen({ notes, activeNoteId, onFinalized }: ScanScreenProps) {
  const { enqueue, isOnline, pending, isFlushing, discarded, acknowledgeDiscarded } =
    useOfflineQueue();
  // `isFlushing` cobre a janela em que a fila já foi lida mas ainda não foi esvaziada:
  // sem ele a bipagem seguinte escaparia direto para a rede no meio do envio do lote.
  const session = useScanSession({
    initialNotes: notes,
    isOnline,
    hasPendingQueue: pending.length > 0 || isFlushing,
    enqueue,
  });
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const scanner = useBarcodeScanner({
    onScan: (code) => void session.handleScan(code),
    enabled: session.unresolvedCode === null && !isFinalizeOpen,
  });

  const activeNote = session.notes.find((note) => note.noteId === activeNoteId);
  if (activeNote === undefined) {
    return (
      <Screen title="Bipagem">
        <Banner tone="error">Nota não encontrada na fila de conferência.</Banner>
      </Screen>
    );
  }
  const pendingItems = activeNote.items.filter((item) => item.confirmedQty < item.expectedQty);
  // A nota vira `completed` na hora em que a última caixa é bipada (US-010.AC-1): a
  // confirmação precisa aparecer sozinha, sem depender de o operador clicar em nada.
  const isNoteComplete = activeNote.status === "completed";
  const itemSummary = `${activeNote.items.length} ${activeNote.items.length === 1 ? "item" : "itens"}`;
  const discardedScans = discarded.filter((action) => action.kind === "scan");
  const discardedFinalizes = discarded.filter((action) => action.kind === "finalize");

  const finalize = async () => {
    setIsSubmitting(true);
    setFinalizeError(null);
    const queueOffline = async () => {
      await enqueue({
        kind: "finalize",
        clientEventId: crypto.randomUUID(),
        noteId: activeNoteId,
        confirmIncomplete: true,
      });
      onFinalized(null);
    };
    try {
      if (!isOnline) await queueOffline();
      else onFinalized(await finalizeNote(activeNoteId, true));
    } catch (error) {
      if (error instanceof NetworkError) await queueOffline();
      else setFinalizeError("Não foi possível finalizar a nota agora.");
    } finally {
      setIsSubmitting(false);
      setIsFinalizeOpen(false);
    }
  };

  return (
    <Screen
      title={`Nota ${activeNote.invoiceNumber}`}
      subtitle={activeNote.supplierName}
      header={
        <div className="mt-6">
          <BigCounter
            value={activeNote.confirmedTotal}
            total={activeNote.expectedTotal}
            caption="caixas confirmadas"
          />
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {isOnline ? null : <Banner tone="info">Offline: bipagens seguem sendo salvas no aparelho.</Banner>}
        {scanner.error === "permission-denied" ? (
          <Banner tone="error">Permissão de câmera negada. Libere o acesso para bipar as caixas.</Banner>
        ) : null}
        {scanner.error === "camera-unavailable" ? (
          <Banner tone="error">Câmera indisponível neste aparelho.</Banner>
        ) : null}
        <video
          ref={scanner.videoRef}
          muted
          playsInline
          aria-label="Leitor de código de barras"
          className="aspect-video w-full rounded-frame bg-choc-700 object-cover shadow-lg"
        />
        {isNoteComplete ? (
          <Banner tone="success">
            {`Nota completa! ${activeNote.confirmedTotal} de ${activeNote.expectedTotal} caixas conferidas em ${itemSummary}.`}
          </Banner>
        ) : null}
        <ScanFeedbackBanner feedback={session.feedback} />
        <NoteItemList items={activeNote.items} />
        {finalizeError === null ? null : <Banner tone="error">{finalizeError}</Banner>}
        {discarded.length === 0 ? null : (
          <Banner tone="error">
            {discardedScans.length === 0 ? null : (
              <span className="block">
                {`O servidor recusou ${discardedScans.length} ${discardedScans.length === 1 ? "bipagem" : "bipagens"} da fila offline (${discardedScans.map((scan) => scan.scannedCode).join(", ")}). Bipe ${discardedScans.length === 1 ? "a caixa" : "as caixas"} novamente.`}
              </span>
            )}
            {discardedFinalizes.length === 0 ? null : (
              <span className="mt-2 block">
                {`O servidor recusou a finalização de ${discardedFinalizes.length} ${discardedFinalizes.length === 1 ? "nota" : "notas"} da fila offline. ${discardedFinalizes.length === 1 ? "A nota continua aberta" : "As notas continuam abertas"} e ${discardedFinalizes.length === 1 ? "precisa" : "precisam"} ser finalizada${discardedFinalizes.length === 1 ? "" : "s"} de novo.`}
              </span>
            )}
            <button
              type="button"
              onClick={acknowledgeDiscarded}
              className="mt-3 rounded-pill bg-cream-1 px-5 py-2 text-meta font-semibold text-choc-800"
            >
              Entendi
            </button>
          </Banner>
        )}
        <PillButton
          fullWidth
          onClick={() => (pendingItems.length > 0 ? setIsFinalizeOpen(true) : void finalize())}
          disabled={isSubmitting}
        >
          {isNoteComplete ? "Ver relatório da nota" : "Finalizar conferência"}
        </PillButton>
      </div>
      {session.unresolvedCode === null ? null : (
        <ManualItemDialog
          scannedCode={session.unresolvedCode}
          candidates={session.candidates}
          onChoose={(candidate) => void session.chooseManualItem(candidate)}
          onRegisterUnidentified={() => void session.registerUnidentified()}
          onCancel={session.cancelManualSelection}
        />
      )}
      {isFinalizeOpen ? (
        <FinalizeDialog
          pendingItemCount={pendingItems.length}
          isSubmitting={isSubmitting}
          onConfirm={() => void finalize()}
          onCancel={() => setIsFinalizeOpen(false)}
        />
      ) : null}
    </Screen>
  );
}
