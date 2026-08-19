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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var NfeGatewayHttp_1;
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const fast_xml_parser_1 = require("fast-xml-parser");
const DomainErrors_1 = require("../../domain/error/DomainErrors");
/** O XML da NFe usa "SEM GTIN" quando o fornecedor não informa EAN/GTIN (ADR-002). */
const NO_GTIN = "SEM GTIN";
const asText = (value) => {
    if (value === null || value === undefined)
        return "";
    if (typeof value === "object" && "#text" in value) {
        return String(value["#text"]);
    }
    return String(value);
};
const asArray = (value) => {
    if (value === undefined)
        return [];
    return Array.isArray(value) ? value : [value];
};
const parseGtin = (raw) => {
    const value = asText(raw).trim();
    if (value === "" || value.toUpperCase() === NO_GTIN)
        return null;
    return value;
};
/** `Id` do `infNFe` vem como `NFe<44 dígitos>`; a chave de acesso é a parte numérica. */
const parseChaveAcesso = (rawId) => asText(rawId).replace(/^NFe/i, "").trim();
/**
 * A API da NFe não tem contrato de erro garantido: quando `qCom` vem ausente, vazia ou
 * não numérica, um `NaN` atravessaria as guardas do domínio (`NaN <= 0` é `false`) e o
 * item sumiria das checagens de pendência e do relatório de divergência — a nota
 * fecharia como completa com uma caixa que ninguém conferiu. Barramos na fronteira.
 *
 * `Number` em vez de `parseFloat` de propósito: `parseFloat("8,5")` devolveria `8`
 * silenciosamente, trocando a quantidade por outra plausível.
 */
const parseQuantidade = (raw, itemRef) => {
    const text = asText(raw).trim();
    const value = Number(text);
    if (!Number.isFinite(value) || value <= 0) {
        throw new DomainErrors_1.NfeServiceUnavailableError(`Nota fiscal com dados inválidos: quantidade "${text}" no item ${itemRef}`);
    }
    return value;
};
/** Sem `cProd` não há como casar a bipagem com o item esperado (ADR-002). */
const parseCProd = (raw, itemRef) => {
    const value = asText(raw).trim();
    if (value === "") {
        throw new DomainErrors_1.NfeServiceUnavailableError(`Nota fiscal com dados inválidos: código do produto ausente no item ${itemRef}`);
    }
    return value;
};
let NfeGatewayHttp = NfeGatewayHttp_1 = class NfeGatewayHttp {
    constructor(baseUrl, empresaCode, http = axios_1.default.create({ timeout: 15000 })) {
        this.baseUrl = baseUrl;
        this.empresaCode = empresaCode;
        this.http = http;
        this.logger = new common_1.Logger(NfeGatewayHttp_1.name);
        this.parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            parseTagValue: false,
            trimValues: true,
        });
    }
    async fetchByInvoiceNumber(invoiceNumber) {
        const rawXml = await this.request(invoiceNumber);
        return this.parse(rawXml);
    }
    async request(invoiceNumber) {
        const startedAt = Date.now();
        try {
            const response = await this.http.get(`${this.baseUrl}/ConsultaNotaFiscal/GerarXML`, {
                params: { empresa: this.empresaCode, documento: invoiceNumber },
                responseType: "text",
                transformResponse: [(data) => data],
            });
            this.logger.log(`NfeGateway documento=${invoiceNumber} ok em ${Date.now() - startedAt}ms`);
            return typeof response.data === "string" ? response.data : String(response.data);
        }
        catch (error) {
            this.logger.error(`NfeGateway documento=${invoiceNumber} falhou em ${Date.now() - startedAt}ms: ${error instanceof Error ? error.message : String(error)}`);
            throw new DomainErrors_1.NfeServiceUnavailableError("Serviço de consulta de nota fiscal indisponível");
        }
    }
    parse(rawXml) {
        const parsed = this.parser.parse(rawXml);
        const infNFe = parsed?.nfeProc?.NFe?.infNFe;
        if (infNFe === undefined || infNFe === null) {
            throw new DomainErrors_1.NfeNotFoundError("Nota fiscal não encontrada");
        }
        const dets = asArray(infNFe.det);
        return {
            chaveAcesso: parseChaveAcesso(infNFe["@_Id"]),
            numeroNota: asText(infNFe.ide?.nNF).trim(),
            fornecedorCnpj: asText(infNFe.emit?.CNPJ).trim(),
            fornecedorNome: asText(infNFe.emit?.xNome).trim(),
            items: dets.map((det, index) => {
                const prod = det?.prod ?? {};
                const itemRef = asText(det?.["@_nItem"]).trim() || String(index + 1);
                return {
                    cProd: parseCProd(prod.cProd, itemRef),
                    cEan: parseGtin(prod.cEAN) ?? parseGtin(prod.cEANTrib),
                    descricao: asText(prod.xProd).trim(),
                    unidade: asText(prod.uCom).trim(),
                    quantidade: parseQuantidade(prod.qCom, itemRef),
                };
            }),
            rawXml,
        };
    }
};
NfeGatewayHttp = NfeGatewayHttp_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [String, String, Function])
], NfeGatewayHttp);
exports.default = NfeGatewayHttp;
//# sourceMappingURL=NfeGateway.js.map