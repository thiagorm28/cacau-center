import { randomUUID } from "node:crypto";
import InvoiceNote, { type NoteStatus } from "../../src/domain/entity/InvoiceNote";
import NoteItem from "../../src/domain/entity/NoteItem";
import ScanEvent, { type ScanEventResult } from "../../src/domain/entity/ScanEvent";
import type { Repositories, UnitOfWork } from "../../src/infra/database/UnitOfWork";
import type {
  NewNoteInput,
  NoteFilter,
  NoteRepository,
} from "../../src/infra/repository/NoteRepository";
import type {
  NewScanEventInput,
  ScanEventRepository,
} from "../../src/infra/repository/ScanEventRepository";
import type { UserRecord, UserRepository } from "../../src/infra/repository/UserRepository";

type ItemRecord = {
  itemId: string;
  cProd: string;
  cEan: string | null;
  description: string;
  unit: string;
  expectedQty: number;
  confirmedQty: number;
};

type NoteRecord = {
  noteId: string;
  invoiceNumber: string;
  nfeChaveAcesso: string;
  nfeNumero: string;
  supplierCnpj: string;
  supplierName: string;
  status: NoteStatus;
  openedBy: string;
  openedAt: Date;
  closedBy: string | null;
  closedAt: Date | null;
  items: ItemRecord[];
};

type ScanEventRecord = {
  scanEventId: string;
  clientEventId: string;
  scannedCode: string;
  result: ScanEventResult;
  noteId: string | null;
  noteItemId: string | null;
  scannedBy: string;
  scannedAt: Date;
};

/**
 * Substitutos em memória dos repositórios reais, usados nos testes de unidade dos casos
 * de uso. Reconstroem a entidade a cada leitura, como o banco faria — mutações feitas
 * numa entidade carregada não vazam para a leitura seguinte sem passar por um `update`.
 */
export class InMemoryNoteRepository implements NoteRepository {
  readonly records: NoteRecord[] = [];

  private toEntity(record: NoteRecord): InvoiceNote {
    return new InvoiceNote(
      record.noteId,
      record.invoiceNumber,
      record.nfeChaveAcesso,
      record.nfeNumero,
      record.supplierCnpj,
      record.supplierName,
      record.status,
      record.openedBy,
      record.openedAt,
      record.closedBy,
      record.closedAt,
      record.items.map(
        (item) =>
          new NoteItem(
            item.itemId,
            item.cProd,
            item.cEan,
            item.description,
            item.unit,
            item.expectedQty,
            item.confirmedQty,
          ),
      ),
    );
  }

  async create(input: NewNoteInput): Promise<InvoiceNote> {
    const record: NoteRecord = {
      noteId: randomUUID(),
      invoiceNumber: input.invoiceNumber,
      nfeChaveAcesso: input.nfeChaveAcesso,
      nfeNumero: input.nfeNumero,
      supplierCnpj: input.supplierCnpj,
      supplierName: input.supplierName,
      status: "open",
      openedBy: input.openedBy,
      openedAt: new Date(),
      closedBy: null,
      closedAt: null,
      items: input.items.map((item) => ({
        itemId: randomUUID(),
        cProd: item.cProd,
        cEan: item.cEan,
        description: item.description,
        unit: item.unit,
        expectedQty: item.expectedQty,
        confirmedQty: 0,
      })),
    };
    this.records.push(record);
    return this.toEntity(record);
  }

  async findById(noteId: string): Promise<InvoiceNote | null> {
    const record = this.records.find((candidate) => candidate.noteId === noteId);
    return record === undefined ? null : this.toEntity(record);
  }

  /**
   * Sem efeito: o lock só existe no Postgres. Os testes de unidade cobrem a *ordem* das
   * chamadas do caso de uso; a serialização real de duas requisições concorrentes é
   * verificada no teste de integração contra o banco.
   */
  async lockInvoiceNumber(_invoiceNumber: string): Promise<void> {}

  async hasOpenWithInvoiceNumber(invoiceNumber: string): Promise<boolean> {
    return this.records.some(
      (record) => record.invoiceNumber === invoiceNumber && record.status === "open",
    );
  }

  listOpen(): Promise<InvoiceNote[]> {
    return this.list({ statuses: ["open"] });
  }

  async list(filter: NoteFilter): Promise<InvoiceNote[]> {
    return this.records
      .filter((record) => filter.statuses === undefined || filter.statuses.includes(record.status))
      .filter((record) => filter.closedFrom === undefined || (record.closedAt ?? new Date(0)) >= filter.closedFrom)
      .filter((record) => filter.closedTo === undefined || (record.closedAt ?? new Date(0)) <= filter.closedTo)
      .map((record) => this.toEntity(record));
  }

  /** Guarda a quantidade esperada como o `UPDATE ... WHERE confirmed_qty < expected_qty` real. */
  async incrementConfirmedQty(itemId: string): Promise<boolean> {
    for (const record of this.records) {
      const item = record.items.find((candidate) => candidate.itemId === itemId);
      if (item === undefined) continue;
      if (item.confirmedQty >= item.expectedQty) return false;
      item.confirmedQty += 1;
      return true;
    }
    return false;
  }

  async close(
    noteId: string,
    status: NoteStatus,
    closedBy: string,
    closedAt: Date,
  ): Promise<void> {
    const record = this.records.find((candidate) => candidate.noteId === noteId);
    if (record === undefined) return;
    record.status = status;
    record.closedBy = closedBy;
    record.closedAt = closedAt;
  }
}

export class InMemoryScanEventRepository implements ScanEventRepository {
  readonly records: ScanEventRecord[] = [];

  private toEntity(record: ScanEventRecord): ScanEvent {
    return new ScanEvent(
      record.scanEventId,
      record.clientEventId,
      record.scannedCode,
      record.result,
      record.noteId,
      record.noteItemId,
      record.scannedBy,
      record.scannedAt,
    );
  }

  async findByClientEventId(clientEventId: string): Promise<ScanEvent | null> {
    const record = this.records.find((candidate) => candidate.clientEventId === clientEventId);
    return record === undefined ? null : this.toEntity(record);
  }

  async create(input: NewScanEventInput): Promise<ScanEvent> {
    const record: ScanEventRecord = { scanEventId: randomUUID(), ...input };
    this.records.push(record);
    return this.toEntity(record);
  }

  async listByNoteId(noteId: string): Promise<ScanEvent[]> {
    return this.records
      .filter((record) => record.noteId === noteId)
      .map((record) => this.toEntity(record));
  }

  async claimUnidentified(noteId: string): Promise<number> {
    const claimed = this.records.filter(
      (record) => record.result === "unidentified" && record.noteId === null,
    );
    for (const record of claimed) record.noteId = noteId;
    return claimed.length;
  }
}

export class InMemoryUserRepository implements UserRepository {
  readonly records: UserRecord[] = [];

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.records.find((record) => record.email === email) ?? null;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    return this.records.find((record) => record.userId === userId) ?? null;
  }

  async findByIds(userIds: readonly string[]): Promise<UserRecord[]> {
    return this.records.filter((record) => userIds.includes(record.userId));
  }
}

/** `UnitOfWork` sem transação real: entrega sempre o mesmo conjunto de repositórios. */
export class FakeUnitOfWork implements UnitOfWork {
  readonly notes = new InMemoryNoteRepository();
  readonly scanEvents = new InMemoryScanEventRepository();
  readonly users = new InMemoryUserRepository();

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return work({ notes: this.notes, scanEvents: this.scanEvents, users: this.users });
  }
}
