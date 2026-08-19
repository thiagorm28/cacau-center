"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDivergenceReport = buildDivergenceReport;
const toReportItem = (note) => note.items.map((item) => ({
    itemId: item.itemId,
    cProd: item.cProd,
    description: item.description,
    unit: item.unit,
    expectedQty: item.expectedQty,
    confirmedQty: item.getConfirmedQty(),
    missingQty: item.getMissingQty(),
}));
const toReportScan = (note, event) => {
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
function buildDivergenceReport(note, noteScanEvents) {
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
//# sourceMappingURL=DivergenceReport.js.map