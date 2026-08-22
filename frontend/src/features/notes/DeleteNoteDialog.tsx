import { Banner } from "../../components/ui/Banner";
import { Dialog } from "../../components/ui/Dialog";
import { PillButton } from "../../components/ui/PillButton";

interface DeleteNoteDialogProps {
  invoiceNumber: string;
  confirmedTotal: number;
  expectedTotal: number;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A exclusão é definitiva e não guarda rastro (ADR-001), então o aviso declara sempre a
 * permanência e, quando já há caixas conferidas, quantas serão perdidas — inclusive na
 * nota 100% bipada que continua aberta (US-002.EC-1), sem mensagem especial.
 */
const warningFor = (confirmedTotal: number, expectedTotal: number): string =>
  confirmedTotal === 0
    ? "Esta exclusão é permanente e não pode ser desfeita."
    : `Esta nota tem ${confirmedTotal} de ${expectedTotal} caixas conferidas, e esse progresso será perdido. Esta exclusão é permanente e não pode ser desfeita.`;

/** Confirmação explícita antes de excluir uma nota em conferência (US-001.AC-1). */
export function DeleteNoteDialog({
  invoiceNumber,
  confirmedTotal,
  expectedTotal,
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}: DeleteNoteDialogProps) {
  return (
    <Dialog
      title={`Excluir a nota ${invoiceNumber}?`}
      description={warningFor(confirmedTotal, expectedTotal)}
    >
      <div className="flex flex-col gap-3">
        {error === null ? null : <Banner tone="error">{error}</Banner>}
        <PillButton variant="danger" fullWidth onClick={onConfirm} disabled={isSubmitting}>
          Excluir nota
        </PillButton>
        <PillButton variant="ghost" fullWidth onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </PillButton>
      </div>
    </Dialog>
  );
}
