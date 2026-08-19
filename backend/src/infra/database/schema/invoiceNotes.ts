import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const noteStatus = pgEnum("note_status", ["open", "completed", "closed_incomplete"]);

export const invoiceNotes = pgTable(
  "invoice_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: text("invoice_number").notNull(),
    nfeChaveAcesso: text("nfe_chave_acesso").notNull(),
    nfeNumero: text("nfe_numero").notNull(),
    supplierCnpj: text("supplier_cnpj").notNull(),
    supplierName: text("supplier_name").notNull(),
    status: noteStatus("status").notNull().default("open"),
    rawXml: text("raw_xml").notNull(),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedBy: uuid("closed_by").references(() => users.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("invoice_notes_status_idx").on(table.status),
    index("invoice_notes_invoice_number_idx").on(table.invoiceNumber),
  ],
);

export type InvoiceNoteRow = typeof invoiceNotes.$inferSelect;
export type NewInvoiceNoteRow = typeof invoiceNotes.$inferInsert;
