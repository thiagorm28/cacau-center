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
exports.NoteModule = void 0;
const common_1 = require("@nestjs/common");
const FinalizeNote_1 = __importDefault(require("../../application/usecase/FinalizeNote"));
const GetNote_1 = __importDefault(require("../../application/usecase/GetNote"));
const GetNoteReport_1 = __importDefault(require("../../application/usecase/GetNoteReport"));
const ListNoteHistory_1 = __importDefault(require("../../application/usecase/ListNoteHistory"));
const ListNotes_1 = __importDefault(require("../../application/usecase/ListNotes"));
const SearchNote_1 = __importDefault(require("../../application/usecase/SearchNote"));
const NoteController_1 = require("../controller/NoteController");
const NfeGateway_1 = __importDefault(require("../gateway/NfeGateway"));
const Env_1 = require("../util/Env");
let NoteModule = class NoteModule {
};
exports.NoteModule = NoteModule;
exports.NoteModule = NoteModule = __decorate([
    (0, common_1.Module)({
        controllers: [NoteController_1.NoteController],
        providers: [
            SearchNote_1.default,
            ListNotes_1.default,
            GetNote_1.default,
            FinalizeNote_1.default,
            GetNoteReport_1.default,
            ListNoteHistory_1.default,
            {
                provide: "NfeGateway",
                // O código da empresa é fixo por loja e nunca fica no código-fonte (ADR-011).
                useFactory: () => new NfeGateway_1.default((0, Env_1.optionalEnv)("NFE_BASE_URL", Env_1.DEFAULT_NFE_BASE_URL), (0, Env_1.requireEnv)("EMPRESA_CODE")),
            },
        ],
    })
], NoteModule);
//# sourceMappingURL=NoteModule.js.map