"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Item esperado de uma nota fiscal, com o contador denormalizado de caixas já
 * confirmadas (ADR-007).
 */
class NoteItem {
    constructor(itemId, cProd, cEan, description, unit, expectedQty, confirmedQty) {
        this.itemId = itemId;
        this.cProd = cProd;
        this.cEan = cEan;
        this.description = description;
        this.unit = unit;
        this.expectedQty = expectedQty;
        this.confirmedQty = confirmedQty;
        if (expectedQty <= 0)
            throw new Error("Quantidade esperada deve ser maior que zero");
        if (confirmedQty < 0)
            throw new Error("Quantidade confirmada não pode ser negativa");
    }
    getConfirmedQty() {
        return this.confirmedQty;
    }
    getMissingQty() {
        return Math.max(this.expectedQty - this.confirmedQty, 0);
    }
    isPending() {
        return this.confirmedQty < this.expectedQty;
    }
    /** Credita uma caixa a este item; recusa quando a quantidade esperada já foi atingida. */
    confirmOneBox() {
        if (!this.isPending())
            throw new Error("Quantidade esperada do item já foi atingida");
        this.confirmedQty += 1;
    }
}
exports.default = NoteItem;
//# sourceMappingURL=NoteItem.js.map