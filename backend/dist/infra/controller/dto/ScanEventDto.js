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
exports.SyncScanEventsDto = exports.ScanEventDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class ScanEventDto {
}
exports.ScanEventDto = ScanEventDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ScanEventDto.prototype, "clientEventId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ScanEventDto.prototype, "scannedCode", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], ScanEventDto.prototype, "scannedAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ScanEventDto.prototype, "manualItemId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ScanEventDto.prototype, "markUnidentified", void 0);
class SyncScanEventsDto {
}
exports.SyncScanEventsDto = SyncScanEventsDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(1000),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ScanEventDto),
    __metadata("design:type", Array)
], SyncScanEventsDto.prototype, "events", void 0);
//# sourceMappingURL=ScanEventDto.js.map