import { afterAll, beforeAll, describe, expect, it } from "vitest";
import NfeGatewayHttp from "../../src/infra/gateway/NfeGateway";
import FixtureNfeServer from "../support/FixtureNfeServer";
import {
  PANETONE_CPROD,
  REAL_FIXTURE_INVOICE_NUMBER,
  readRealNfeFixture,
} from "../support/nfeFixtures";

describe("NfeGatewayHttp contra servidor de fixture local", () => {
  let server: FixtureNfeServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new FixtureNfeServer();
    baseUrl = await server.start();
    server.respondWithXml(REAL_FIXTURE_INVOICE_NUMBER, readRealNfeFixture());
  });

  afterAll(async () => {
    await server.stop();
  });

  it("IT-018 parseia todos os campos da fixture servida por HTTP real", async () => {
    const gateway = new NfeGatewayHttp(baseUrl, "1102");

    const data = await gateway.fetchByInvoiceNumber(REAL_FIXTURE_INVOICE_NUMBER);

    expect(data).toMatchObject({
      chaveAcesso: "35260861472205000407550010040056471765455044",
      numeroNota: "4005647",
      fornecedorCnpj: "61472205000407",
      fornecedorNome: "IBAC INDUSTRIA BRASILEIRA DE ALIMENTOS E CHOCOLATES LTDA",
      items: [
        {
          cProd: PANETONE_CPROD,
          cEan: null,
          descricao: "PANETTONE GOTAS 450GX18UN",
          unidade: "CX",
          quantidade: 8,
        },
      ],
    });
    expect(data.rawXml).toContain("<nfeProc");
  });
});
