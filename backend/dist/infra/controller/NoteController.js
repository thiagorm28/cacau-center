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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteController = void 0;
const common_1 = require("@nestjs/common");
const FinalizeNote_1 = __importDefault(require("../../application/usecase/FinalizeNote"));
const GetNote_1 = __importDefault(require("../../application/usecase/GetNote"));
const GetNoteReport_1 = __importDefault(require("../../application/usecase/GetNoteReport"));
const ListNoteHistory_1 = __importDefault(require("../../application/usecase/ListNoteHistory"));
const ListNotes_1 = __importDefault(require("../../application/usecase/ListNotes"));
const SearchNote_1 = __importDefault(require("../../application/usecase/SearchNote"));
const DomainErrors_1 = require("../../domain/error/DomainErrors");
const Roles_1 = require("../guard/Roles");
const CurrentUser_1 = require("./CurrentUser");
const NoteDto_1 = require("./dto/NoteDto");
/** Um id fora do formato UUID nunca corresponde a uma nota — responde 404, não 400. */
const noteIdParam = () => new common_1.ParseUUIDPipe({ exceptionFactory: () => new DomainErrors_1.NotFoundError("Nota não encontrada") });
let NoteController = class NoteController {
    constructor(searchNote, listNotes, getNote, finalizeNote, getNoteReport, listNoteHistory) {
        this.searchNote = searchNote;
        this.listNotes = listNotes;
        this.getNote = getNote;
        this.finalizeNote = finalizeNote;
        this.getNoteReport = getNoteReport;
        this.listNoteHistory = listNoteHistory;
    }
    create(body, user) {
        return this.searchNote.execute({
            invoiceNumber: body.invoiceNumber,
            operatorId: user.userId,
        });
    }
    list(query) {
        return this.listNotes.execute(query.status === undefined ? {} : { status: query.status });
    }
    // Precisa vir antes de `:id`, senão "history" seria capturado como um id de nota.
    history(query) {
        return this.listNoteHistory.execute({
            ...(query.status === undefined ? {} : { status: query.status }),
            ...(query.from === undefined ? {} : { from: query.from }),
            ...(query.to === undefined ? {} : { to: query.to }),
        });
    }
    detail(noteId) {
        return this.getNote.execute({ noteId });
    }
    finalize(noteId, body, user) {
        return this.finalizeNote.execute({
            noteId,
            operatorId: user.userId,
            confirmIncomplete: body.confirmIncomplete === true,
        });
    }
    report(noteId) {
        return this.getNoteReport.execute({ noteId });
    }
};
exports.NoteController = NoteController;
__decorate([
    (0, Roles_1.Roles)("operador"),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, CurrentUser_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [NoteDto_1.CreateNoteDto, Object]),
    __metadata("design:returntype", void 0)
], NoteController.prototype, "create", null);
__decorate([
    (0, Roles_1.Roles)("operador"),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [NoteDto_1.ListNotesQueryDto]),
    __metadata("design:returntype", void 0)
], NoteController.prototype, "list", null);
__decorate([
    (0, Roles_1.Roles)("gerente"),
    (0, common_1.Get)("history"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [NoteDto_1.NoteHistoryQueryDto]),
    __metadata("design:returntype", void 0)
], NoteController.prototype, "history", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", noteIdParam())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NoteController.prototype, "detail", null);
__decorate([
    (0, Roles_1.Roles)("operador"),
    (0, common_1.Post)(":id/finalize"),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)("id", noteIdParam())),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, CurrentUser_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, NoteDto_1.FinalizeNoteDto, Object]),
    __metadata("design:returntype", void 0)
], NoteController.prototype, "finalize", null);
__decorate([
    (0, common_1.Get)(":id/report"),
    __param(0, (0, common_1.Param)("id", noteIdParam())),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NoteController.prototype, "report", null);
exports.NoteController = NoteController = __decorate([
    (0, common_1.Controller)("notes"),
    __param(0, (0, common_1.Inject)(SearchNote_1.default)),
    __param(1, (0, common_1.Inject)(ListNotes_1.default)),
    __param(2, (0, common_1.Inject)(GetNote_1.default)),
    __param(3, (0, common_1.Inject)(FinalizeNote_1.default)),
    __param(4, (0, common_1.Inject)(GetNoteReport_1.default)),
    __param(5, (0, common_1.Inject)(ListNoteHistory_1.default)),
    __metadata("design:paramtypes", [SearchNote_1.default,
        ListNotes_1.default,
        GetNote_1.default,
        FinalizeNote_1.default,
        GetNoteReport_1.default,
        ListNoteHistory_1.default])
], NoteController);
//# sourceMappingURL=NoteController.js.map