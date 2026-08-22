import {
  isCloserToCompletion,
  parseOpenedAt,
  type CompletionCandidate,
} from "./completionOrder.js";

/**
 * Resumo de uma nota aberta, com os totais já agregados — o atalho de bipagem rápida não
 * precisa do detalhamento por item que `resolveScan` exige (ADR-006).
 */
export interface OpenNoteSummary {
  readonly noteId: string;
  readonly openedAt: string; // ISO 8601
  readonly confirmedTotal: number;
  readonly expectedTotal: number;
}

const toCandidate = (note: OpenNoteSummary): CompletionCandidate => ({
  confirmedQty: note.confirmedTotal,
  totalExpected: note.expectedTotal,
  openedAtMs: parseOpenedAt(note.openedAt),
});

/**
 * Escolhe a nota aberta mais próxima da conclusão: maior `confirmedTotal / expectedTotal`
 * vence, empate exato resolve pela nota aberta há mais tempo (ADR-006).
 *
 * Função pura, sem I/O e sem leitura do relógio. Retorna `null` quando não há nota aberta.
 */
export function pickQuickScanNote(openNotes: readonly OpenNoteSummary[]): string | null {
  const best = openNotes.reduce<OpenNoteSummary | undefined>(
    (incumbent, note) =>
      incumbent === undefined ||
      isCloserToCompletion(toCandidate(note), toCandidate(incumbent))
        ? note
        : incumbent,
    undefined,
  );
  return best?.noteId ?? null;
}
