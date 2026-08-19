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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteHistoryQueryDto = exports.ListNotesQueryDto = exports.FinalizeNoteDto = exports.CreateNoteDto = void 0;
const class_validator_1 = require("class-validator");
const NOTE_STATUSES = ["open", "completed", "closed_incomplete"];
class CreateNoteDto {
}
exports.CreateNoteDto = CreateNoteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d+$/, { message: "invoiceNumber deve conter apenas dígitos" }),
    __metadata("design:type", String)
], CreateNoteDto.prototype, "invoiceNumber", void 0);
class FinalizeNoteDto {
}
exports.FinalizeNoteDto = FinalizeNoteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FinalizeNoteDto.prototype, "confirmIncomplete", void 0);
class ListNotesQueryDto {
}
exports.ListNotesQueryDto = ListNotesQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(NOTE_STATUSES),
    __metadata("design:type", String)
], ListNotesQueryDto.prototype, "status", void 0);
class NoteHistoryQueryDto {
}
exports.NoteHistoryQueryDto = NoteHistoryQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(["completed", "closed_incomplete"]),
    __metadata("design:type", Object)
], NoteHistoryQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], NoteHistoryQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], NoteHistoryQueryDto.prototype, "to", void 0);
//# sourceMappingURL=NoteDto.js.map