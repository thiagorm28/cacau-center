import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplyScanEvent from "../../src/application/usecase/ApplyScanEvent";
import DeleteNote from "../../src/application/usecase/DeleteNote";
import { ConflictError, NotFoundError } from "../../src/domain/error/DomainErrors";
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

describe("DeleteNote", () => {
  let unitOfWork: FakeUnitOfWork;
  let deleteNote: DeleteNote;
  let applyScanEvent: ApplyScanEvent;

  const scan = (scannedCode: string) =>
    applyScanEvent.execute({
      clientEventId: randomUUID(),
      scannedCode,
      scannedAt: SCANNED_AT,
      operatorId: OPERATOR_ID,
    });

  beforeEach(() => {
    unitOfWork = new FakeUnitOfWork();
    deleteNote = new DeleteNote(unitOfWork);
    applyScanEvent = new ApplyScanEvent(unitOfWork);
  });

  it("UT-001 exclui a nota, seus itens e todas as bipagens", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 5 },
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 5 },
    ]);
    await scan(PANETONE_CPROD);
    await scan(PANETONE_CPROD);
    await scan(TRUFA_CPROD);
    expect(unitOfWork.scanEvents.records).toHaveLength(3);

    const output = await deleteNote.execute({ noteId: note.noteId, operatorId: OPERATOR_ID });

    expect(output).toEqual({ noteId: note.noteId });
    expect(unitOfWork.notes.records).toHaveLength(0);
    expect(await unitOfWork.notes.findById(note.noteId)).toBeNull();
    expect(unitOfWork.scanEvents.records).toHaveLength(0);
  });

  it("UT-002 recusa excluir uma nota inexistente", async () => {
    const error = await deleteNote
      .execute({ noteId: randomUUID(), operatorId: OPERATOR_ID })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as Error).message).toBe("Nota não encontrada");
  });

  it("UT-003 recusa excluir uma nota já completed e não altera nada", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);
    await scan(PANETONE_CPROD);
    expect(unitOfWork.notes.records[0]!.status).toBe("completed");

    const error = await deleteNote
      .execute({ noteId: note.noteId, operatorId: OPERATOR_ID })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe("Nota não está mais em conferência");
    expect(unitOfWork.notes.records).toHaveLength(1);
    expect(unitOfWork.notes.records[0]!.items).toHaveLength(1);
    expect(unitOfWork.scanEvents.records).toHaveLength(1);
  });

  it("UT-004 recusa excluir uma nota já closed_incomplete", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 2 },
    ]);
    await unitOfWork.notes.close(note.noteId, "closed_incomplete", OPERATOR_ID, new Date());

    const error = await deleteNote
      .execute({ noteId: note.noteId, operatorId: OPERATOR_ID })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as Error).message).toBe("Nota não está mais em conferência");
    expect(unitOfWork.notes.records).toHaveLength(1);
  });

  it("UT-005 exclui uma nota aberta sem nenhuma bipagem", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 4 },
    ]);

    const output = await deleteNote.execute({ noteId: note.noteId, operatorId: OPERATOR_ID });

    expect(output).toEqual({ noteId: note.noteId });
    expect(unitOfWork.notes.records).toHaveLength(0);
    expect(unitOfWork.scanEvents.records).toHaveLength(0);
  });

  it("REV-001 registra noteId e operador no log — único rastro que resta da nota", async () => {
    const note = await openNote(unitOfWork, [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 4 },
    ]);
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    await deleteNote.execute({ noteId: note.noteId, operatorId: OPERATOR_ID });

    expect(log).toHaveBeenCalledWith(
      `Nota ${note.noteId} excluída em conferência por ${OPERATOR_ID}`,
    );
    log.mockRestore();
  });
});
