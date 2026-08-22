/**
 * Técnica de ordenação por proximidade da conclusão, extraída de `resolveScan` para ser
 * reaproveitada pelo atalho de bipagem rápida (ADR-006).
 *
 * Módulo interno ao pacote `shared`: não é exportado na raiz (`src/index.ts`).
 */

export interface CompletionCandidate {
  readonly confirmedQty: number;
  readonly totalExpected: number;
  readonly openedAtMs: number;
}

/**
 * `openedAt` inválido é tratado como "mais recente possível" para que notas com
 * timestamp válido sempre vençam o desempate FIFO.
 */
export const parseOpenedAt = (openedAt: string): number => {
  const parsed = Date.parse(openedAt);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

/**
 * Compara os percentuais de conclusão por multiplicação cruzada, evitando o erro de
 * arredondamento de uma divisão em ponto flutuante — o empate de US-009.EC-1 precisa ser
 * detectado de forma exata, e notas `0/0` nunca dividem por zero. Empate exato resolve
 * pela nota aberta há mais tempo (FIFO); persistindo o empate, mantém-se a ordem de
 * entrada.
 */
export const isCloserToCompletion = (
  candidate: CompletionCandidate,
  incumbent: CompletionCandidate,
): boolean => {
  const candidateRatio = candidate.confirmedQty * incumbent.totalExpected;
  const incumbentRatio = incumbent.confirmedQty * candidate.totalExpected;
  if (candidateRatio !== incumbentRatio) {
    return candidateRatio > incumbentRatio;
  }
  return candidate.openedAtMs < incumbent.openedAtMs;
};
