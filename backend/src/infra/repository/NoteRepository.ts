import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import InvoiceNote, { type NoteStatus } from "../../domain/entity/InvoiceNote";
import NoteItem from "../../domain/entity/NoteItem";
import type { Executor } from "../database/DatabaseConnection";
import { invoiceNotes, noteItems } from "../database/schema";

export type NewNoteItemInput = {
  cProd: string;
  cEan: string | null;
  description: string;
  unit: string;
  expectedQty: number;
};

export type NewNoteInput = {
  invoiceNumber: string;
  nfeChaveAcesso: string;
  nfeNumero: string;
  supplierCnpj: string;
  supplierName: string;
  rawXml: string;
  openedBy: string;
  items: readonly NewNoteItemInput[];
};

export type NoteFilter = {
  statuses?: readonly NoteStatus[];
  closedFrom?: Date;
  closedTo?: Date;
};

export interface NoteRepository {
  create(input: NewNoteInput): Promise<InvoiceNote>;
  findById(noteId: string): Promise<InvoiceNote | null>;
  /**
   * Serializa as transações que abrem a mesma nota. `invoice_number` não tem índice único
   * (o mesmo número pode reabrir depois que a nota anterior fecha), então a checagem de
   * duplicata é um check-then-act: sem este lock, duas requisições concorrentes passam
   * pelo `hasOpenWithInvoiceNumber` antes de qualquer uma commitar o `INSERT` e criam duas
   * notas abertas com o mesmo número. Deve ser chamado antes da checagem, dentro da mesma
   * transação que insere; o lock cai sozinho no commit/rollback.
   */
  lockInvoiceNumber(invoiceNumber: string): Promise<void>;
  hasOpenWithInvoiceNumber(invoiceNumber: string): Promise<boolean>;
  listOpen(): Promise<InvoiceNote[]>;
  list(filter: NoteFilter): Promise<InvoiceNote[]>;
  /** Credita uma caixa ao item; `false` quando a quantidade esperada já foi atingida. */
  incrementConfirmedQty(itemId: string): Promise<boolean>;
  close(noteId: string, status: NoteStatus, closedBy: string, closedAt: Date): Promise<void>;
  /** Apaga os `note_items` e depois a linha de `invoice_notes`. Quem chama precisa ter apagado os `scan_events` antes. */
  delete(noteId: string): Promise<void>;
}

type NoteRow = typeof invoiceNotes.$inferSelect;
type ItemRow = typeof noteItems.$inferSelect;

/**
 * `numeric` volta do Postgres como string; toda quantidade passa por `parseFloat` antes
 * de entrar no domínio.
 */
const toItem = (row: ItemRow): NoteItem =>
  new NoteItem(
    row.id,
    row.cProd,
    row.cEan,
    row.description,
    row.unit,
    Number.parseFloat(row.expectedQty),
    Number.parseFloat(row.confirmedQty),
  );

const toNote = (row: NoteRow, itemRows: readonly ItemRow[]): InvoiceNote =>
  new InvoiceNote(
    row.id,
    row.invoiceNumber,
    row.nfeChaveAcesso,
    row.nfeNumero,
    row.supplierCnpj,
    row.supplierName,
    row.status,
    row.openedBy,
    row.openedAt,
    row.closedBy,
    row.closedAt,
    itemRows.map(toItem),
  );

export default class NoteRepositoryDatabase implements NoteRepository {
  constructor(private readonly exec: Executor) {}

  async create(input: NewNoteInput): Promise<InvoiceNote> {
    const [noteRow] = await this.exec
      .insert(invoiceNotes)
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
    if (noteRow === undefined) throw new Error("Falha ao criar a nota");
    const itemRows = await this.exec
      .insert(noteItems)
      .values(
        input.items.map((item) => ({
          noteId: noteRow.id,
          cProd: item.cProd,
          cEan: item.cEan,
          description: item.description,
          unit: item.unit,
          expectedQty: item.expectedQty.toString(),
        })),
      )
      .returning();
    return toNote(noteRow, itemRows);
  }

  async findById(noteId: string): Promise<InvoiceNote | null> {
    const [noteRow] = await this.exec
      .select()
      .from(invoiceNotes)
      .where(eq(invoiceNotes.id, noteId))
      .limit(1);
    if (noteRow === undefined) return null;
    const itemRows = await this.loadItems([noteId]);
    return toNote(noteRow, itemRows);
  }

  async lockInvoiceNumber(invoiceNumber: string): Promise<void> {
    await this.exec.execute(sql`select pg_advisory_xact_lock(hashtext(${invoiceNumber}))`);
  }

  async hasOpenWithInvoiceNumber(invoiceNumber: string): Promise<boolean> {
    const [row] = await this.exec
      .select({ id: invoiceNotes.id })
      .from(invoiceNotes)
      .where(
        and(eq(invoiceNotes.invoiceNumber, invoiceNumber), eq(invoiceNotes.status, "open")),
      )
      .limit(1);
    return row !== undefined;
  }

  listOpen(): Promise<InvoiceNote[]> {
    return this.list({ statuses: ["open"] });
  }

  async list(filter: NoteFilter): Promise<InvoiceNote[]> {
    const conditions = [
      filter.statuses === undefined ? undefined : inArray(invoiceNotes.status, [...filter.statuses]),
      filter.closedFrom === undefined ? undefined : gte(invoiceNotes.closedAt, filter.closedFrom),
      filter.closedTo === undefined ? undefined : lte(invoiceNotes.closedAt, filter.closedTo),
    ].filter((condition) => condition !== undefined);
    const noteRows = await this.exec
      .select()
      .from(invoiceNotes)
      .where(conditions.length === 0 ? undefined : and(...conditions))
      .orderBy(desc(invoiceNotes.openedAt), desc(invoiceNotes.id));
    if (noteRows.length === 0) return [];
    const itemRows = await this.loadItems(noteRows.map((row) => row.id));
    return noteRows.map((row) =>
      toNote(
        row,
        itemRows.filter((item) => item.noteId === row.id),
      ),
    );
  }

  /**
   * O `confirmed_qty < expected_qty` no `WHERE` é o que torna o limite de quantidade
   * atômico: sob READ COMMITTED, uma bipagem concorrente que espera pelo lock da linha
   * reavalia o predicado depois do commit da primeira e atualiza zero linhas, em vez de
   * confiar no snapshot lido antes da escrita. Quem chama trata o `false` como
   * `exceeded` — o banco é a autoridade sobre o invariante, não a leitura anterior.
   */
  async incrementConfirmedQty(itemId: string): Promise<boolean> {
    const rows = await this.exec
      .update(noteItems)
      .set({ confirmedQty: sql`${noteItems.confirmedQty} + 1` })
      .where(and(eq(noteItems.id, itemId), lt(noteItems.confirmedQty, noteItems.expectedQty)))
      .returning({ id: noteItems.id });
    return rows.length > 0;
  }

  async close(
    noteId: string,
    status: NoteStatus,
    closedBy: string,
    closedAt: Date,
  ): Promise<void> {
    await this.exec
      .update(invoiceNotes)
      .set({ status, closedBy, closedAt })
      .where(eq(invoiceNotes.id, noteId));
  }

  /**
   * Exclusão definitiva da nota (ADR-001). A ordem é imposta pela FK
   * `note_items.note_id → invoice_notes.id`, que é `no action` de propósito (ADR-004):
   * sem apagar os itens antes, o `DELETE` da nota viola a constraint.
   */
  async delete(noteId: string): Promise<void> {
    await this.exec.delete(noteItems).where(eq(noteItems.noteId, noteId));
    await this.exec.delete(invoiceNotes).where(eq(invoiceNotes.id, noteId));
  }

  private loadItems(noteIds: readonly string[]): Promise<ItemRow[]> {
    return this.exec
      .select()
      .from(noteItems)
      .where(inArray(noteItems.noteId, [...noteIds]))
      .orderBy(asc(noteItems.cProd));
  }
}
