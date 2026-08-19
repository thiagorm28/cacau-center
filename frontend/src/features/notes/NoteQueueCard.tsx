import type { NoteView } from "../../api/types";
import { Card } from "../../components/ui/Card";
import { PillProgress } from "../../components/ui/PillProgress";

interface NoteQueueCardProps {
  note: NoteView;
  onOpen: (noteId: string) => void;
}

export function NoteQueueCard({ note, onOpen }: NoteQueueCardProps) {
  return (
    <Card onClick={() => onOpen(note.noteId)}>
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
    </Card>
  );
}
