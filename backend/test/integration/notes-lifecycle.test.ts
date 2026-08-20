import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import NoteRepositoryDatabase from "../../src/infra/repository/NoteRepository";
import { GERENTE, OPERADOR, type TestApp, jsonRequest, startTestApp } from "../support/TestApp";
import {
  PANETONE_CPROD,
  REAL_FIXTURE_INVOICE_NUMBER,
  TRUFA_CPROD,
  buildNfeXml,
  readRealNfeFixture,
} from "../support/nfeFixtures";

const SCANNED_AT = "2026-08-17T10:00:00.000Z";

describe("Ciclo de vida da nota (HTTP)", () => {
  let app: TestApp;
  let cookie: string;

  const createNote = async (invoiceNumber: string) => {
    const response = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(cookie, "POST", { invoiceNumber }),
    );
    expect(response.status).toBe(201);
    return (await response.json()) as { noteId: string; items: { itemId: string }[] };
  };

  const scan = (scannedCode: string, extra: Record<string, unknown> = {}) =>
    fetch(
      `${app.baseUrl}/scan-events`,
      jsonRequest(cookie, "POST", {
        clientEventId: randomUUID(),
        scannedCode,
        scannedAt: SCANNED_AT,
        ...extra,
      }),
    );

  const getNote = async (noteId: string) => {
    const response = await fetch(`${app.baseUrl}/notes/${noteId}`, jsonRequest(cookie, "GET"));
    expect(response.status).toBe(200);
    return (await response.json()) as {
      status: string;
      items: { cProd: string; confirmedQty: number; expectedQty: number }[];
    };
  };

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.reset();
    app.fixtureServer.respondWithXml(REAL_FIXTURE_INVOICE_NUMBER, readRealNfeFixture());
    cookie = await app.login(OPERADOR);
  });

  it("IT-001 POST /notes cria a nota com os itens exatos da fixture 004005647.xml", async () => {
    const response = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(cookie, "POST", { invoiceNumber: REAL_FIXTURE_INVOICE_NUMBER }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      noteId: string;
      status: string;
      items: { description: string; expectedQty: number; confirmedQty: number }[];
    };
    expect(body.status).toBe("open");
    expect(body.items).toEqual([
      {
        itemId: expect.any(String),
        description: "PANETTONE GOTAS 450GX18UN",
        expectedQty: 8,
        confirmedQty: 0,
      },
    ]);
    const detail = await getNote(body.noteId);
    expect(detail.items[0]).toMatchObject({ cProd: PANETONE_CPROD, cEan: null, unit: "CX" });
  });

  it("IT-002 POST /notes com nota já aberta devolve 409", async () => {
    await createNote(REAL_FIXTURE_INVOICE_NUMBER);

    const response = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(cookie, "POST", { invoiceNumber: REAL_FIXTURE_INVOICE_NUMBER }),
    );

    expect(response.status).toBe(409);
  });

  // Prova o mecanismo que sustenta o IT-002 sob concorrência: sem esta serialização, as
  // duas transações leem "não existe" antes de qualquer INSERT commitar (READ COMMITTED,
  // e invoice_number não tem índice único) e abrem duas notas com o mesmo número.
  it("IT-002b lockInvoiceNumber bloqueia a segunda transação até a primeira terminar", async () => {
    const db = app.connection.getDb();
    const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
    let firstAcquired = (): void => {};
    let releaseFirst = (): void => {};
    const acquired = new Promise<void>((resolve) => {
      firstAcquired = resolve;
    });
    const held = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let secondAcquired = false;

    const first = db.transaction(async (tx) => {
      await new NoteRepositoryDatabase(tx).lockInvoiceNumber(REAL_FIXTURE_INVOICE_NUMBER);
      firstAcquired();
      await held;
    });
    await acquired;
    const second = db.transaction(async (tx) => {
      await new NoteRepositoryDatabase(tx).lockInvoiceNumber(REAL_FIXTURE_INVOICE_NUMBER);
      secondAcquired = true;
    });

    await settle();
    expect(secondAcquired).toBe(false);
    releaseFirst();
    await Promise.all([first, second]);
    expect(secondAcquired).toBe(true);
  });

  it("IT-002c números diferentes não bloqueiam um ao outro", async () => {
    const db = app.connection.getDb();
    let releaseFirst = (): void => {};
    const held = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = db.transaction(async (tx) => {
      await new NoteRepositoryDatabase(tx).lockInvoiceNumber(REAL_FIXTURE_INVOICE_NUMBER);
      await held;
    });
    await db.transaction((tx) => new NoteRepositoryDatabase(tx).lockInvoiceNumber("004009999"));

    releaseFirst();
    await first;
  });

  it("IT-003 POST /notes com documento inexistente na API devolve 404", async () => {
    const response = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(cookie, "POST", { invoiceNumber: "999999999" }),
    );

    expect(response.status).toBe(404);
  });

  it("IT-004 POST /notes com falha da API externa devolve 502", async () => {
    app.fixtureServer.respondWith("004009999", { status: 500, body: "erro interno" });

    const response = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(cookie, "POST", { invoiceNumber: "004009999" }),
    );

    expect(response.status).toBe(502);
  });

  it("IT-005 POST /scan-events incrementa o progresso visível em GET /notes/:id", async () => {
    const note = await createNote(REAL_FIXTURE_INVOICE_NUMBER);

    const response = await scan(PANETONE_CPROD);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resolution: { kind: "matched", noteId: note.noteId, itemId: note.items[0]?.itemId },
    });
    const detail = await getNote(note.noteId);
    expect(detail.items[0]?.confirmedQty).toBe(1);
  });

  it("IT-006 completar todos os itens transiciona a nota para completed", async () => {
    const note = await createNote(REAL_FIXTURE_INVOICE_NUMBER);

    for (let index = 0; index < 8; index += 1) await scan(PANETONE_CPROD);

    const detail = await getNote(note.noteId);
    expect(detail.status).toBe("completed");
    expect(detail.items[0]?.confirmedQty).toBe(8);
  });

  it("IT-031 rebipagem de item de nota recém-concluída devolve exceeded, não unidentified", async () => {
    app.fixtureServer.respondWithXml(
      "000000001",
      buildNfeXml({
        chaveAcesso: "5".repeat(44),
        nNF: "1",
        items: [{ cProd: PANETONE_CPROD, xProd: "PANETTONE", qCom: 1 }],
      }),
    );
    app.fixtureServer.respondWithXml(
      "000000002",
      buildNfeXml({
        chaveAcesso: "6".repeat(44),
        nNF: "2",
        items: [{ cProd: TRUFA_CPROD, xProd: "TRUFA", qCom: 1 }],
      }),
    );
    const note1 = await createNote("000000001");
    await createNote("000000002");
    await scan(PANETONE_CPROD);
    expect((await getNote(note1.noteId)).status).toBe("completed");

    const response = await scan(PANETONE_CPROD);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resolution: { kind: "exceeded", noteId: note1.noteId, itemId: note1.items[0]?.itemId },
    });
    expect((await getNote(note1.noteId)).items[0]?.confirmedQty).toBe(1);
  });

  it("IT-029 bipagens concorrentes do mesmo item não ultrapassam a quantidade esperada", async () => {
    const note = await createNote(REAL_FIXTURE_INVOICE_NUMBER);

    // 12 requisições realmente simultâneas contra as 8 caixas esperadas: cada uma abre a
    // própria transação e lê o contador antes de qualquer escrita, então só o `UPDATE`
    // guardado no banco impede que a 9ª seja aceita.
    const responses = await Promise.all(Array.from({ length: 12 }, () => scan(PANETONE_CPROD)));

    const kinds = await Promise.all(
      responses.map(async (response) => {
        expect(response.status).toBe(200);
        const body = (await response.json()) as { resolution: { kind: string } };
        return body.resolution.kind;
      }),
    );
    expect(kinds.filter((kind) => kind === "matched")).toHaveLength(8);
    expect(kinds.filter((kind) => kind === "exceeded")).toHaveLength(4);
    const detail = await getNote(note.noteId);
    expect(detail.items[0]?.confirmedQty).toBe(8);
    expect(detail.status).toBe("completed");
  });

  it("IT-007 finalizar com itens pendentes sem confirmIncomplete devolve 409", async () => {
    const note = await createNote(REAL_FIXTURE_INVOICE_NUMBER);

    const response = await fetch(
      `${app.baseUrl}/notes/${note.noteId}/finalize`,
      jsonRequest(cookie, "POST", {}),
    );

    expect(response.status).toBe(409);
    expect((await getNote(note.noteId)).status).toBe("open");
  });

  it("IT-008 finalizar com confirmIncomplete devolve 200 e o relatório lista os faltantes", async () => {
    const note = await createNote(REAL_FIXTURE_INVOICE_NUMBER);
    await scan(PANETONE_CPROD);

    const finalize = await fetch(
      `${app.baseUrl}/notes/${note.noteId}/finalize`,
      jsonRequest(cookie, "POST", { confirmIncomplete: true }),
    );
    expect(finalize.status).toBe(200);

    const report = await fetch(
      `${app.baseUrl}/notes/${note.noteId}/report`,
      jsonRequest(cookie, "GET"),
    );
    expect(report.status).toBe(200);
    const body = (await report.json()) as {
      status: string;
      missingItems: { description: string; missingQty: number }[];
    };
    expect(body.status).toBe("closed_incomplete");
    expect(body.missingItems).toEqual([
      expect.objectContaining({ description: "PANETTONE GOTAS 450GX18UN", missingQty: 7 }),
    ]);
  });

  it("IT-009 reproduz o cenário de referência do ADR-001 via HTTP", async () => {
    app.fixtureServer.respondWithXml(
      "000000001",
      buildNfeXml({
        chaveAcesso: "3".repeat(44),
        nNF: "1",
        items: [{ cProd: PANETONE_CPROD, xProd: "PANETTONE", qCom: 10 }],
      }),
    );
    app.fixtureServer.respondWithXml(
      "000000002",
      buildNfeXml({
        chaveAcesso: "4".repeat(44),
        nNF: "2",
        items: [
          { cProd: PANETONE_CPROD, xProd: "PANETTONE", qCom: 10 },
          { cProd: TRUFA_CPROD, xProd: "TRUFA", qCom: 1 },
        ],
      }),
    );
    const note1 = await createNote("000000001");
    const note2 = await createNote("000000002");

    // A trufa é exclusiva da nota 2: confirmá-la faz dela a nota que mais avança em
    // percentual de conclusão, "puxando" os panetones seguintes (ADR-001).
    await scan(TRUFA_CPROD);
    for (let index = 0; index < 10; index += 1) await scan(PANETONE_CPROD);

    const detail2 = await getNote(note2.noteId);
    expect(detail2.status).toBe("completed");
    const detail1 = await getNote(note1.noteId);
    expect(detail1.status).toBe("open");
    expect(detail1.items[0]?.confirmedQty).toBe(0);
  });

  it("IT-019 lista individualmente cada caixa não identificada no relatório da nota finalizada", async () => {
    const note = await createNote(REAL_FIXTURE_INVOICE_NUMBER);
    await scan("caixa-x", { markUnidentified: true });
    await scan("caixa-y", { markUnidentified: true });

    const finalize = await fetch(
      `${app.baseUrl}/notes/${note.noteId}/finalize`,
      jsonRequest(cookie, "POST", { confirmIncomplete: true }),
    );

    expect(finalize.status).toBe(200);
    const body = (await finalize.json()) as {
      report: { unidentifiedScans: { scannedCode: string }[] };
    };
    expect(body.report.unidentifiedScans.map((entry) => entry.scannedCode)).toEqual([
      "caixa-x",
      "caixa-y",
    ]);
  });

  it("IT-030 a conclusão automática já fecha a nota com autoria e reivindica as não identificadas", async () => {
    const note = await createNote(REAL_FIXTURE_INVOICE_NUMBER);
    await scan("caixa-x", { markUnidentified: true });

    for (let index = 0; index < 8; index += 1) await scan(PANETONE_CPROD);

    // Nenhuma chamada a /finalize: quem bipou a última caixa é quem fecha a nota, senão
    // o relatório sairia sem as caixas não identificadas e sem autoria (ADR-004/US-016).
    const response = await fetch(
      `${app.baseUrl}/notes/${note.noteId}/report`,
      jsonRequest(cookie, "GET"),
    );
    expect(response.status).toBe(200);
    const report = (await response.json()) as {
      status: string;
      closedAt: string | null;
      unidentifiedScans: { scannedCode: string }[];
    };
    expect(report.status).toBe("completed");
    expect(report.closedAt).not.toBeNull();
    expect(report.unidentifiedScans.map((entry) => entry.scannedCode)).toEqual(["caixa-x"]);

    // O histórico é exclusivo do gerente: é lá que a autoria do fechamento aparece.
    const gerenteCookie = await app.login(GERENTE);
    const history = await fetch(
      `${app.baseUrl}/notes/history`,
      jsonRequest(gerenteCookie, "GET"),
    );
    expect(history.status).toBe(200);
    const entries = (await history.json()) as { noteId: string; closedByName: string | null }[];
    expect(entries.find((entry) => entry.noteId === note.noteId)?.closedByName).toBe(
      "Ana Operadora",
    );
  });

  it("IT-020 mantém progresso independente com 10+ notas abertas simultaneamente", async () => {
    const noteIds: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      const invoiceNumber = String(100000000 + index);
      app.fixtureServer.respondWithXml(
        invoiceNumber,
        buildNfeXml({
          chaveAcesso: String(index).padStart(44, "0"),
          nNF: invoiceNumber,
          items: [{ cProd: `cprod-${index}`, xProd: `PRODUTO ${index}`, qCom: 2 }],
        }),
      );
      noteIds.push((await createNote(invoiceNumber)).noteId);
    }

    await scan("cprod-7");

    const queue = await fetch(`${app.baseUrl}/notes?status=open`, jsonRequest(cookie, "GET"));
    expect(queue.status).toBe(200);
    const notes = (await queue.json()) as { noteId: string; confirmedTotal: number }[];
    expect(notes).toHaveLength(12);
    const progressed = notes.filter((note) => note.confirmedTotal > 0);
    expect(progressed).toHaveLength(1);
    expect(progressed[0]?.noteId).toBe(noteIds[7]);
  });

  it("IT-021 nota finalizada como incompleta deixa de receber alocação do item compartilhado", async () => {
    const shared = buildNfeXml({
      chaveAcesso: "5".repeat(44),
      nNF: "1",
      items: [{ cProd: PANETONE_CPROD, xProd: "PANETTONE", qCom: 4 }],
    });
    app.fixtureServer.respondWithXml("000000001", shared);
    app.fixtureServer.respondWithXml(
      "000000002",
      buildNfeXml({
        chaveAcesso: "6".repeat(44),
        nNF: "2",
        items: [{ cProd: PANETONE_CPROD, xProd: "PANETTONE", qCom: 4 }],
      }),
    );
    const noteA = await createNote("000000001");
    const noteB = await createNote("000000002");
    await fetch(
      `${app.baseUrl}/notes/${noteA.noteId}/finalize`,
      jsonRequest(cookie, "POST", { confirmIncomplete: true }),
    );

    await scan(PANETONE_CPROD);

    expect((await getNote(noteA.noteId)).items[0]?.confirmedQty).toBe(0);
    expect((await getNote(noteB.noteId)).items[0]?.confirmedQty).toBe(1);
  });

  it("IT-025 GET /notes?status=open devolve a fila de notas em conferência", async () => {
    const note = await createNote(REAL_FIXTURE_INVOICE_NUMBER);

    const response = await fetch(`${app.baseUrl}/notes?status=open`, jsonRequest(cookie, "GET"));

    expect(response.status).toBe(200);
    const notes = (await response.json()) as { noteId: string; status: string }[];
    expect(notes).toEqual([expect.objectContaining({ noteId: note.noteId, status: "open" })]);
  });

  it("IT-026 GET /notes/:id devolve o detalhe completo da nota", async () => {
    const note = await createNote(REAL_FIXTURE_INVOICE_NUMBER);

    const response = await fetch(`${app.baseUrl}/notes/${note.noteId}`, jsonRequest(cookie, "GET"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      noteId: note.noteId,
      invoiceNumber: REAL_FIXTURE_INVOICE_NUMBER,
      nfeNumero: "4005647",
      supplierCnpj: "61472205000407",
      expectedTotal: 8,
      confirmedTotal: 0,
    });
  });

  it("IT-027 GET /notes/:id com id inexistente devolve 404", async () => {
    const response = await fetch(`${app.baseUrl}/notes/${randomUUID()}`, jsonRequest(cookie, "GET"));

    expect(response.status).toBe(404);
  });

  it("erro de regra de negócio do caso de uso vira 422 pelo filtro global", async () => {
    // Nenhuma nota aberta: `ApplyScanEvent` lança um `Error` puro de domínio.
    const response = await scan("caixa-x", { markUnidentified: true });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      message: "nenhuma conferência ativa",
    });
  });

  it("IT-028 POST /scan-events sem scannedCode devolve 422 de validação", async () => {
    await createNote(REAL_FIXTURE_INVOICE_NUMBER);

    const response = await fetch(
      `${app.baseUrl}/scan-events`,
      jsonRequest(cookie, "POST", { clientEventId: randomUUID(), scannedAt: SCANNED_AT }),
    );

    expect(response.status).toBe(422);
  });
});
