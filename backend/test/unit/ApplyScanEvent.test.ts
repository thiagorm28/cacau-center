import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplyScanEvent from "../../src/application/usecase/ApplyScanEvent";
import { FakeUnitOfWork } from "../support/InMemoryRepositories";
import { PANETONE_CPROD, TRUFA_CPROD } from "../support/nfeFixtures";

const OPERATOR_ID = randomUUID();
const SCANNED_AT = "2026-08-17T10:00:00.000Z";

const openNote = async (
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

const scan = (overrides: Partial<Parameters<ApplyScanEvent["execute"]>[0]> = {}) => ({
  clientEventId: randomUUID(),
  scannedCode: PANETONE_CPROD,
  scannedAt: SCANNED_AT,
  operatorId: OPERATOR_ID,
  ...overrides,
});

describe("ApplyScanEvent", () => {
  let unitOfWork: FakeUnitOfWork;
  let applyScanEvent: ApplyScanEvent;

  beforeEach(() => {
    unitOfWork = new FakeUnitOfWork();
    applyScanEvent = new ApplyScanEvent(unitOfWork);
  });

  it("UT-019 registra evento matched e incrementa o contador do item", async () => {
    const note = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 3 },
    ]);
    const itemId = note.items[0]!.itemId;

    const output = await applyScanEvent.execute(scan());

    expect(output.resolution).toEqual({ kind: "matched", noteId: note.noteId, itemId });
    expect(unitOfWork.notes.records[0]!.items[0]!.confirmedQty).toBe(1);
    expect(unitOfWork.scanEvents.records[0]).toMatchObject({ result: "matched", noteId: note.noteId });
  });

  it("UT-020 conclui a nota automaticamente ao confirmar a última unidade", async () => {
    const note = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 2 },
    ]);

    await applyScanEvent.execute(scan());
    await applyScanEvent.execute(scan());

    const stored = await unitOfWork.notes.findById(note.noteId);
    expect(stored?.getStatus()).toBe("completed");
  });

  it("UT-020a registra quem fechou a nota concluída automaticamente", async () => {
    const note = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);

    await applyScanEvent.execute(scan());

    const stored = await unitOfWork.notes.findById(note.noteId);
    expect(stored?.getStatus()).toBe("completed");
    expect(stored?.getClosedBy()).toBe(OPERATOR_ID);
    expect(stored?.getClosedAt()).toBeInstanceOf(Date);
  });

  it("UT-020b reivindica as caixas não identificadas em aberto ao concluir a nota", async () => {
    // Sem isso a nota fica `completed` sem autoria e as caixas não identificadas da
    // sessão vazam para a próxima nota finalizada (US-010 EC-2 / ADR-004).
    const note = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);
    await applyScanEvent.execute(
      scan({ scannedCode: "caixa-misteriosa", markUnidentified: true }),
    );

    await applyScanEvent.execute(scan());

    const unidentified = unitOfWork.scanEvents.records.find(
      (record) => record.result === "unidentified",
    );
    expect(unidentified?.noteId).toBe(note.noteId);
  });

  it("UT-020c não fecha a nota enquanto restar item pendente", async () => {
    const note = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 1 },
    ]);
    await applyScanEvent.execute(
      scan({ scannedCode: "caixa-misteriosa", markUnidentified: true }),
    );

    await applyScanEvent.execute(scan());

    const stored = await unitOfWork.notes.findById(note.noteId);
    expect(stored?.getStatus()).toBe("open");
    expect(stored?.getClosedAt()).toBeNull();
    expect(
      unitOfWork.scanEvents.records.find((record) => record.result === "unidentified")?.noteId,
    ).toBeNull();
  });

  it("UT-021 é idempotente por clientEventId", async () => {
    await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 3 },
    ]);
    const input = scan();

    const first = await applyScanEvent.execute(input);
    const second = await applyScanEvent.execute(input);

    expect(second.resolution).toEqual(first.resolution);
    expect(unitOfWork.scanEvents.records).toHaveLength(1);
    expect(unitOfWork.notes.records[0]!.items[0]!.confirmedQty).toBe(1);
  });

  it("UT-022 resolve exceeded sem alterar o contador quando a quantidade já foi atingida", async () => {
    // A trufa continua pendente para a nota seguir `open` — uma nota 100% confirmada
    // vira `completed` e sai das candidatas (US-010 AC-2).
    const note = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 1 },
    ]);
    await applyScanEvent.execute(scan());

    const output = await applyScanEvent.execute(scan());

    expect(output.resolution).toEqual({
      kind: "exceeded",
      noteId: note.noteId,
      itemId: note.items[0]!.itemId,
    });
    expect(unitOfWork.notes.records[0]!.items[0]!.confirmedQty).toBe(1);
  });

  it("UT-022a resolve exceeded quando a nota do item acabou de concluir sozinha", async () => {
    // A nota do panetone fecha na primeira caixa (US-010) e sai das candidatas de
    // alocação, mas a caixa seguinte do mesmo produto continua sendo "quantidade já
    // atingida" (US-005 AC-1) — não uma caixa não identificada. A nota 2 mantém a
    // conferência ativa, como no cenário multi-nota de US-008.
    const completed = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);
    await openNote(unitOfWork, "2", [
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 1 },
    ]);
    await applyScanEvent.execute(scan());

    const output = await applyScanEvent.execute(scan());

    expect(output.resolution).toEqual({
      kind: "exceeded",
      noteId: completed.noteId,
      itemId: completed.items[0]!.itemId,
    });
    expect(unitOfWork.scanEvents.records[1]).toMatchObject({
      result: "exceeded",
      noteId: completed.noteId,
    });
    expect(unitOfWork.notes.records[0]!.items[0]!.confirmedQty).toBe(1);
  });

  it("UT-022b ignora nota concluída fora da janela recente e volta a unidentified", async () => {
    // Conferência encerrada há horas não pode capturar a caixa de uma entrega nova: ela
    // pertence ao fluxo de caixa não identificada (US-007).
    await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);
    await openNote(unitOfWork, "2", [
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 1 },
    ]);
    await applyScanEvent.execute(scan());
    unitOfWork.notes.records[0]!.closedAt = new Date(Date.now() - 60 * 60 * 1000);

    const output = await applyScanEvent.execute(scan());

    expect(output.resolution).toEqual({ kind: "unidentified" });
    expect(unitOfWork.scanEvents.records[1]).toMatchObject({
      result: "unidentified",
      noteId: null,
    });
  });

  it("UT-022c resolve exceeded quando a nota concluída era a única da fila", async () => {
    // Caso mais comum da franqueada: uma nota por vez. Ao concluir, ela esvazia a fila de
    // notas abertas — a rebipagem seguinte ainda tem que virar "quantidade já atingida"
    // (US-005 AC-1) em vez de esbarrar na recusa por falta de conferência ativa.
    const completed = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);
    await applyScanEvent.execute(scan());
    expect(await unitOfWork.notes.listOpen()).toHaveLength(0);

    const output = await applyScanEvent.execute(scan());

    expect(output.resolution).toEqual({
      kind: "exceeded",
      noteId: completed.noteId,
      itemId: completed.items[0]!.itemId,
    });
    expect(unitOfWork.scanEvents.records[1]).toMatchObject({
      result: "exceeded",
      noteId: completed.noteId,
    });
    expect(unitOfWork.notes.records[0]!.items[0]!.confirmedQty).toBe(1);
  });

  it("UT-022d recusa código desconhecido quando a fila ficou vazia", async () => {
    // A fila vazia continua recusando o que não casa com nenhuma nota recém-concluída: um
    // evento `unidentified` órfão seria reivindicado pela próxima nota a fechar (US-007.EC-2).
    await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);
    await applyScanEvent.execute(scan());

    const error = await applyScanEvent
      .execute(scan({ scannedCode: "codigo-desconhecido" }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("nenhuma conferência ativa");
    expect(unitOfWork.scanEvents.records).toHaveLength(1);
  });

  it("UT-023 credita diretamente o item informado em manualItemId", async () => {
    const note = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 2 },
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 2 },
    ]);
    const trufa = note.items.find((item) => item.cProd === TRUFA_CPROD)!;

    const output = await applyScanEvent.execute(
      scan({ scannedCode: "codigo-ilegivel", manualItemId: trufa.itemId }),
    );

    expect(output.resolution).toEqual({
      kind: "matched",
      noteId: note.noteId,
      itemId: trufa.itemId,
    });
    expect(unitOfWork.scanEvents.records[0]!.result).toBe("manual_matched");
    const stored = await unitOfWork.notes.findById(note.noteId);
    expect(stored?.findItem(trufa.itemId)?.getConfirmedQty()).toBe(1);
  });

  it("UT-024 resolve exceeded quando o item escolhido manualmente já está completo", async () => {
    const note = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 1 },
    ]);
    const itemId = note.items.find((item) => item.cProd === PANETONE_CPROD)!.itemId;
    await applyScanEvent.execute(scan({ manualItemId: itemId }));

    const output = await applyScanEvent.execute(
      scan({ scannedCode: "codigo-ilegivel", manualItemId: itemId }),
    );

    expect(output.resolution).toEqual({ kind: "exceeded", noteId: note.noteId, itemId });
    expect(unitOfWork.notes.records[0]!.items[0]!.confirmedQty).toBe(1);
  });

  it("UT-025 registra caixa não identificada com note_id nulo", async () => {
    await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
    ]);

    const output = await applyScanEvent.execute(
      scan({ scannedCode: "codigo-desconhecido", markUnidentified: true }),
    );

    expect(output.resolution).toEqual({ kind: "unidentified" });
    expect(unitOfWork.scanEvents.records[0]).toMatchObject({
      result: "unidentified",
      noteId: null,
      noteItemId: null,
    });
  });

  it("UT-026 delega a decisão ambígua ao resolveScan do shared e persiste na nota escolhida", async () => {
    const note1 = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 10 },
    ]);
    const note2 = await openNote(unitOfWork, "2", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 10 },
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 1 },
    ]);
    // A trufa é exclusiva da nota 2: confirmá-la torna a nota 2 a que mais avança em
    // percentual de conclusão a cada panetone seguinte (cenário de referência ADR-001).
    await applyScanEvent.execute(scan({ scannedCode: TRUFA_CPROD }));

    const output = await applyScanEvent.execute(scan({ scannedCode: PANETONE_CPROD }));

    expect(output.resolution).toMatchObject({ kind: "matched", noteId: note2.noteId });
    const untouched = await unitOfWork.notes.findById(note1.noteId);
    expect(untouched?.items[0]?.getConfirmedQty()).toBe(0);
  });

  it("UT-028 rebaixa para exceeded quando a última unidade foi gasta após a leitura", async () => {
    // A trufa continua pendente para a nota seguir `open` e permanecer candidata.
    const note = await openNote(unitOfWork, "1", [
      { cProd: PANETONE_CPROD, description: "Panetone", expectedQty: 1 },
      { cProd: TRUFA_CPROD, description: "Trufa", expectedQty: 1 },
    ]);
    const itemId = note.items.find((item) => item.cProd === PANETONE_CPROD)!.itemId;
    const stale = await unitOfWork.notes.listOpen();
    // Uma bipagem concorrente gasta a última unidade entre a leitura e a escrita desta.
    await applyScanEvent.execute(scan());
    vi.spyOn(unitOfWork.notes, "listOpen").mockResolvedValueOnce(stale);

    const output = await applyScanEvent.execute(scan());

    expect(output.resolution).toEqual({ kind: "exceeded", noteId: note.noteId, itemId });
    expect(unitOfWork.notes.records[0]!.items[0]!.confirmedQty).toBe(1);
    expect(unitOfWork.scanEvents.records[1]!.result).toBe("exceeded");
  });

  it("UT-027 recusa o registro quando não há nenhuma nota em conferência", async () => {
    const error = await applyScanEvent
      .execute(scan({ scannedCode: "codigo-desconhecido", markUnidentified: true }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("nenhuma conferência ativa");
    expect(unitOfWork.scanEvents.records).toHaveLength(0);
  });
});
