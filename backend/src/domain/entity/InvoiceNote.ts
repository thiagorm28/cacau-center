import type { PendingNote } from "shared";
import NoteItem from "./NoteItem";

export type NoteStatus = "open" | "completed" | "closed_incomplete";

/**
 * Nota fiscal em conferência — agregado dono do estado de progresso dos seus itens.
 */
export default class InvoiceNote {
  constructor(
    readonly noteId: string,
    readonly invoiceNumber: string,
    readonly nfeChaveAcesso: string,
    readonly nfeNumero: string,
    readonly supplierCnpj: string,
    readonly supplierName: string,
    private status: NoteStatus,
    readonly openedBy: string,
    readonly openedAt: Date,
    private closedBy: string | null,
    private closedAt: Date | null,
    readonly items: readonly NoteItem[],
  ) {}

  getStatus(): NoteStatus {
    return this.status;
  }

  getClosedAt(): Date | null {
    return this.closedAt;
  }

  getClosedBy(): string | null {
    return this.closedBy;
  }

  isOpen(): boolean {
    return this.status === "open";
  }

  /** Toda quantidade esperada foi confirmada — condição de conclusão automática (US-010). */
  isFullyConfirmed(): boolean {
    return this.items.every((item) => !item.isPending());
  }

  hasPendingItems(): boolean {
    return this.items.some((item) => item.isPending());
  }

  findItem(itemId: string): NoteItem | undefined {
    return this.items.find((item) => item.itemId === itemId);
  }

  markCompleted(): void {
    this.status = "completed";
  }

  markClosedIncomplete(closedBy: string, closedAt: Date): void {
    this.status = "closed_incomplete";
    this.closedBy = closedBy;
    this.closedAt = closedAt;
  }

  /** Registra o fechamento de uma nota que já estava `completed` (conclusão automática). */
  close(closedBy: string, closedAt: Date): void {
    this.closedBy = closedBy;
    this.closedAt = closedAt;
  }

  /** Projeção consumida pelo motor de alocação compartilhado (ADR-006). */
  toPendingNote(): PendingNote {
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
