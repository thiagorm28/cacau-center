import { Inject, Injectable } from "@nestjs/common";
import type { NoteStatus } from "../../domain/entity/InvoiceNote";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";
import { type Output as NoteView, toNoteView } from "./GetNote";

export type Input = { status?: NoteStatus };

export type Output = readonly NoteView[];

@Injectable()
export default class ListNotes {
  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  async execute(input: Input): Promise<Output> {
    const notes = await this.unitOfWork.run(({ notes: repository }) =>
      repository.list(input.status === undefined ? {} : { statuses: [input.status] }),
    );
    return notes.map(toNoteView);
  }
}
