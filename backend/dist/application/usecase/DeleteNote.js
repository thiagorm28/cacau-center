"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DeleteNote_1;
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
let DeleteNote = DeleteNote_1 = class DeleteNote {
    constructor(unitOfWork) {
        this.unitOfWork = unitOfWork;
        this.logger = new common_1.Logger(DeleteNote_1.name);
    }
    execute(input) {
        return this.unitOfWork.run((repositories) => this.deleteWithin(repositories, input));
    }
    /**
     * Exclusão definitiva (ADR-001) orquestrada aqui, não por `ON DELETE CASCADE` (ADR-004):
     * as três tabelas caem na ordem imposta pelas FKs existentes — `scan_events`, depois
     * `note_items` e `invoice_notes` (as duas últimas dentro de `notes.delete`). Tudo na
     * mesma transação: qualquer falha reverte o conjunto, nunca deixa exclusão parcial.
     */
    async deleteWithin(repositories, input) {
        const note = await repositories.notes.findById(input.noteId);
        if (note === null)
            throw new DomainErrors_1.NotFoundError("Nota não encontrada");
        if (!note.isOpen())
            throw new DomainErrors_1.ConflictError("Nota não está mais em conferência");
        await repositories.scanEvents.deleteByNoteId(note.noteId);
        await repositories.notes.delete(note.noteId);
        // Único rastro que sobra da nota: nada é retido para auditoria (ADR-001), por isso
        // o log precisa registrar também quem executou a exclusão.
        this.logger.log(`Nota ${note.noteId} excluída em conferência por ${input.operatorId}`);
        return { noteId: note.noteId };
    }
};
DeleteNote = DeleteNote_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __metadata("design:paramtypes", [Object])
], DeleteNote);
exports.default = DeleteNote;
//# sourceMappingURL=DeleteNote.js.map