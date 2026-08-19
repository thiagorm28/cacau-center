import { Inject, Injectable } from "@nestjs/common";
import type InvoiceNote from "../../domain/entity/InvoiceNote";
import type { NoteStatus } from "../../domain/entity/InvoiceNote";
import { NotFoundError } from "../../domain/error/DomainErrors";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";

export type Input = { noteId: string };

export type NoteItemView = {
  itemId: string;
  cProd: string;
  cEan: string | null;
  description: string;
  unit: string;
  expectedQty: number;
  confirmedQty: number;
  missingQty: number;
};

export type Output = {
  noteId: string;
  invoiceNumber: string;
  nfeChaveAcesso: string;
  nfeNumero: string;
  supplierCnpj: string;
  supplierName: string;
  status: NoteStatus;
  openedAt: string;
  closedAt: string | null;
  expectedTotal: number;
  confirmedTotal: number;
  items: readonly NoteItemView[];
};

export const toNoteView = (note: InvoiceNote): Output => ({
  noteId: note.noteId,
  invoiceNumber: note.invoiceNumber,
  nfeChaveAcesso: note.nfeChaveAcesso,
  nfeNumero: note.nfeNumero,
  supplierCnpj: note.supplierCnpj,
  supplierName: note.supplierName,
  status: note.getStatus(),
  openedAt: note.openedAt.toISOString(),
  closedAt: note.getClosedAt()?.toISOString() ?? null,
  expectedTotal: note.items.reduce((total, item) => total + item.expectedQty, 0),
  confirmedTotal: note.items.reduce((total, item) => total + item.getConfirmedQty(), 0),
  items: note.items.map((item) => ({
    itemId: item.itemId,
    cProd: item.cProd,
    cEan: item.cEan,
    description: item.description,
    unit: item.unit,
    expectedQty: item.expectedQty,
    confirmedQty: item.getConfirmedQty(),
    missingQty: item.getMissingQty(),
  })),
});

@Injectable()
export default class GetNote {
  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  async execute(input: Input): Promise<Output> {
    const note = await this.unitOfWork.run(({ notes }) => notes.findById(input.noteId));
    if (note === null) throw new NotFoundError("Nota não encontrada");
    return toNoteView(note);
  }
}
