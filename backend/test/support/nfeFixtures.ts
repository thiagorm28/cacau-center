import { readFileSync } from "node:fs";
import { join } from "node:path";

/** XML real fornecido com o projeto — fixture canônica de parsing e de bipagem. */
export const REAL_FIXTURE_INVOICE_NUMBER = "004005647";

export const readRealNfeFixture = (): string =>
  readFileSync(join(process.cwd(), "..", "004005647.xml"), "utf8");

export type FixtureItem = {
  cProd: string;
  cEAN?: string;
  xProd: string;
  uCom?: string;
  qCom: number;
};

export type FixtureNote = {
  chaveAcesso: string;
  nNF: string;
  emitCnpj?: string;
  emitNome?: string;
  items: readonly FixtureItem[];
};

const detOf = (item: FixtureItem, index: number): string =>
  `<det nItem="${index + 1}"><prod>` +
  `<cProd>${item.cProd}</cProd>` +
  `<cEAN>${item.cEAN ?? "SEM GTIN"}</cEAN>` +
  `<xProd>${item.xProd}</xProd>` +
  `<uCom>${item.uCom ?? "CX"}</uCom>` +
  `<qCom>${item.qCom.toFixed(4)}</qCom>` +
  `<cEANTrib>${item.cEAN ?? "SEM GTIN"}</cEANTrib>` +
  "</prod></det>";

/** Monta um `nfeProc` mínimo, mas estruturalmente idêntico ao XML real. */
export const buildNfeXml = (note: FixtureNote): string =>
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">' +
  '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">' +
  `<infNFe versao="4.00" Id="NFe${note.chaveAcesso}">` +
  `<ide><nNF>${note.nNF}</nNF></ide>` +
  `<emit><CNPJ>${note.emitCnpj ?? "61472205000407"}</CNPJ>` +
  `<xNome>${note.emitNome ?? "IBAC INDUSTRIA BRASILEIRA DE ALIMENTOS E CHOCOLATES LTDA"}</xNome></emit>` +
  note.items.map(detOf).join("") +
  "</infNFe></NFe></nfeProc>";

/** Códigos do cenário de referência do ADR-001 (10 panetones + 1 trufa exclusiva). */
export const PANETONE_CPROD = "000000000001003469";
export const TRUFA_CPROD = "000000000001009999";
