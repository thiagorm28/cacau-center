import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchNote from "../../src/application/usecase/SearchNote";
import {
  ConflictError,
  NfeNotFoundError,
  NfeServiceUnavailableError,
} from "../../src/domain/error/DomainErrors";
import type { NfeGateway, NfeXmlData } from "../../src/infra/gateway/NfeGateway";
import { FakeUnitOfWork } from "../support/InMemoryRepositories";
import { PANETONE_CPROD } from "../support/nfeFixtures";

const OPERATOR_ID = randomUUID();

const nfeData: NfeXmlData = {
  chaveAcesso: "35260861472205000407550010040056471765455044",
  numeroNota: "4005647",
  fornecedorCnpj: "61472205000407",
  fornecedorNome: "IBAC",
  items: [
    {
      cProd: PANETONE_CPROD,
      cEan: null,
      descricao: "PANETTONE GOTAS 450GX18UN",
      unidade: "CX",
      quantidade: 8,
    },
  ],
  rawXml: "<nfeProc/>",
};

describe("SearchNote", () => {
  let unitOfWork: FakeUnitOfWork;
  let gateway: NfeGateway;
  let searchNote: SearchNote;

  beforeEach(() => {
    unitOfWork = new FakeUnitOfWork();
    gateway = { fetchByInvoiceNumber: vi.fn().mockResolvedValue(nfeData) };
    searchNote = new SearchNote(unitOfWork, gateway);
  });

  it("UT-015 cria a nota e os itens quando não há duplicata aberta", async () => {
    const output = await searchNote.execute({
      invoiceNumber: "004005647",
      operatorId: OPERATOR_ID,
    });

    expect(output.status).toBe("open");
    expect(output.items).toHaveLength(1);
    expect(output.items[0]).toMatchObject({
      description: "PANETTONE GOTAS 450GX18UN",
      expectedQty: 8,
      confirmedQty: 0,
    });
    expect(unitOfWork.notes.records).toHaveLength(1);
  });

  it("UT-016 recusa nota já em conferência sem chamar o gateway", async () => {
    await searchNote.execute({ invoiceNumber: "004005647", operatorId: OPERATOR_ID });
    vi.mocked(gateway.fetchByInvoiceNumber).mockClear();

    const error = await searchNote
      .execute({ invoiceNumber: "004005647", operatorId: OPERATOR_ID })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe("Nota já está em conferência");
    expect(gateway.fetchByInvoiceNumber).not.toHaveBeenCalled();
  });

  it("UT-016b trava o número da nota antes de checar duplicata e inserir", async () => {
    const lock = vi.spyOn(unitOfWork.notes, "lockInvoiceNumber");
    const check = vi.spyOn(unitOfWork.notes, "hasOpenWithInvoiceNumber");
    const create = vi.spyOn(unitOfWork.notes, "create");

    await searchNote.execute({ invoiceNumber: "004005647", operatorId: OPERATOR_ID });

    expect(lock).toHaveBeenCalledWith("004005647");
    const [lockOrder] = lock.mock.invocationCallOrder;
    const [createOrder] = create.mock.invocationCallOrder;
    // A checagem que importa é a de dentro da transação: a última antes do INSERT.
    const checkOrder = check.mock.invocationCallOrder.at(-1);
    expect(lockOrder).toBeLessThan(checkOrder as number);
    expect(checkOrder as number).toBeLessThan(createOrder as number);
  });

  it("UT-017 propaga NfeNotFoundError do gateway sem alteração", async () => {
    const thrown = new NfeNotFoundError("Nota fiscal não encontrada");
    vi.mocked(gateway.fetchByInvoiceNumber).mockRejectedValue(thrown);

    await expect(
      searchNote.execute({ invoiceNumber: "004005647", operatorId: OPERATOR_ID }),
    ).rejects.toBe(thrown);
  });

  it("UT-018 propaga NfeServiceUnavailableError do gateway sem alteração", async () => {
    const thrown = new NfeServiceUnavailableError("indisponível");
    vi.mocked(gateway.fetchByInvoiceNumber).mockRejectedValue(thrown);

    await expect(
      searchNote.execute({ invoiceNumber: "004005647", operatorId: OPERATOR_ID }),
    ).rejects.toBe(thrown);
  });
});
