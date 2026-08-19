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
exports.toNoteView = void 0;
const common_1 = require("@nestjs/common");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const toNoteView = (note) => ({
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
exports.toNoteView = toNoteView;
let GetNote = class GetNote {
    constructor(unitOfWork) {
        this.unitOfWork = unitOfWork;
    }
    async execute(input) {
        const note = await this.unitOfWork.run(({ notes }) => notes.findById(input.noteId));
        if (note === null)
            throw new DomainErrors_1.NotFoundError("Nota não encontrada");
        return (0, exports.toNoteView)(note);
    }
};
GetNote = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __metadata("design:paramtypes", [Object])
], GetNote);
exports.default = GetNote;
//# sourceMappingURL=GetNote.js.map