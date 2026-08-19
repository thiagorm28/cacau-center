import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import ApplyScanEvent from "../../src/application/usecase/ApplyScanEvent";
import SyncScanEvents from "../../src/application/usecase/SyncScanEvents";
import { FakeUnitOfWork } from "../support/InMemoryRepositories";
import { PANETONE_CPROD, TRUFA_CPROD } from "../support/nfeFixtures";

const OPERATOR_ID = randomUUID();
const SCANNED_AT = "2026-08-17T10:00:00.000Z";

const openNote = (
  unitOfWork: FakeUnitOfWork,
  invoiceNumber: string,
  items: ReadonlyArray<{ cProd: string; description: string; expectedQty: number }>,
) =>
  unitOfWork.notes.create({
    invoiceNumber,
    nfeChaveAcesso: `chave-${invoiceNumber}`,
    nfeNumero: invoiceNumber,
    supplierCnpj: "61472205000407",
    supplierName: "IBAC",
    rawXml: "<nfeProc/>",
    openedBy: OPERATOR_ID,
    items: items.map((item) => ({
      cProd: item.cProd,
      cEan: null,
      description: item.description,
      unit: "CX",
      expectedQty: item.expectedQty,
    })),
  });

const event = (scannedCode: string) => ({
  clientEventId: randomUUID(),
  scannedCode,
  scannedAt: SCANNED_AT,
});

describe("SyncScanEvents", () => {
  let unitOfWork: FakeUnitOfWork;
  let syncScanEvents: SyncScanEvents;

  beforeEach(() => {
    unitOfWork = new FakeUnitOfWork();
    syncScanEvents = new SyncScanEvents(unitOfWork, new ApplyScanEvent(unitOfWork));
  });

  it("UT-033 aplica um lote de eventos novos", async () => {
    await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 5 },
    ]);

    const output = await syncScanEvents.execute({
      operatorId: OPERATOR_ID,
      events: [event(PANETONE_CPROD), event(PANETONE_CPROD), event(PANETONE_CPROD)],
    });

    expect(output).toEqual({ applied: 3, duplicates: 0 });
    expect(unitOfWork.notes.records[0]!.items[0]!.confirmedQty).toBe(3);
  });

  it("UT-034 conta como duplicado o clientEventId já aplicado, sem reaplicar", async () => {
    await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 5 },
    ]);
    const repeated = event(PANETONE_CPROD);
    await syncScanEvents.execute({ operatorId: OPERATOR_ID, events: [repeated] });

    const output = await syncScanEvents.execute({
      operatorId: OPERATOR_ID,
      events: [repeated, event(PANETONE_CPROD), event(PANETONE_CPROD)],
    });

    expect(output).toEqual({ applied: 2, duplicates: 1 });
    expect(unitOfWork.notes.records[0]!.items[0]!.confirmedQty).toBe(3);
  });

  it("UT-035 aplica o lote na ordem do array, reproduzindo o cenário de referência", async () => {
    const note1 = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 10 },
    ]);
    const note2 = await openNote(unitOfWork, "2", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 10 },
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 1 },
    ]);

    const output = await syncScanEvents.execute({
      operatorId: OPERATOR_ID,
      events: [
        event(TRUFA_CPROD),
        ...Array.from({ length: 10 }, () => event(PANETONE_CPROD)),
      ],
    });

    expect(output).toEqual({ applied: 11, duplicates: 0 });
    expect((await unitOfWork.notes.findById(note2.noteId))?.getStatus()).toBe("completed");
    expect((await unitOfWork.notes.findById(note1.noteId))?.items[0]?.getConfirmedQty()).toBe(0);
  });

  it("UT-036 aceita um lote vazio sem erro", async () => {
    const output = await syncScanEvents.execute({ operatorId: OPERATOR_ID, events: [] });

    expect(output).toEqual({ applied: 0, duplicates: 0 });
  });
});
