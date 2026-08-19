import { Inject, Injectable } from "@nestjs/common";
import type { NoteStatus } from "../../domain/entity/InvoiceNote";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";

export type Input = { status?: NoteStatus; from?: string; to?: string };

export type HistoryEntry = {
  noteId: string;
  invoiceNumber: string;
  supplierName: string;
  status: NoteStatus;
  openedAt: string;
  closedAt: string | null;
  openedByName: string | null;
  closedByName: string | null;
  expectedTotal: number;
  confirmedTotal: number;
  missingTotal: number;
};

export type Output = readonly HistoryEntry[];

const FINALIZED: readonly NoteStatus[] = ["completed", "closed_incomplete"];

@Injectable()
export default class ListNoteHistory {
  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  execute(input: Input): Promise<Output> {
    return this.unitOfWork.run(async ({ notes, users }) => {
      const statuses = input.status === undefined ? FINALIZED : [input.status];
      const list = await notes.list({
        statuses: statuses.filter((status) => FINALIZED.includes(status)),
        ...(input.from === undefined ? {} : { closedFrom: new Date(input.from) }),
        ...(input.to === undefined ? {} : { closedTo: new Date(input.to) }),
      });
      const userIds = [
        ...new Set(
          list.flatMap((note) => [note.openedBy, note.getClosedBy()]).filter((id) => id !== null),
        ),
      ];
      const names = new Map(
        (await users.findByIds(userIds)).map((user) => [user.userId, user.name]),
      );
      return list.map((note) => ({
        noteId: note.noteId,
        invoiceNumber: note.invoiceNumber,
        supplierName: note.supplierName,
        status: note.getStatus(),
        openedAt: note.openedAt.toISOString(),
        closedAt: note.getClosedAt()?.toISOString() ?? null,
        openedByName: names.get(note.openedBy) ?? null,
        closedByName: names.get(note.getClosedBy() ?? "") ?? null,
        expectedTotal: note.items.reduce((total, item) => total + item.expectedQty, 0),
        confirmedTotal: note.items.reduce((total, item) => total + item.getConfirmedQty(), 0),
        missingTotal: note.items.reduce((total, item) => total + item.getMissingQty(), 0),
      }));
    });
  }
}
