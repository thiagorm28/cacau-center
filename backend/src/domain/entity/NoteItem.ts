/**
 * Item esperado de uma nota fiscal, com o contador denormalizado de caixas já
 * confirmadas (ADR-007).
 */
export default class NoteItem {
  constructor(
    readonly itemId: string,
    readonly cProd: string,
    readonly cEan: string | null,
    readonly description: string,
    readonly unit: string,
    readonly expectedQty: number,
    private confirmedQty: number,
  ) {
    if (expectedQty <= 0) throw new Error("Quantidade esperada deve ser maior que zero");
    if (confirmedQty < 0) throw new Error("Quantidade confirmada não pode ser negativa");
  }

  getConfirmedQty(): number {
    return this.confirmedQty;
  }

  getMissingQty(): number {
    return Math.max(this.expectedQty - this.confirmedQty, 0);
  }

  isPending(): boolean {
    return this.confirmedQty < this.expectedQty;
  }

  /** Credita uma caixa a este item; recusa quando a quantidade esperada já foi atingida. */
  confirmOneBox(): void {
    if (!this.isPending()) throw new Error("Quantidade esperada do item já foi atingida");
    this.confirmedQty += 1;
  }
}
