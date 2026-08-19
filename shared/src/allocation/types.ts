/**
 * Contrato do motor de alocação de bipagens (ADR-001, ADR-006).
 *
 * Estes tipos são propositalmente livres de qualquer conceito de persistência:
 * `resolveScan` opera apenas sobre o estado que o chamador (backend ou frontend)
 * já carregou em memória.
 */

export type ScanResolution =
  | { kind: "matched"; noteId: string; itemId: string }
  | { kind: "exceeded"; noteId: string; itemId: string }
  | { kind: "unidentified" };

export interface PendingNoteItem {
  itemId: string;
  cProd: string;
  cEan: string | null;
  expectedQty: number;
  confirmedQty: number;
}

export interface PendingNote {
  noteId: string;
  openedAt: string; // ISO 8601, usado no desempate FIFO
  items: readonly PendingNoteItem[];
}
