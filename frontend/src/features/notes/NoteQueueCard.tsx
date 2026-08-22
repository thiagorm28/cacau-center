import { useState } from "react";
import { ApiError, NetworkError } from "../../api/client";
import type { NoteView } from "../../api/types";
import { Card } from "../../components/ui/Card";
import { PillButton } from "../../components/ui/PillButton";
import { PillProgress } from "../../components/ui/PillProgress";
import { DeleteNoteDialog } from "./DeleteNoteDialog";

interface NoteQueueCardProps {
  note: NoteView;
  isOnline: boolean;
  onOpen: (noteId: string) => void;
  onDelete: (noteId: string) => Promise<void>;
}

const messageFor = (error: unknown): string => {
  if (error instanceof NetworkError) return "Sem conexão: é preciso estar conectado para excluir uma nota.";
  if (error instanceof ApiError) return error.message;
  return "Não foi possível excluir a nota.";
};

/**
 * Card da fila com duas ações explícitas e independentes (ADR-003): o card inteiro deixou
 * de ser um alvo de clique único, para não confundir "abrir" com "excluir" no toque.
 */
export function NoteQueueCard({ note, isOnline, onOpen, onDelete }: NoteQueueCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setError(null);
    setIsDialogOpen(true);
  };

  const confirmDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onDelete(note.noteId);
      setIsDialogOpen(false);
    } catch (cause) {
      // A exclusão não aconteceu: o diálogo fica aberto com o motivo (US-003.EC-1).
      setError(messageFor(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-item font-semibold text-text">Nota {note.invoiceNumber}</span>
        <span className="text-meta font-semibold text-accent-700">
          {note.confirmedTotal}/{note.expectedTotal}
        </span>
      </div>
      <p className="mt-1 text-meta text-choc-600">{note.supplierName}</p>
      <div className="mt-3">
        <PillProgress
          confirmed={note.confirmedTotal}
          expected={note.expectedTotal}
          label={`Progresso da nota ${note.invoiceNumber}`}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PillButton variant="secondary" onClick={() => onOpen(note.noteId)}>
          Ver produtos
        </PillButton>
        {/* Exclusão nunca é enfileirada offline (ADR-001): sem conexão, o botão só desabilita. */}
        <PillButton variant="danger" onClick={openDialog} disabled={!isOnline}>
          Excluir
        </PillButton>
      </div>
      {isDialogOpen ? (
        <DeleteNoteDialog
          invoiceNumber={note.invoiceNumber}
          confirmedTotal={note.confirmedTotal}
          expectedTotal={note.expectedTotal}
          isSubmitting={isSubmitting}
          error={error}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setIsDialogOpen(false)}
        />
      ) : null}
    </Card>
  );
}
