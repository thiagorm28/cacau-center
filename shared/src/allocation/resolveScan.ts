import { isCloserToCompletion, parseOpenedAt } from "./completionOrder.js";
import type { PendingNote, PendingNoteItem, ScanResolution } from "./types.js";

/**
 * Nota candidata a receber a bipagem, já com as métricas de desempate calculadas.
 *
 * `confirmedAfterScan` / `totalExpected` é o percentual de conclusão total da nota
 * caso esta bipagem seja creditada a ela (ADR-001).
 */
interface ScanCandidate {
  readonly note: PendingNote;
  readonly item: PendingNoteItem;
  readonly confirmedAfterScan: number;
  readonly totalExpected: number;
  readonly openedAtMs: number;
}

type ItemPredicate = (item: PendingNoteItem) => boolean;

const isPending: ItemPredicate = (item) => item.confirmedQty < item.expectedQty;

const isFullyConfirmed: ItemPredicate = (item) => item.confirmedQty >= item.expectedQty;

const matchesScannedCode = (item: PendingNoteItem, scannedCode: string): boolean =>
  item.cProd === scannedCode || item.cEan === scannedCode;

const sumBy = (
  items: readonly PendingNoteItem[],
  pick: (item: PendingNoteItem) => number,
): number => items.reduce((total, item) => total + pick(item), 0);

const buildCandidate = (note: PendingNote, item: PendingNoteItem): ScanCandidate => ({
  note,
  item,
  confirmedAfterScan: sumBy(note.items, (each) => each.confirmedQty) + 1,
  totalExpected: sumBy(note.items, (each) => each.expectedQty),
  openedAtMs: parseOpenedAt(note.openedAt),
});

const collectCandidates = (
  openNotes: readonly PendingNote[],
  scannedCode: string,
  isEligible: ItemPredicate,
): readonly ScanCandidate[] =>
  openNotes
    .flatMap((note) =>
      note.items
        .filter((item) => matchesScannedCode(item, scannedCode) && isEligible(item))
        .map((item) => buildCandidate(note, item)),
    )
    .filter((candidate) => candidate.totalExpected > 0);

/**
 * Adaptador fino sobre `isCloserToCompletion` (ADR-006): a comparação cruzada e o
 * desempate FIFO vivem em `completionOrder.ts`, reaproveitados pelo atalho de bipagem
 * rápida.
 */
const isBetterCandidate = (candidate: ScanCandidate, incumbent: ScanCandidate): boolean =>
  isCloserToCompletion(
    {
      confirmedQty: candidate.confirmedAfterScan,
      totalExpected: candidate.totalExpected,
      openedAtMs: candidate.openedAtMs,
    },
    {
      confirmedQty: incumbent.confirmedAfterScan,
      totalExpected: incumbent.totalExpected,
      openedAtMs: incumbent.openedAtMs,
    },
  );

const selectBestCandidate = (
  candidates: readonly ScanCandidate[],
): ScanCandidate | undefined =>
  candidates.reduce<ScanCandidate | undefined>(
    (best, candidate) =>
      best === undefined || isBetterCandidate(candidate, best) ? candidate : best,
    undefined,
  );

/**
 * Decide a qual nota aberta creditar uma bipagem (ADR-001).
 *
 * Função pura: não faz I/O e não lê o relógio — todo timestamp relevante chega como
 * dado de entrada (`PendingNote.openedAt`), garantindo que backend e frontend produzam
 * exatamente o mesmo resultado para o mesmo estado (ADR-006).
 *
 * 1. Entre todos os itens pendentes cujo `cProd` ou `cEan` é igual ao código bipado,
 *    credita à nota cujo percentual de conclusão total fica maior após a bipagem;
 *    empate exato resolve pelo `openedAt` mais antigo.
 * 2. Sem candidato pendente, mas havendo algum item com esse código já totalmente
 *    confirmado numa nota aberta, resolve `"exceeded"` (mesmo critério de desempate).
 * 3. Caso contrário, resolve `"unidentified"`.
 *
 * ## Limitação conhecida: US-009.AC-3 "em qualquer ordem"
 *
 * A decisão é tomada com o estado atual e nunca é revista, então a alocação final
 * depende da ordem de bipagem em cenários assimétricos. No cenário de referência
 * (nota 1: 10 panetones; nota 2: 10 panetones + 1 trufa), bipar os panetones ANTES da
 * trufa credita todos à nota 1, porque `i/10 > 1/11` a cada bipagem individual — o
 * oposto do que US-009.AC-3 descreve.
 *
 * Isso não é um descuido de implementação: US-009.AC-1 exige creditar a bipagem à nota
 * cujo percentual de conclusão fica MAIOR após ela, e no primeiro panetone essa nota é
 * a nota 1. Enquanto a bipagem #1 é decidida sem informação sobre as bipagens futuras,
 * AC-1 e AC-3 são mutuamente exclusivos: só realocando bipagens já creditadas dá para
 * satisfazer os dois — o que a ADR-001 rejeitou ao escolher o recálculo por bipagem, e
 * que colidiria com a conclusão automática de US-010.AC-1 (a nota 1 já teria sido
 * fechada como completa na 10ª bipagem).
 *
 * O comportamento real está fixado em `resolveScan.test.ts` (UT-003) nas três ordens.
 * A escolha entre estreitar o texto de AC-3 ou adotar realocação retroativa é uma
 * decisão de produto ainda em aberto, rastreada em `reviews-003/issue_002.md`
 * (levantada primeiro em `reviews-001/issue_001.md`). Enquanto ela não for tomada,
 * este docblock — e não o texto de AC-3 — descreve o contrato real da função.
 */
export function resolveScan(
  openNotes: readonly PendingNote[],
  scannedCode: string,
): ScanResolution {
  const pendingMatch = selectBestCandidate(
    collectCandidates(openNotes, scannedCode, isPending),
  );
  if (pendingMatch !== undefined) {
    return {
      kind: "matched",
      noteId: pendingMatch.note.noteId,
      itemId: pendingMatch.item.itemId,
    };
  }

  const exceededMatch = selectBestCandidate(
    collectCandidates(openNotes, scannedCode, isFullyConfirmed),
  );
  if (exceededMatch !== undefined) {
    return {
      kind: "exceeded",
      noteId: exceededMatch.note.noteId,
      itemId: exceededMatch.item.itemId,
    };
  }

  return { kind: "unidentified" };
}
