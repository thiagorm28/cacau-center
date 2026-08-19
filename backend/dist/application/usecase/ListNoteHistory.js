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
const FINALIZED = ["completed", "closed_incomplete"];
let ListNoteHistory = class ListNoteHistory {
    constructor(unitOfWork) {
        this.unitOfWork = unitOfWork;
    }
    execute(input) {
        return this.unitOfWork.run(async ({ notes, users }) => {
            const statuses = input.status === undefined ? FINALIZED : [input.status];
            const list = await notes.list({
                statuses: statuses.filter((status) => FINALIZED.includes(status)),
                ...(input.from === undefined ? {} : { closedFrom: new Date(input.from) }),
                ...(input.to === undefined ? {} : { closedTo: new Date(input.to) }),
            });
            const userIds = [
                ...new Set(list.flatMap((note) => [note.openedBy, note.getClosedBy()]).filter((id) => id !== null)),
            ];
            const names = new Map((await users.findByIds(userIds)).map((user) => [user.userId, user.name]));
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
};
ListNoteHistory = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __metadata("design:paramtypes", [Object])
], ListNoteHistory);
exports.default = ListNoteHistory;
//# sourceMappingURL=ListNoteHistory.js.map