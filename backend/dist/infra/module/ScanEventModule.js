"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanEventModule = void 0;
const common_1 = require("@nestjs/common");
const ApplyScanEvent_1 = __importDefault(require("../../application/usecase/ApplyScanEvent"));
const SyncScanEvents_1 = __importDefault(require("../../application/usecase/SyncScanEvents"));
const ScanEventController_1 = require("../controller/ScanEventController");
let ScanEventModule = class ScanEventModule {
};
exports.ScanEventModule = ScanEventModule;
exports.ScanEventModule = ScanEventModule = __decorate([
    (0, common_1.Module)({
        controllers: [ScanEventController_1.ScanEventController],
        providers: [ApplyScanEvent_1.default, SyncScanEvents_1.default],
    })
], ScanEventModule);
//# sourceMappingURL=ScanEventModule.js.map