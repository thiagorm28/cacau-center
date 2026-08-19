import { Inject, Injectable } from "@nestjs/common";
import {
  type DivergenceReport,
  buildDivergenceReport,
} from "../../domain/service/DivergenceReport";
import { ConflictError, NotFoundError } from "../../domain/error/DomainErrors";
import type { Repositories, UnitOfWork } from "../../infra/database/UnitOfWork";

export type Input = { noteId: string; operatorId: string; confirmIncomplete: boolean };

export type Output = { status: "completed" | "closed_incomplete"; report: DivergenceReport };

@Injectable()
export default class FinalizeNote {
  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  execute(input: Input): Promise<Output> {
    return this.unitOfWork.run((repositories) => this.finalizeWithin(repositories, input));
  }

  private async finalizeWithin(
    repositories: Repositories,
    input: Input,
  ): Promise<Output> {
    const note = await repositories.notes.findById(input.noteId);
    if (note === null) throw new NotFoundError("Nota não encontrada");
    const closedAt = new Date();
    if (note.isOpen()) {
      if (note.hasPendingItems() && input.confirmIncomplete !== true) {
        throw new ConflictError("Itens pendentes: confirme para finalizar mesmo assim");
      }
      if (note.hasPendingItems()) {
        note.markClosedIncomplete(input.operatorId, closedAt);
        await repositories.notes.close(
          note.noteId,
          "closed_incomplete",
          input.operatorId,
          closedAt,
        );
      } else {
        note.markCompleted();
        note.close(input.operatorId, closedAt);
        await repositories.notes.close(note.noteId, "completed", input.operatorId, closedAt);
      }
      await repositories.scanEvents.claimUnidentified(note.noteId);
    } else if (note.getClosedAt() === null) {
      // Nota concluída automaticamente ao atingir 100% (US-010): o fechamento explícito
      // ainda não aconteceu, então é esta finalização que reivindica as caixas não
      // identificadas em aberto (US-010 EC-2).
      note.close(input.operatorId, closedAt);
      await repositories.notes.close(
        note.noteId,
        note.getStatus(),
        input.operatorId,
        closedAt,
      );
      await repositories.scanEvents.claimUnidentified(note.noteId);
    }
    const events = await repositories.scanEvents.listByNoteId(note.noteId);
    const status = note.getStatus();
    if (status === "open") throw new Error("Nota permaneceu aberta após a finalização");
    return { status, report: buildDivergenceReport(note, events) };
  }
}
