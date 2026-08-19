"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceNotes = exports.noteStatus = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.noteStatus = (0, pg_core_1.pgEnum)("note_status", ["open", "completed", "closed_incomplete"]);
exports.invoiceNotes = (0, pg_core_1.pgTable)("invoice_notes", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    invoiceNumber: (0, pg_core_1.text)("invoice_number").notNull(),
    nfeChaveAcesso: (0, pg_core_1.text)("nfe_chave_acesso").notNull(),
    nfeNumero: (0, pg_core_1.text)("nfe_numero").notNull(),
    supplierCnpj: (0, pg_core_1.text)("supplier_cnpj").notNull(),
    supplierName: (0, pg_core_1.text)("supplier_name").notNull(),
    status: (0, exports.noteStatus)("status").notNull().default("open"),
    rawXml: (0, pg_core_1.text)("raw_xml").notNull(),
    openedBy: (0, pg_core_1.uuid)("opened_by")
        .notNull()
        .references(() => users_1.users.id),
    openedAt: (0, pg_core_1.timestamp)("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedBy: (0, pg_core_1.uuid)("closed_by").references(() => users_1.users.id),
    closedAt: (0, pg_core_1.timestamp)("closed_at", { withTimezone: true }),
}, (table) => [
    (0, pg_core_1.index)("invoice_notes_status_idx").on(table.status),
    (0, pg_core_1.index)("invoice_notes_invoice_number_idx").on(table.invoiceNumber),
]);
//# sourceMappingURL=invoiceNotes.js.map