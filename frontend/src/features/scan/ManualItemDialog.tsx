import { Dialog } from "../../components/ui/Dialog";
import { PillButton } from "../../components/ui/PillButton";
import type { PendingCandidate } from "./useScanSession";

interface ManualItemDialogProps {
  scannedCode: string;
  candidates: readonly PendingCandidate[];
  onChoose: (candidate: PendingCandidate) => void;
  onRegisterUnidentified: () => void;
  onCancel: () => void;
}

/** Fallback de seleção manual quando a leitura não casa com nenhum item (US-006). */
export function ManualItemDialog({
  scannedCode,
  candidates,
  onChoose,
  onRegisterUnidentified,
  onCancel,
}: ManualItemDialogProps) {
  return (
    <Dialog
      title="Código não reconhecido"
      description={`Escolha a qual item a caixa lida (${scannedCode}) pertence.`}
    >
      <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {candidates.map((candidate) => (
          <li key={candidate.item.itemId}>
            <button
              type="button"
              onClick={() => onChoose(candidate)}
              className="w-full rounded-card bg-bg px-4 py-3 text-left shadow-sm"
            >
              <span className="block text-item font-semibold text-text">
                {candidate.item.description}
              </span>
              <span className="block text-meta text-accent-700">
                Nota {candidate.invoiceNumber} · {candidate.item.confirmedQty}/
                {candidate.item.expectedQty} confirmadas
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col gap-3">
        <PillButton variant="secondary" fullWidth onClick={onRegisterUnidentified}>
          Registrar como caixa não identificada
        </PillButton>
        <PillButton variant="ghost" fullWidth onClick={onCancel}>
          Cancelar
        </PillButton>
      </div>
    </Dialog>
  );
}
