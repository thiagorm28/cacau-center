import { isCloserToCompletion, parseOpenedAt, } from "./completionOrder.js";
const toCandidate = (note) => ({
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
export function pickQuickScanNote(openNotes) {
    const best = openNotes.reduce((incumbent, note) => incumbent === undefined ||
        isCloserToCompletion(toCandidate(note), toCandidate(incumbent))
        ? note
        : incumbent, undefined);
    return best?.noteId ?? null;
}
//# sourceMappingURL=pickQuickScanNote.js.map