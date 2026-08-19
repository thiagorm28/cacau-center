import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import ApplyScanEvent from "../../src/application/usecase/ApplyScanEvent";
import FinalizeNote from "../../src/application/usecase/FinalizeNote";
import { ConflictError } from "../../src/domain/error/DomainErrors";
import { FakeUnitOfWork } from "../support/InMemoryRepositories";
import { PANETONE_CPROD, TRUFA_CPROD } from "../support/nfeFixtures";

const OPERATOR_ID = randomUUID();
const SCANNED_AT = "2026-08-17T10:00:00.000Z";

const openNote = (
  unitOfWork: FakeUnitOfWork,
  items: ReadonlyArray<{ cProd: string; description: string; expectedQty: number }>,
) =>
  unitOfWork.notes.create({
    invoiceNumber: "004005647",
    nfeChaveAcesso: "chave",
    nfeNumero: "4005647",
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

describe("FinalizeNote", () => {
  let unitOfWork: FakeUnitOfWork;
  let finalizeNote: FinalizeNote;
  let applyScanEvent: ApplyScanEvent;

  beforeEach(() => {
    unitOfWork = new FakeUnitOfWork();
    finalizeNote = new FinalizeNote(unitOfWork);
    applyScanEvent = new ApplyScanEvent(unitOfWork);
  });

  it("UT-028 devolve o relatório de uma nota já completa sem alterar o status", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);
    await applyScanEvent.execute({
      clientEventId: randomUUID(),
      scannedCode: PANETONE_CPROD,
      scannedAt: SCANNED_AT,
      operatorId: OPERATOR_ID,
    });

    const output = await finalizeNote.execute({
      noteId: note.noteId,
      operatorId: OPERATOR_ID,
      confirmIncomplete: false,
    });

    expect(output.status).toBe("completed");
    expect(output.report.isComplete).toBe(true);
    expect(output.report.missingItems).toHaveLength(0);
  });

  it("UT-029 recusa finalizar nota com itens pendentes sem confirmIncomplete", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 3 },
    ]);

    const error = await finalizeNote
      .execute({ noteId: note.noteId, operatorId: OPERATOR_ID, confirmIncomplete: false })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe("Itens pendentes: confirme para finalizar mesmo assim");
    expect(unitOfWork.notes.records[0]!.status).toBe("open");
  });

  it("UT-030 finaliza como closed_incomplete listando os itens faltantes", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 10 },
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 2 },
    ]);

    const output = await finalizeNote.execute({
      noteId: note.noteId,
      operatorId: OPERATOR_ID,
      confirmIncomplete: true,
    });

    expect(output.status).toBe("closed_incomplete");
    expect(output.report.missingItems).toEqual([
      expect.objectContaining({ description: "Panetone", missingQty: 10 }),
      expect.objectContaining({ description: "Trufa", missingQty: 2 }),
    ]);
  });

  it("UT-031 reivindica as bipagens não identificadas ainda sem nota e as inclui no relatório", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 2 },
    ]);
    await applyScanEvent.execute({
      clientEventId: randomUUID(),
      scannedCode: "caixa-misteriosa",
      scannedAt: SCANNED_AT,
      operatorId: OPERATOR_ID,
      markUnidentified: true,
    });

    const output = await finalizeNote.execute({
      noteId: note.noteId,
      operatorId: OPERATOR_ID,
      confirmIncomplete: true,
    });

    expect(output.report.unidentifiedScans).toHaveLength(1);
    expect(output.report.unidentifiedScans[0]?.scannedCode).toBe("caixa-misteriosa");
    expect(unitOfWork.scanEvents.records[0]!.noteId).toBe(note.noteId);
  });

  it("UT-031a finalizar nota concluída automaticamente preserva o fechamento da bipagem", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);
    await applyScanEvent.execute({
      clientEventId: randomUUID(),
      scannedCode: PANETONE_CPROD,
      scannedAt: SCANNED_AT,
      operatorId: OPERATOR_ID,
    });
    const autoClosedAt = unitOfWork.notes.records[0]!.closedAt;

    const output = await finalizeNote.execute({
      noteId: note.noteId,
      operatorId: randomUUID(),
      confirmIncomplete: false,
    });

    expect(output.status).toBe("completed");
    expect(output.report.closedAt).toBe(autoClosedAt?.toISOString());
    expect(unitOfWork.notes.records[0]!.closedBy).toBe(OPERATOR_ID);
  });

  it("UT-032 refinalizar uma nota já closed_incomplete não altera o closedAt", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 2 },
    ]);
    const first = await finalizeNote.execute({
      noteId: note.noteId,
      operatorId: OPERATOR_ID,
      confirmIncomplete: true,
    });

    const second = await finalizeNote.execute({
      noteId: note.noteId,
      operatorId: OPERATOR_ID,
      confirmIncomplete: true,
    });

    expect(second.status).toBe("closed_incomplete");
    expect(second.report.closedAt).toBe(first.report.closedAt);
    expect(second.report).toEqual(first.report);
  });
});
