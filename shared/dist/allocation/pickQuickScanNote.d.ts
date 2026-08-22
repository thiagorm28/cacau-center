/**
 * Resumo de uma nota aberta, com os totais já agregados — o atalho de bipagem rápida não
 * precisa do detalhamento por item que `resolveScan` exige (ADR-006).
 */
export interface OpenNoteSummary {
    readonly noteId: string;
    readonly openedAt: string;
    readonly confirmedTotal: number;
    readonly expectedTotal: number;
}
/**
 * Escolhe a nota aberta mais próxima da conclusão: maior `confirmedTotal / expectedTotal`
 * vence, empate exato resolve pela nota aberta há mais tempo (ADR-006).
 *
 * Função pura, sem I/O e sem leitura do relógio. Retorna `null` quando não há nota aberta.
 */
export declare function pickQuickScanNote(openNotes: readonly OpenNoteSummary[]): string | null;
//# sourceMappingURL=pickQuickScanNote.d.ts.map