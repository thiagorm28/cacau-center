import type { AxiosInstance } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NfeNotFoundError,
  NfeServiceUnavailableError,
} from "../../src/domain/error/DomainErrors";
import NfeGatewayHttp from "../../src/infra/gateway/NfeGateway";
import { buildNfeXml, PANETONE_CPROD, readRealNfeFixture } from "../support/nfeFixtures";

const httpStub = (get: AxiosInstance["get"]): AxiosInstance => ({ get }) as unknown as AxiosInstance;

describe("NfeGatewayHttp", () => {
  let fixtureXml: string;

  beforeEach(() => {
    fixtureXml = readRealNfeFixture();
  });

  it("UT-011 parseia a fixture real devolvendo chave de acesso, número e primeiro item", async () => {
    const get = vi.fn().mockResolvedValue({ data: fixtureXml });
    const gateway = new NfeGatewayHttp("http://nfe.local", "1102", httpStub(get));

    const data = await gateway.fetchByInvoiceNumber("004005647");

    expect(data.chaveAcesso).toBe("35260861472205000407550010040056471765455044");
    expect(data.numeroNota).toBe("4005647");
    expect(data.fornecedorCnpj).toBe("61472205000407");
    expect(data.items[0]).toEqual({
      cProd: PANETONE_CPROD,
      cEan: null,
      descricao: "PANETTONE GOTAS 450GX18UN",
      unidade: "CX",
      quantidade: 8,
    });
    expect(get).toHaveBeenCalledWith(
      "http://nfe.local/ConsultaNotaFiscal/GerarXML",
      expect.objectContaining({ params: { empresa: "1102", documento: "004005647" } }),
    );
  });

  it("UT-012 traduz erro de rede/5xx em NfeServiceUnavailableError", async () => {
    const get = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const gateway = new NfeGatewayHttp("http://nfe.local", "1102", httpStub(get));

    await expect(gateway.fetchByInvoiceNumber("004005647")).rejects.toBeInstanceOf(
      NfeServiceUnavailableError,
    );
  });

  it("UT-013 traduz resposta 200 sem estrutura nfeProc em NfeNotFoundError", async () => {
    const get = vi.fn().mockResolvedValue({ data: "<html><body>nada aqui</body></html>" });
    const gateway = new NfeGatewayHttp("http://nfe.local", "1102", httpStub(get));

    await expect(gateway.fetchByInvoiceNumber("999").catch((e) => e)).resolves.toBeInstanceOf(
      NfeNotFoundError,
    );
  });

  it.each([
    ["ausente", ""],
    ["vazia", "   "],
    ["não numérica", "abc"],
    ["zero", "0.0000"],
    ["negativa", "-3.0000"],
    ["com lixo no fim", "8,5000"],
  ])("rejeita nota cuja qCom é %s em vez de deixar NaN chegar ao domínio", async (_label, qCom) => {
    const xml = buildNfeXml({
      chaveAcesso: "35260861472205000407550010040056471765455044",
      nNF: "4005647",
      items: [{ cProd: PANETONE_CPROD, xProd: "PANETTONE GOTAS 450GX18UN", qCom: 8 }],
    }).replace(/<qCom>[^<]*<\/qCom>/, `<qCom>${qCom}</qCom>`);
    const gateway = new NfeGatewayHttp("http://nfe.local", "1102", httpStub(vi.fn().mockResolvedValue({ data: xml })));

    await expect(gateway.fetchByInvoiceNumber("004005647")).rejects.toBeInstanceOf(
      NfeServiceUnavailableError,
    );
  });

  it("rejeita nota cujo item não traz cProd, sem o qual a bipagem não casa com o item", async () => {
    const xml = buildNfeXml({
      chaveAcesso: "35260861472205000407550010040056471765455044",
      nNF: "4005647",
      items: [{ cProd: PANETONE_CPROD, xProd: "PANETTONE GOTAS 450GX18UN", qCom: 8 }],
    }).replace(/<cProd>[^<]*<\/cProd>/, "<cProd></cProd>");
    const gateway = new NfeGatewayHttp("http://nfe.local", "1102", httpStub(vi.fn().mockResolvedValue({ data: xml })));

    await expect(gateway.fetchByInvoiceNumber("004005647")).rejects.toBeInstanceOf(
      NfeServiceUnavailableError,
    );
  });

  it("aceita quantidade fracionária válida, que é legítima para itens vendidos a peso", async () => {
    const xml = buildNfeXml({
      chaveAcesso: "35260861472205000407550010040056471765455044",
      nNF: "4005647",
      items: [{ cProd: PANETONE_CPROD, xProd: "PANETTONE GOTAS 450GX18UN", qCom: 2.5 }],
    });
    const gateway = new NfeGatewayHttp("http://nfe.local", "1102", httpStub(vi.fn().mockResolvedValue({ data: xml })));

    const data = await gateway.fetchByInvoiceNumber("004005647");

    expect(data.items[0].quantidade).toBe(2.5);
  });

  it("UT-014 normaliza um único <det> como array de um item", async () => {
    const get = vi.fn().mockResolvedValue({ data: fixtureXml });
    const gateway = new NfeGatewayHttp("http://nfe.local", "1102", httpStub(get));

    const data = await gateway.fetchByInvoiceNumber("004005647");

    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items).toHaveLength(1);
  });
});
