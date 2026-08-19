import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listNotes } from "../api/client";
import type { NoteView } from "../api/types";
import { Banner } from "../components/ui/Banner";
import { Screen } from "../components/ui/Screen";
import { ScanScreen } from "../features/scan/ScanScreen";
import { readOpenNotes, saveOpenNotes } from "../offline/noteSnapshotStore";

/**
 * Carrega todas as notas abertas antes de montar a bipagem: `resolveScan` decide a
 * alocação olhando o conjunto inteiro de notas em aberto, não apenas a nota da tela.
 *
 * Sem rede a busca é substituída pelo retrato local (US-013): reabrir o app offline
 * precisa devolver o operador à bipagem com o progresso que ele já fez, não a uma tela
 * de erro. O retrato só entra em cena quando a busca falha — servido antes disso, ele
 * congelaria a sessão em dados velhos, porque `useScanSession` fixa as notas na
 * montagem e ignora atualizações posteriores da prop.
 */
export function ScanRoute() {
  const { noteId = "" } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<readonly NoteView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listNotes("open")
      .then((open) => {
        // A gravação não segura a montagem da tela: o retrato só é lido no reload.
        void saveOpenNotes(open);
        if (active) setNotes(open);
      })
      .catch(async () => {
        const cached = await readOpenNotes();
        if (!active) return;
        if (cached === null) setError("Não foi possível carregar as notas em conferência.");
        else setNotes(cached);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error !== null) {
    return (
      <Screen title="Bipagem">
        <Banner tone="error">{error}</Banner>
      </Screen>
    );
  }
  if (notes === null) return <Screen title="Bipagem">{null}</Screen>;
  return (
    <ScanScreen
      notes={notes}
      activeNoteId={noteId}
      onFinalized={() => navigate(`/notas/${noteId}/relatorio`)}
    />
  );
}
