import { Inject, Injectable } from "@nestjs/common";
import { ConflictError, NotFoundError } from "../../domain/error/DomainErrors";
import {
  type DivergenceReport,
  buildDivergenceReport,
} from "../../domain/service/DivergenceReport";
import type { UnitOfWork } from "../../infra/database/UnitOfWork";

export type Input = { noteId: string };

export type Output = DivergenceReport;

@Injectable()
export default class GetNoteReport {
  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  execute(input: Input): Promise<Output> {
    return this.unitOfWork.run(async ({ notes, scanEvents }) => {
      const note = await notes.findById(input.noteId);
      if (note === null) throw new NotFoundError("Nota não encontrada");
      // O relatório final só existe depois da finalização (US-017 EC-2).
      if (note.isOpen()) throw new ConflictError("Nota ainda está em conferência");
      return buildDivergenceReport(note, await scanEvents.listByNoteId(note.noteId));
    });
  }
}
