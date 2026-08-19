"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noteItems = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const invoiceNotes_1 = require("./invoiceNotes");
exports.noteItems = (0, pg_core_1.pgTable)("note_items", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    noteId: (0, pg_core_1.uuid)("note_id")
        .notNull()
        .references(() => invoiceNotes_1.invoiceNotes.id),
    cProd: (0, pg_core_1.text)("c_prod").notNull(),
    cEan: (0, pg_core_1.text)("c_ean"),
    description: (0, pg_core_1.text)("description").notNull(),
    unit: (0, pg_core_1.text)("unit").notNull(),
    expectedQty: (0, pg_core_1.numeric)("expected_qty", { precision: 12, scale: 3 }).notNull(),
    confirmedQty: (0, pg_core_1.numeric)("confirmed_qty", { precision: 12, scale: 3 }).notNull().default("0"),
}, (table) => [
    (0, pg_core_1.uniqueIndex)("note_items_note_id_c_prod_idx").on(table.noteId, table.cProd),
    (0, pg_core_1.index)("note_items_note_id_idx").on(table.noteId),
    // Backstop do limite de quantidade: a decisão atômica vive no `UPDATE ... WHERE
    // confirmed_qty < expected_qty` de `NoteRepository.incrementConfirmedQty`, e este
    // CHECK garante que qualquer outro caminho de escrita falhe alto em vez de deixar o
    // contador passar da quantidade esperada.
    (0, pg_core_1.check)("note_items_confirmed_qty_within_expected", (0, drizzle_orm_1.sql) `"confirmed_qty" <= "expected_qty"`),
]);
//# sourceMappingURL=noteItems.js.map