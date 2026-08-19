import { sql } from "drizzle-orm";
import { check, index, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { invoiceNotes } from "./invoiceNotes";

export const noteItems = pgTable(
  "note_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => invoiceNotes.id),
    cProd: text("c_prod").notNull(),
    cEan: text("c_ean"),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    expectedQty: numeric("expected_qty", { precision: 12, scale: 3 }).notNull(),
    confirmedQty: numeric("confirmed_qty", { precision: 12, scale: 3 }).notNull().default("0"),
  },
  (table) => [
    uniqueIndex("note_items_note_id_c_prod_idx").on(table.noteId, table.cProd),
    index("note_items_note_id_idx").on(table.noteId),
    // Backstop do limite de quantidade: a decisão atômica vive no `UPDATE ... WHERE
    // confirmed_qty < expected_qty` de `NoteRepository.incrementConfirmedQty`, e este
    // CHECK garante que qualquer outro caminho de escrita falhe alto em vez de deixar o
    // contador passar da quantidade esperada.
    check("note_items_confirmed_qty_within_expected", sql`"confirmed_qty" <= "expected_qty"`),
  ],
);

export type NoteItemRow = typeof noteItems.$inferSelect;
export type NewNoteItemRow = typeof noteItems.$inferInsert;
