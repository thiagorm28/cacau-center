import { PillProgress } from "../../components/ui/PillProgress";
import type { NoteItemView } from "../../api/types";

interface NoteItemListProps {
  items: readonly NoteItemView[];
}

/** Lista de itens da nota com o contador vivo de caixas confirmadas (US-004.AC-1). */
export function NoteItemList({ items }: NoteItemListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const isComplete = item.confirmedQty >= item.expectedQty;
        return (
          <li key={item.itemId} className="rounded-card bg-surface p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-item font-semibold text-text">{item.description}</span>
              <span
                className="text-meta font-semibold text-accent-700"
                aria-label={`${item.description}: caixas confirmadas`}
              >
                {item.confirmedQty}/{item.expectedQty}
              </span>
            </div>
            <div className="mt-3">
              <PillProgress
                confirmed={item.confirmedQty}
                expected={item.expectedQty}
                label={`Progresso de ${item.description}`}
              />
            </div>
            {isComplete ? (
              <p className="section-label mt-2 text-choc-600">Item completo</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
