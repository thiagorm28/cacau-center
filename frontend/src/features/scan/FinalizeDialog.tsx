import { Dialog } from "../../components/ui/Dialog";
import { PillButton } from "../../components/ui/PillButton";

interface FinalizeDialogProps {
  pendingItemCount: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação explícita antes de fechar uma nota incompleta (US-011.AC-1). */
export function FinalizeDialog({
  pendingItemCount,
  isSubmitting,
  onConfirm,
  onCancel,
}: FinalizeDialogProps) {
  return (
    <Dialog
      title="Finalizar mesmo assim?"
      description={`Ainda há ${pendingItemCount} ${
        pendingItemCount === 1 ? "item pendente" : "itens pendentes"
      } nesta nota. A finalização gera o relatório de divergência.`}
    >
      <div className="flex flex-col gap-3">
        <PillButton fullWidth onClick={onConfirm} disabled={isSubmitting}>
          Finalizar com divergência
        </PillButton>
        <PillButton variant="ghost" fullWidth onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </PillButton>
      </div>
    </Dialog>
  );
}
