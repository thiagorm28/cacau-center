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
let SearchNote = class SearchNote {
    constructor(unitOfWork, nfeGateway) {
        this.unitOfWork = unitOfWork;
        this.nfeGateway = nfeGateway;
    }
    async execute(input) {
        const duplicated = await this.unitOfWork.run(({ notes }) => notes.hasOpenWithInvoiceNumber(input.invoiceNumber));
        if (duplicated)
            throw new DomainErrors_1.ConflictError("Nota já está em conferência");
        const nfe = await this.nfeGateway.fetchByInvoiceNumber(input.invoiceNumber);
        const note = await this.unitOfWork.run(async ({ notes }) => {
            // O lock precede a checagem: sem ele, duas requisições concorrentes para o mesmo
            // número leem "não existe" antes de qualquer INSERT commitar e abrem duas notas.
            await notes.lockInvoiceNumber(input.invoiceNumber);
            // Segunda checagem dentro da transação: a chamada externa acontece fora dela e
            // outra requisição pode ter aberto a mesma nota nesse intervalo.
            if (await notes.hasOpenWithInvoiceNumber(input.invoiceNumber)) {
                throw new DomainErrors_1.ConflictError("Nota já está em conferência");
            }
            return notes.create({
                invoiceNumber: input.invoiceNumber,
                nfeChaveAcesso: nfe.chaveAcesso,
                nfeNumero: nfe.numeroNota,
                supplierCnpj: nfe.fornecedorCnpj,
                supplierName: nfe.fornecedorNome,
                rawXml: nfe.rawXml,
                openedBy: input.operatorId,
                items: nfe.items.map((item) => ({
                    cProd: item.cProd,
                    cEan: item.cEan,
                    description: item.descricao,
                    unit: item.unidade,
                    expectedQty: item.quantidade,
                })),
            });
        });
        return {
            noteId: note.noteId,
            status: note.getStatus(),
            items: note.items.map((item) => ({
                itemId: item.itemId,
                description: item.description,
                expectedQty: item.expectedQty,
                confirmedQty: item.getConfirmedQty(),
            })),
        };
    }
};
SearchNote = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)("UnitOfWork")),
    __param(1, (0, common_1.Inject)("NfeGateway")),
    __metadata("design:paramtypes", [Object, Object])
], SearchNote);
exports.default = SearchNote;
//# sourceMappingURL=SearchNote.js.map