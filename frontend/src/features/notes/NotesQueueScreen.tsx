import { useCallback, useEffect, useState } from "react";
import { listNotes } from "../../api/client";
import type { NoteView } from "../../api/types";
import { Banner } from "../../components/ui/Banner";
import { Screen } from "../../components/ui/Screen";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { NoteQueueCard } from "./NoteQueueCard";
import { NoteSearchForm } from "./NoteSearchForm";

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

  return (
    <Screen
      title="Notas em conferência"
      subtitle="Adicione uma nota pelo número de faturamento"
    >
      <div className="flex flex-col gap-6">
        <NoteSearchForm isOnline={isOnline} onNoteCreated={() => void reload()} />
        {loadError === null ? null : <Banner tone="info">{loadError}</Banner>}
        {notes.length === 0 ? (
          <p className="text-item text-choc-600">Nenhuma nota em conferência no momento.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {notes.map((note) => (
              <li key={note.noteId}>
                <NoteQueueCard note={note} onOpen={onOpenNote} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}
