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
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const DivergenceReport_1 = require("../../domain/service/DivergenceReport");
let GetNoteReport = class GetNoteReport {
    constructor(unitOfWork) {
        this.unitOfWork = unitOfWork;
    }
    execute(input) {
        return this.unitOfWork.run(async ({ notes, scanEvents }) => {
            const note = await notes.findById(input.noteId);
            if (note === null)
                throw new DomainErrors_1.NotFoundError("Nota não encontrada");
            // O relatório final só existe depois da finalização (US-017 EC-2).
            if (note.isOpen())
                throw new DomainErrors_1.ConflictError("Nota ainda está em conferência");
            return (0, DivergenceReport_1.buildDivergenceReport)(note, await scanEvents.listByNoteId(note.noteId));
        });
    }
};
GetNoteReport = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __metadata("design:paramtypes", [Object])
], GetNoteReport);
exports.default = GetNoteReport;
//# sourceMappingURL=GetNoteReport.js.map