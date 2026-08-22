import { useCallback, useEffect, useState } from "react";
import { pickQuickScanNote } from "shared";
import type { OpenNoteSummary } from "shared";
import { deleteNote, listNotes } from "../../api/client";
import type { NoteView } from "../../api/types";
import { Banner } from "../../components/ui/Banner";
import { PillButton } from "../../components/ui/PillButton";
import { Screen } from "../../components/ui/Screen";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { NoteQueueCard } from "./NoteQueueCard";
import { NoteSearchForm } from "./NoteSearchForm";

const toSummary = (note: NoteView): OpenNoteSummary => ({
  noteId: note.noteId,
  openedAt: note.openedAt,
  confirmedTotal: note.confirmedTotal,
  expectedTotal: note.expectedTotal,
});

interface NotesQueueScreenProps {
  onOpenNote: (noteId: string) => void;
}

/** Fila de notas em conferência, cada uma com seu progresso próprio (US-008.AC-2). */
export function NotesQueueScreen({ onOpenNote }: NotesQueueScreenProps) {
  const isOnline = useOnlineStatus();
  const [notes, setNotes] = useState<readonly NoteView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setNotes(await listNotes("open"));
      setLoadError(null);
    } catch {
      // Offline a fila carregada anteriormente continua na tela (US-003.AC-3).
      setLoadError("Não foi possível atualizar a fila agora.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Atalho único, fora dos cards (ADR-002): abre a bipagem já na nota mais próxima da
   * conclusão. A alocação de cada bipagem continua a cargo do `resolveScan`.
   */
  const quickScan = () => {
    const noteId = pickQuickScanNote(notes.map(toSummary));
    if (noteId !== null) onOpenNote(noteId);
  };

  /**
   * A nota some da fila assim que o backend confirma a exclusão (US-001.AC-2); o
   * `reload` seguinte só serve para trazer o que mudou em outros dispositivos e, se
   * falhar, não pode ressuscitar o card recém-excluído.
   */
  const removeNote = async (noteId: string) => {
    await deleteNote(noteId);
    setNotes((current) => current.filter((note) => note.noteId !== noteId));
    await reload();
  };

  return (
    <Screen
      title="Notas em conferência"
      subtitle="Adicione uma nota pelo número de faturamento"
    >
      <div className="flex flex-col gap-6">
        <NoteSearchForm isOnline={isOnline} onNoteCreated={() => void reload()} />
        {loadError === null ? null : <Banner tone="info">{loadError}</Banner>}
        <PillButton fullWidth onClick={quickScan} disabled={notes.length === 0}>
          Bipar
        </PillButton>
        {notes.length === 0 ? (
          <p className="text-item text-choc-600">Nenhuma nota em conferência no momento.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {notes.map((note) => (
              <li key={note.noteId}>
                <NoteQueueCard
                  note={note}
                  isOnline={isOnline}
                  onOpen={onOpenNote}
                  onDelete={removeNote}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}
