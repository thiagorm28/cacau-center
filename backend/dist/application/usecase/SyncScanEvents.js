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
var SyncScanEvents_1;
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const ApplyScanEvent_1 = __importDefault(require("./ApplyScanEvent"));
let SyncScanEvents = SyncScanEvents_1 = class SyncScanEvents {
    constructor(unitOfWork, applyScanEvent) {
        this.unitOfWork = unitOfWork;
        this.applyScanEvent = applyScanEvent;
        this.logger = new common_1.Logger(SyncScanEvents_1.name);
    }
    /**
     * Aplica o lote na ordem exata do array — que é a ordem real de bipagem do único
     * dispositivo ativo (ADR-010) — uma transação por evento, idempotente por
     * `clientEventId`.
     */
    async execute(input) {
        let applied = 0;
        let duplicates = 0;
        for (const event of input.events) {
            const result = await this.unitOfWork.run((repositories) => this.applyScanEvent.applyWithin(repositories, {
                clientEventId: event.clientEventId,
                scannedCode: event.scannedCode,
                scannedAt: event.scannedAt,
                operatorId: input.operatorId,
                ...(event.manualItemId === undefined ? {} : { manualItemId: event.manualItemId }),
                ...(event.markUnidentified === undefined
                    ? {}
                    : { markUnidentified: event.markUnidentified }),
            }));
            if (result.duplicate)
                duplicates += 1;
            else
                applied += 1;
        }
        this.logger.log(`Lote sincronizado: applied=${applied} duplicates=${duplicates}`);
        return { applied, duplicates };
    }
};
SyncScanEvents = SyncScanEvents_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __param(1, (0, common_1.Inject)(ApplyScanEvent_1.default)),
    __metadata("design:paramtypes", [Object, ApplyScanEvent_1.default])
], SyncScanEvents);
exports.default = SyncScanEvents;
//# sourceMappingURL=SyncScanEvents.js.map