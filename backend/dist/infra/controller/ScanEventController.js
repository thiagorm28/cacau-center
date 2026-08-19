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
exports.ScanEventController = void 0;
const common_1 = require("@nestjs/common");
const ApplyScanEvent_1 = __importDefault(require("../../application/usecase/ApplyScanEvent"));
const SyncScanEvents_1 = __importDefault(require("../../application/usecase/SyncScanEvents"));
const Roles_1 = require("../guard/Roles");
const CurrentUser_1 = require("./CurrentUser");
const ScanEventDto_1 = require("./dto/ScanEventDto");
let ScanEventController = class ScanEventController {
    constructor(applyScanEvent, syncScanEvents) {
        this.applyScanEvent = applyScanEvent;
        this.syncScanEvents = syncScanEvents;
    }
    apply(body, user) {
        return this.applyScanEvent.execute({
            clientEventId: body.clientEventId,
            scannedCode: body.scannedCode,
            scannedAt: body.scannedAt,
            operatorId: user.userId,
            ...(body.manualItemId === undefined ? {} : { manualItemId: body.manualItemId }),
            ...(body.markUnidentified === undefined
                ? {}
                : { markUnidentified: body.markUnidentified }),
        });
    }
    sync(body, user) {
        return this.syncScanEvents.execute({ operatorId: user.userId, events: body.events });
    }
};
exports.ScanEventController = ScanEventController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, CurrentUser_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ScanEventDto_1.ScanEventDto, Object]),
    __metadata("design:returntype", void 0)
], ScanEventController.prototype, "apply", null);
__decorate([
    (0, common_1.Post)("sync"),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, CurrentUser_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ScanEventDto_1.SyncScanEventsDto, Object]),
    __metadata("design:returntype", void 0)
], ScanEventController.prototype, "sync", null);
exports.ScanEventController = ScanEventController = __decorate([
    (0, Roles_1.Roles)("operador"),
    (0, common_1.Controller)("scan-events"),
    __param(0, (0, common_1.Inject)(ApplyScanEvent_1.default)),
    __param(1, (0, common_1.Inject)(SyncScanEvents_1.default)),
    __metadata("design:paramtypes", [ApplyScanEvent_1.default,
        SyncScanEvents_1.default])
], ScanEventController);
//# sourceMappingURL=ScanEventController.js.map