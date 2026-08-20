import { useEffect, useState } from "react";
import { listHistory } from "../../api/client";
import type { HistoryEntry } from "../../api/types";
import { Banner } from "../../components/ui/Banner";
import { Card } from "../../components/ui/Card";
import { Screen } from "../../components/ui/Screen";
import { LogoutButton } from "../auth/LogoutButton";

interface HistoryScreenProps {
  onOpenReport: (noteId: string) => void;
}

const STATUS_LABEL: Record<HistoryEntry["status"], string> = {
  open: "Em conferência",
  completed: "Completa",
  closed_incomplete: "Com divergência",
};

const formatDate = (iso: string | null): string =>
  iso === null ? "—" : new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Histórico de conferências, exclusivo do papel gerente (US-016). */
export function HistoryScreen({ onOpenReport }: HistoryScreenProps) {
  const [entries, setEntries] = useState<readonly HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listHistory()
      .then((history) => {
        if (active) setEntries(history);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar o histórico.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen title="Histórico" subtitle="Conferências já finalizadas" header={<LogoutButton />}>
      {error === null ? null : <Banner tone="error">{error}</Banner>}
      {entries === null ? null : entries.length === 0 ? (
        <p className="text-item text-choc-600">
          Nenhuma conferência finalizada ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <li key={entry.noteId}>
              <Card onClick={() => onOpenReport(entry.noteId)}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-item font-semibold text-text">
                    Nota {entry.invoiceNumber}
                  </span>
                  <span className="text-meta font-semibold text-accent-700">
                    {STATUS_LABEL[entry.status]}
                  </span>
                </div>
                <p className="mt-1 text-meta text-choc-600">
                  {entry.supplierName} · conferida por {entry.closedByName ?? entry.openedByName ?? "—"}
                </p>
                <p className="mt-1 text-meta text-choc-600">{formatDate(entry.closedAt)}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
