import { and, asc, eq, isNull } from "drizzle-orm";
import ScanEvent, { type ScanEventResult } from "../../domain/entity/ScanEvent";
import type { Executor } from "../database/DatabaseConnection";
import { scanEvents } from "../database/schema";

export type NewScanEventInput = {
  clientEventId: string;
  scannedCode: string;
  result: ScanEventResult;
  noteId: string | null;
  noteItemId: string | null;
  scannedBy: string;
  scannedAt: Date;
};

export interface ScanEventRepository {
  findByClientEventId(clientEventId: string): Promise<ScanEvent | null>;
  create(input: NewScanEventInput): Promise<ScanEvent>;
  listByNoteId(noteId: string): Promise<ScanEvent[]>;
  /**
   * Associa a `noteId` toda bipagem `unidentified` ainda sem nota (ADR: caixas não
   * identificadas entram no relatório da primeira nota finalizada depois delas).
   */
  claimUnidentified(noteId: string): Promise<number>;
  /** Apaga todas as bipagens da nota; primeiro passo da exclusão em cascata (ADR-004). */
  deleteByNoteId(noteId: string): Promise<number>;
}

type ScanEventRow = typeof scanEvents.$inferSelect;

const toScanEvent = (row: ScanEventRow): ScanEvent =>
  new ScanEvent(
    row.id,
    row.clientEventId,
    row.scannedCode,
    row.result,
    row.noteId,
    row.noteItemId,
    row.scannedBy,
    row.scannedAt,
  );

export default class ScanEventRepositoryDatabase implements ScanEventRepository {
  constructor(private readonly exec: Executor) {}

  async findByClientEventId(clientEventId: string): Promise<ScanEvent | null> {
    const [row] = await this.exec
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.clientEventId, clientEventId))
      .limit(1);
    return row === undefined ? null : toScanEvent(row);
  }

  async create(input: NewScanEventInput): Promise<ScanEvent> {
    const [row] = await this.exec.insert(scanEvents).values(input).returning();
    if (row === undefined) throw new Error("Falha ao registrar a bipagem");
    return toScanEvent(row);
  }

  async listByNoteId(noteId: string): Promise<ScanEvent[]> {
    const rows = await this.exec
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.noteId, noteId))
      .orderBy(asc(scanEvents.scannedAt), asc(scanEvents.createdAt));
    return rows.map(toScanEvent);
  }

  async claimUnidentified(noteId: string): Promise<number> {
    const rows = await this.exec
      .update(scanEvents)
      .set({ noteId })
      .where(and(eq(scanEvents.result, "unidentified"), isNull(scanEvents.noteId)))
      .returning({ id: scanEvents.id });
    return rows.length;
  }

  async deleteByNoteId(noteId: string): Promise<number> {
    const rows = await this.exec
      .delete(scanEvents)
      .where(eq(scanEvents.noteId, noteId))
      .returning({ id: scanEvents.id });
    return rows.length;
  }
}
