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
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const DivergenceReport_1 = require("../../domain/service/DivergenceReport");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
let FinalizeNote = class FinalizeNote {
    constructor(unitOfWork) {
        this.unitOfWork = unitOfWork;
    }
    execute(input) {
        return this.unitOfWork.run((repositories) => this.finalizeWithin(repositories, input));
    }
    async finalizeWithin(repositories, input) {
        const note = await repositories.notes.findById(input.noteId);
        if (note === null)
            throw new DomainErrors_1.NotFoundError("Nota não encontrada");
        const closedAt = new Date();
        if (note.isOpen()) {
            if (note.hasPendingItems() && input.confirmIncomplete !== true) {
                throw new DomainErrors_1.ConflictError("Itens pendentes: confirme para finalizar mesmo assim");
            }
            if (note.hasPendingItems()) {
                note.markClosedIncomplete(input.operatorId, closedAt);
                await repositories.notes.close(note.noteId, "closed_incomplete", input.operatorId, closedAt);
            }
            else {
                note.markCompleted();
                note.close(input.operatorId, closedAt);
                await repositories.notes.close(note.noteId, "completed", input.operatorId, closedAt);
            }
            await repositories.scanEvents.claimUnidentified(note.noteId);
        }
        else if (note.getClosedAt() === null) {
            // Nota concluída automaticamente ao atingir 100% (US-010): o fechamento explícito
            // ainda não aconteceu, então é esta finalização que reivindica as caixas não
            // identificadas em aberto (US-010 EC-2).
            note.close(input.operatorId, closedAt);
            await repositories.notes.close(note.noteId, note.getStatus(), input.operatorId, closedAt);
            await repositories.scanEvents.claimUnidentified(note.noteId);
        }
        const events = await repositories.scanEvents.listByNoteId(note.noteId);
        const status = note.getStatus();
        if (status === "open")
            throw new Error("Nota permaneceu aberta após a finalização");
        return { status, report: (0, DivergenceReport_1.buildDivergenceReport)(note, events) };
    }
};
FinalizeNote = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __metadata("design:paramtypes", [Object])
], FinalizeNote);
exports.default = FinalizeNote;
//# sourceMappingURL=FinalizeNote.js.map