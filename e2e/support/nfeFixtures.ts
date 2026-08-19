import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Catálogo de notas servido pelo servidor de fixtures no lugar da API interna da
 * Cacau Show (`hybrisreports.cacaushow.com.br`). Toda nota aqui deriva do XML real
 * `004005647.xml`: mesmo fornecedor, mesma estrutura de `nfeProc`, mesmo produto —
 * só as quantidades e os itens exclusivos mudam, conforme o cenário exigido.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Nota real distribuída com o projeto, usada sem qualquer alteração. */
export const REAL_INVOICE_NUMBER = "004005647";

/** Número que nenhuma fixture atende — o servidor responde "não localizado" (E2E-005). */
export const UNKNOWN_INVOICE_NUMBER = "009999999";

export const PANETONE = {
  cProd: "000000000001003469",
  description: "PANETTONE GOTAS 450GX18UN",
} as const;

export const TRUFA = {
  cProd: "000000000001009999",
  description: "TRUFA AO LEITE 1KG",
} as const;

export const BOMBOM = {
  cProd: "000000000001007777",
  description: "BOMBOM SORTIDO 300G",
} as const;

/** Nenhuma nota do catálogo contém este código — é sempre uma leitura sem correspondência. */
export const UNMATCHED_CODES = ["000000000009000001", "000000000009000002"] as const;

interface FixtureItem {
  readonly cProd: string;
  readonly description: string;
  readonly quantity: number;
}

interface FixtureNote {
  readonly chaveAcesso: string;
  readonly nNF: string;
  readonly items: readonly FixtureItem[];
}

const SUPPLIER_CNPJ = "61472205000407";
export const SUPPLIER_NAME = "IBAC INDUSTRIA BRASILEIRA DE ALIMENTOS E CHOCOLATES LTDA";

/**
 * O XML real traz `SEM GTIN` em `cEAN`/`cEANTrib`, então a bipagem casa pelo `cProd`.
 * As notas derivadas preservam essa característica.
 */
const detOf = (item: FixtureItem, index: number): string =>
  `<det nItem="${index + 1}"><prod>` +
  `<cProd>${item.cProd}</cProd>` +
  "<cEAN>SEM GTIN</cEAN>" +
  `<xProd>${item.description}</xProd>` +
  "<uCom>CX</uCom>" +
  `<qCom>${item.quantity.toFixed(4)}</qCom>` +
  "<cEANTrib>SEM GTIN</cEANTrib>" +
  "</prod></det>";

const buildNfeXml = (note: FixtureNote): string =>
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">' +
  '<NFe xmlns="http://www.portalfiscal.inf.br/nfe">' +
  `<infNFe versao="4.00" Id="NFe${note.chaveAcesso}">` +
  `<ide><nNF>${note.nNF}</nNF></ide>` +
  `<emit><CNPJ>${SUPPLIER_CNPJ}</CNPJ><xNome>${SUPPLIER_NAME}</xNome></emit>` +
  note.items.map(detOf).join("") +
  "</infNFe></NFe></nfeProc>";

const derived = (invoiceNumber: string, items: readonly FixtureItem[]): string =>
  buildNfeXml({
    // A chave de acesso mantém os 44 dígitos, variando apenas pelo número da nota.
    chaveAcesso: `352608614722050004075500100${invoiceNumber}1765455044`.slice(0, 44),
    nNF: invoiceNumber.replace(/^0+/, ""),
    items,
  });

/** Cenário de referência da ADR-001: nota sem item exclusivo (aberta primeiro). */
export const REFERENCE_NOTE_1 = "004005648";
/** Cenário de referência da ADR-001: mesma quantidade de panetones + 1 trufa exclusiva. */
export const REFERENCE_NOTE_2 = "004005649";
/** Nota curta de dois itens distintos, para o fluxo de seleção manual (E2E-003). */
export const MANUAL_SELECTION_INVOICE_NUMBER = "004005650";
/** Nota curta de um item só, para a jornada offline (E2E-004). */
export const OFFLINE_INVOICE_NUMBER = "004005651";
/** Nota usada para montar o histórico gerencial (E2E-006/E2E-007). */
export const HISTORY_INVOICE_NUMBER = "004005652";

const catalog: ReadonlyMap<string, string> = new Map([
  [REAL_INVOICE_NUMBER, readFileSync(`${repoRoot}004005647.xml`, "utf8")],
  [REFERENCE_NOTE_1, derived(REFERENCE_NOTE_1, [{ ...PANETONE, quantity: 10 }])],
  [
    REFERENCE_NOTE_2,
    derived(REFERENCE_NOTE_2, [
      { ...PANETONE, quantity: 10 },
      { ...TRUFA, quantity: 1 },
    ]),
  ],
  [
    MANUAL_SELECTION_INVOICE_NUMBER,
    derived(MANUAL_SELECTION_INVOICE_NUMBER, [
      { ...PANETONE, quantity: 1 },
      { ...BOMBOM, quantity: 1 },
    ]),
  ],
  [OFFLINE_INVOICE_NUMBER, derived(OFFLINE_INVOICE_NUMBER, [{ ...PANETONE, quantity: 3 }])],
  [HISTORY_INVOICE_NUMBER, derived(HISTORY_INVOICE_NUMBER, [{ ...PANETONE, quantity: 2 }])],
]);

/** Quantidade esperada do item real: 8 caixas de panetone (E2E-001). */
export const REAL_NOTE_QUANTITY = 8;

/**
 * Resposta do endpoint `GerarXML` para um `documento`. Documento desconhecido devolve
 * o mesmo HTML de "não localizado" que a API real usa — o gateway não acha `nfeProc`
 * e traduz para 404.
 */
export const xmlFor = (documento: string): string =>
  catalog.get(documento) ?? "<html>documento nao localizado</html>";
