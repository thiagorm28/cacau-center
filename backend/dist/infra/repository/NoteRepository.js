"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const drizzle_orm_1 = require("drizzle-orm");
const InvoiceNote_1 = __importDefault(require("../../domain/entity/InvoiceNote"));
const NoteItem_1 = __importDefault(require("../../domain/entity/NoteItem"));
const schema_1 = require("../database/schema");
/**
 * `numeric` volta do Postgres como string; toda quantidade passa por `parseFloat` antes
 * de entrar no domínio.
 */
const toItem = (row) => new NoteItem_1.default(row.id, row.cProd, row.cEan, row.description, row.unit, Number.parseFloat(row.expectedQty), Number.parseFloat(row.confirmedQty));
const toNote = (row, itemRows) => new InvoiceNote_1.default(row.id, row.invoiceNumber, row.nfeChaveAcesso, row.nfeNumero, row.supplierCnpj, row.supplierName, row.status, row.openedBy, row.openedAt, row.closedBy, row.closedAt, itemRows.map(toItem));
class NoteRepositoryDatabase {
    constructor(exec) {
        this.exec = exec;
    }
    async create(input) {
        const [noteRow] = await this.exec
            .insert(schema_1.invoiceNotes)
            .values({
            invoiceNumber: input.invoiceNumber,
            nfeChaveAcesso: input.nfeChaveAcesso,
            nfeNumero: input.nfeNumero,
            supplierCnpj: input.supplierCnpj,
            supplierName: input.supplierName,
            rawXml: input.rawXml,
            openedBy: input.openedBy,
        })
            .returning();
        if (noteRow === undefined)
            throw new Error("Falha ao criar a nota");
        const itemRows = await this.exec
            .insert(schema_1.noteItems)
            .values(input.items.map((item) => ({
            noteId: noteRow.id,
            cProd: item.cProd,
            cEan: item.cEan,
            description: item.description,
            unit: item.unit,
            expectedQty: item.expectedQty.toString(),
        })))
            .returning();
        return toNote(noteRow, itemRows);
    }
    async findById(noteId) {
        const [noteRow] = await this.exec
            .select()
            .from(schema_1.invoiceNotes)
            .where((0, drizzle_orm_1.eq)(schema_1.invoiceNotes.id, noteId))
            .limit(1);
        if (noteRow === undefined)
            return null;
        const itemRows = await this.loadItems([noteId]);
        return toNote(noteRow, itemRows);
    }
    async lockInvoiceNumber(invoiceNumber) {
        await this.exec.execute((0, drizzle_orm_1.sql) `select pg_advisory_xact_lock(hashtext(${invoiceNumber}))`);
    }
    async hasOpenWithInvoiceNumber(invoiceNumber) {
        const [row] = await this.exec
            .select({ id: schema_1.invoiceNotes.id })
            .from(schema_1.invoiceNotes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.invoiceNotes.invoiceNumber, invoiceNumber), (0, drizzle_orm_1.eq)(schema_1.invoiceNotes.status, "open")))
            .limit(1);
        return row !== undefined;
    }
    listOpen() {
        return this.list({ statuses: ["open"] });
    }
    async list(filter) {
        const conditions = [
            filter.statuses === undefined ? undefined : (0, drizzle_orm_1.inArray)(schema_1.invoiceNotes.status, [...filter.statuses]),
            filter.closedFrom === undefined ? undefined : (0, drizzle_orm_1.gte)(schema_1.invoiceNotes.closedAt, filter.closedFrom),
            filter.closedTo === undefined ? undefined : (0, drizzle_orm_1.lte)(schema_1.invoiceNotes.closedAt, filter.closedTo),
        ].filter((condition) => condition !== undefined);
        const noteRows = await this.exec
            .select()
            .from(schema_1.invoiceNotes)
            .where(conditions.length === 0 ? undefined : (0, drizzle_orm_1.and)(...conditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.invoiceNotes.openedAt), (0, drizzle_orm_1.desc)(schema_1.invoiceNotes.id));
        if (noteRows.length === 0)
            return [];
        const itemRows = await this.loadItems(noteRows.map((row) => row.id));
        return noteRows.map((row) => toNote(row, itemRows.filter((item) => item.noteId === row.id)));
    }
    /**
     * O `confirmed_qty < expected_qty` no `WHERE` é o que torna o limite de quantidade
     * atômico: sob READ COMMITTED, uma bipagem concorrente que espera pelo lock da linha
     * reavalia o predicado depois do commit da primeira e atualiza zero linhas, em vez de
     * confiar no snapshot lido antes da escrita. Quem chama trata o `false` como
     * `exceeded` — o banco é a autoridade sobre o invariante, não a leitura anterior.
     */
    async incrementConfirmedQty(itemId) {
        const rows = await this.exec
            .update(schema_1.noteItems)
            .set({ confirmedQty: (0, drizzle_orm_1.sql) `${schema_1.noteItems.confirmedQty} + 1` })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.noteItems.id, itemId), (0, drizzle_orm_1.lt)(schema_1.noteItems.confirmedQty, schema_1.noteItems.expectedQty)))
            .returning({ id: schema_1.noteItems.id });
        return rows.length > 0;
    }
    async close(noteId, status, closedBy, closedAt) {
        await this.exec
            .update(schema_1.invoiceNotes)
            .set({ status, closedBy, closedAt })
            .where((0, drizzle_orm_1.eq)(schema_1.invoiceNotes.id, noteId));
    }
    loadItems(noteIds) {
        return this.exec
            .select()
            .from(schema_1.noteItems)
            .where((0, drizzle_orm_1.inArray)(schema_1.noteItems.noteId, [...noteIds]))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.noteItems.cProd));
    }
}
exports.default = NoteRepositoryDatabase;
//# sourceMappingURL=NoteRepository.js.map