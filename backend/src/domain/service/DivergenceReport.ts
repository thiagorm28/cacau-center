import type InvoiceNote from "../entity/InvoiceNote";
import type { NoteStatus } from "../entity/InvoiceNote";
import type ScanEvent from "../entity/ScanEvent";

export type ReportItem = {
  itemId: string;
  cProd: string;
  description: string;
  unit: string;
  expectedQty: number;
  confirmedQty: number;
  missingQty: number;
};

export type ReportScan = {
  scanEventId: string;
  scannedCode: string;
  scannedAt: string;
  itemId: string | null;
  description: string | null;
};

export type DivergenceReport = {
  noteId: string;
  invoiceNumber: string;
  supplierName: string;
  status: NoteStatus;
  closedAt: string | null;
  isComplete: boolean;
  items: readonly ReportItem[];
  /** Itens cuja quantidade esperada não foi totalmente confirmada (US-012 AC-2). */
  missingItems: readonly ReportItem[];
  /** Bipagens que excederam a quantidade esperada de um item (US-012 EC-2). */
  exceededScans: readonly ReportScan[];
  /** Caixas registradas como não identificadas, listadas individualmente (US-012 AC-3). */
  unidentifiedScans: readonly ReportScan[];
};

const toReportItem = (note: InvoiceNote): ReportItem[] =>
  note.items.map((item) => ({
    itemId: item.itemId,
    cProd: item.cProd,
    description: item.description,
    unit: item.unit,
    expectedQty: item.expectedQty,
    confirmedQty: item.getConfirmedQty(),
    missingQty: item.getMissingQty(),
  }));

const toReportScan = (note: InvoiceNote, event: ScanEvent): ReportScan => {
  const item = event.noteItemId === null ? undefined : note.findItem(event.noteItemId);
  return {
    scanEventId: event.scanEventId,
    scannedCode: event.scannedCode,
    scannedAt: event.scannedAt.toISOString(),
    itemId: event.noteItemId,
    description: item?.description ?? null,
  };
};

/**
 * Monta o relatório de divergência de uma nota a partir do seu estado e dos eventos de
 * bipagem já associados a ela. Função pura: não faz I/O, não lê o relógio.
 */
export function buildDivergenceReport(
  note: InvoiceNote,
  noteScanEvents: readonly ScanEvent[],
): DivergenceReport {
  const items = toReportItem(note);
  return {
    noteId: note.noteId,
    invoiceNumber: note.invoiceNumber,
    supplierName: note.supplierName,
    status: note.getStatus(),
    closedAt: note.getClosedAt()?.toISOString() ?? null,
    isComplete: note.isFullyConfirmed(),
    items,
    missingItems: items.filter((item) => item.missingQty > 0),
    exceededScans: noteScanEvents
      .filter((event) => event.result === "exceeded")
      .map((event) => toReportScan(note, event)),
    unidentifiedScans: noteScanEvents
      .filter((event) => event.result === "unidentified")
      .map((event) => toReportScan(note, event)),
  };
}
