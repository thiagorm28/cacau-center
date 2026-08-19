import { Injectable, Logger } from "@nestjs/common";
import axios, { type AxiosInstance } from "axios";
import { XMLParser } from "fast-xml-parser";
import {
  NfeNotFoundError,
  NfeServiceUnavailableError,
} from "../../domain/error/DomainErrors";

export interface NfeXmlData {
  chaveAcesso: string;
  numeroNota: string;
  fornecedorCnpj: string;
  fornecedorNome: string;
  items: ReadonlyArray<{
    cProd: string;
    cEan: string | null;
    descricao: string;
    unidade: string;
    quantidade: number;
  }>;
  rawXml: string;
}

export interface NfeGateway {
  fetchByInvoiceNumber(invoiceNumber: string): Promise<NfeXmlData>;
}

/** O XML da NFe usa "SEM GTIN" quando o fornecedor não informa EAN/GTIN (ADR-002). */
const NO_GTIN = "SEM GTIN";

const asText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "#text" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)["#text"]);
  }
  return String(value);
};

const asArray = <T>(value: T | readonly T[] | undefined): readonly T[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value as T];
};

const parseGtin = (raw: unknown): string | null => {
  const value = asText(raw).trim();
  if (value === "" || value.toUpperCase() === NO_GTIN) return null;
  return value;
};

/** `Id` do `infNFe` vem como `NFe<44 dígitos>`; a chave de acesso é a parte numérica. */
const parseChaveAcesso = (rawId: unknown): string => asText(rawId).replace(/^NFe/i, "").trim();

/**
 * A API da NFe não tem contrato de erro garantido: quando `qCom` vem ausente, vazia ou
 * não numérica, um `NaN` atravessaria as guardas do domínio (`NaN <= 0` é `false`) e o
 * item sumiria das checagens de pendência e do relatório de divergência — a nota
 * fecharia como completa com uma caixa que ninguém conferiu. Barramos na fronteira.
 *
 * `Number` em vez de `parseFloat` de propósito: `parseFloat("8,5")` devolveria `8`
 * silenciosamente, trocando a quantidade por outra plausível.
 */
const parseQuantidade = (raw: unknown, itemRef: string): number => {
  const text = asText(raw).trim();
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    throw new NfeServiceUnavailableError(
      `Nota fiscal com dados inválidos: quantidade "${text}" no item ${itemRef}`,
    );
  }
  return value;
};

/** Sem `cProd` não há como casar a bipagem com o item esperado (ADR-002). */
const parseCProd = (raw: unknown, itemRef: string): string => {
  const value = asText(raw).trim();
  if (value === "") {
    throw new NfeServiceUnavailableError(
      `Nota fiscal com dados inválidos: código do produto ausente no item ${itemRef}`,
    );
  }
  return value;
};

@Injectable()
export default class NfeGatewayHttp implements NfeGateway {
  private readonly logger = new Logger(NfeGatewayHttp.name);
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    trimValues: true,
  });

  constructor(
    private readonly baseUrl: string,
    private readonly empresaCode: string,
    private readonly http: AxiosInstance = axios.create({ timeout: 15000 }),
  ) {}

  async fetchByInvoiceNumber(invoiceNumber: string): Promise<NfeXmlData> {
    const rawXml = await this.request(invoiceNumber);
    return this.parse(rawXml);
  }

  private async request(invoiceNumber: string): Promise<string> {
    const startedAt = Date.now();
    try {
      const response = await this.http.get<string>(`${this.baseUrl}/ConsultaNotaFiscal/GerarXML`, {
        params: { empresa: this.empresaCode, documento: invoiceNumber },
        responseType: "text",
        transformResponse: [(data: unknown) => data],
      });
      this.logger.log(
        `NfeGateway documento=${invoiceNumber} ok em ${Date.now() - startedAt}ms`,
      );
      return typeof response.data === "string" ? response.data : String(response.data);
    } catch (error) {
      this.logger.error(
        `NfeGateway documento=${invoiceNumber} falhou em ${Date.now() - startedAt}ms: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new NfeServiceUnavailableError("Serviço de consulta de nota fiscal indisponível");
    }
  }

  private parse(rawXml: string): NfeXmlData {
    const parsed = this.parser.parse(rawXml) as Record<string, any>;
    const infNFe = parsed?.nfeProc?.NFe?.infNFe;
    if (infNFe === undefined || infNFe === null) {
      throw new NfeNotFoundError("Nota fiscal não encontrada");
    }
    const dets = asArray<Record<string, any>>(infNFe.det);
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
}
