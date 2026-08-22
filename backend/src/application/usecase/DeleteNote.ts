import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConflictError, NotFoundError } from "../../domain/error/DomainErrors";
import type { Repositories, UnitOfWork } from "../../infra/database/UnitOfWork";

export type Input = { noteId: string; operatorId: string };

export type Output = { noteId: string };

@Injectable()
export default class DeleteNote {
  private readonly logger = new Logger(DeleteNote.name);

  constructor(@Inject("UnitOfWork") private readonly unitOfWork: UnitOfWork) {}

  execute(input: Input): Promise<Output> {
    return this.unitOfWork.run((repositories) => this.deleteWithin(repositories, input));
  }

  /**
   * Exclusão definitiva (ADR-001) orquestrada aqui, não por `ON DELETE CASCADE` (ADR-004):
   * as três tabelas caem na ordem imposta pelas FKs existentes — `scan_events`, depois
   * `note_items` e `invoice_notes` (as duas últimas dentro de `notes.delete`). Tudo na
   * mesma transação: qualquer falha reverte o conjunto, nunca deixa exclusão parcial.
   */
  private async deleteWithin(repositories: Repositories, input: Input): Promise<Output> {
    const note = await repositories.notes.findById(input.noteId);
    if (note === null) throw new NotFoundError("Nota não encontrada");
    if (!note.isOpen()) throw new ConflictError("Nota não está mais em conferência");
    await repositories.scanEvents.deleteByNoteId(note.noteId);
    await repositories.notes.delete(note.noteId);
    // Único rastro que sobra da nota: nada é retido para auditoria (ADR-001), por isso
    // o log precisa registrar também quem executou a exclusão.
    this.logger.log(`Nota ${note.noteId} excluída em conferência por ${input.operatorId}`);
    return { noteId: note.noteId };
  }
}
