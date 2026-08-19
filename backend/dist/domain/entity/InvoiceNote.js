"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Nota fiscal em conferência — agregado dono do estado de progresso dos seus itens.
 */
class InvoiceNote {
    constructor(noteId, invoiceNumber, nfeChaveAcesso, nfeNumero, supplierCnpj, supplierName, status, openedBy, openedAt, closedBy, closedAt, items) {
        this.noteId = noteId;
        this.invoiceNumber = invoiceNumber;
        this.nfeChaveAcesso = nfeChaveAcesso;
        this.nfeNumero = nfeNumero;
        this.supplierCnpj = supplierCnpj;
        this.supplierName = supplierName;
        this.status = status;
        this.openedBy = openedBy;
        this.openedAt = openedAt;
        this.closedBy = closedBy;
        this.closedAt = closedAt;
        this.items = items;
    }
    getStatus() {
        return this.status;
    }
    getClosedAt() {
        return this.closedAt;
    }
    getClosedBy() {
        return this.closedBy;
    }
    isOpen() {
        return this.status === "open";
    }
    /** Toda quantidade esperada foi confirmada — condição de conclusão automática (US-010). */
    isFullyConfirmed() {
        return this.items.every((item) => !item.isPending());
    }
    hasPendingItems() {
        return this.items.some((item) => item.isPending());
    }
    findItem(itemId) {
        return this.items.find((item) => item.itemId === itemId);
    }
    markCompleted() {
        this.status = "completed";
    }
    markClosedIncomplete(closedBy, closedAt) {
        this.status = "closed_incomplete";
        this.closedBy = closedBy;
        this.closedAt = closedAt;
    }
    /** Registra o fechamento de uma nota que já estava `completed` (conclusão automática). */
    close(closedBy, closedAt) {
        this.closedBy = closedBy;
        this.closedAt = closedAt;
    }
    /** Projeção consumida pelo motor de alocação compartilhado (ADR-006). */
    toPendingNote() {
        return {
            noteId: this.noteId,
            openedAt: this.openedAt.toISOString(),
            items: this.items.map((item) => ({
                itemId: item.itemId,
                cProd: item.cProd,
                cEan: item.cEan,
                expectedQty: item.expectedQty,
                confirmedQty: item.getConfirmedQty(),
            })),
        };
    }
}
exports.default = InvoiceNote;
//# sourceMappingURL=InvoiceNote.js.map