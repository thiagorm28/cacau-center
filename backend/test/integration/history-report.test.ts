import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invoiceNotes, users } from "../../src/infra/database/schema";
import { GERENTE, OPERADOR, type TestApp, jsonRequest, startTestApp } from "../support/TestApp";
import {
  REAL_FIXTURE_INVOICE_NUMBER,
  buildNfeXml,
  readRealNfeFixture,
} from "../support/nfeFixtures";

describe("Histórico e relatório (HTTP)", () => {
  let app: TestApp;
  let operadorCookie: string;
  let gerenteCookie: string;

  const createNote = async (invoiceNumber: string): Promise<string> => {
    const response = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(operadorCookie, "POST", { invoiceNumber }),
    );
    expect(response.status).toBe(201);
    return ((await response.json()) as { noteId: string }).noteId;
  };

  const finalize = (noteId: string) =>
    fetch(
      `${app.baseUrl}/notes/${noteId}/finalize`,
      jsonRequest(operadorCookie, "POST", { confirmIncomplete: true }),
    );

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.reset();
    app.fixtureServer.respondWithXml(REAL_FIXTURE_INVOICE_NUMBER, readRealNfeFixture());
    operadorCookie = await app.login(OPERADOR);
    gerenteCookie = await app.login(GERENTE);
  });

  it("IT-016 GET /notes/history devolve apenas notas finalizadas", async () => {
    app.fixtureServer.respondWithXml(
      "000000002",
      buildNfeXml({
        chaveAcesso: "7".repeat(44),
        nNF: "2",
        items: [{ cProd: "cprod-2", xProd: "OUTRO", qCom: 1 }],
      }),
    );
    const finalizada = await createNote(REAL_FIXTURE_INVOICE_NUMBER);
    await createNote("000000002");
    await finalize(finalizada);

    const response = await fetch(
      `${app.baseUrl}/notes/history`,
      jsonRequest(gerenteCookie, "GET"),
    );

    expect(response.status).toBe(200);
    const history = (await response.json()) as {
      noteId: string;
      status: string;
      closedByName: string | null;
    }[];
    expect(history).toEqual([
      expect.objectContaining({
        noteId: finalizada,
        status: "closed_incomplete",
        closedByName: "Ana Operadora",
      }),
    ]);
  });

  it("IT-017 GET /notes/:id/report numa nota ainda open devolve 409", async () => {
    const noteId = await createNote(REAL_FIXTURE_INVOICE_NUMBER);

    const response = await fetch(
      `${app.baseUrl}/notes/${noteId}/report`,
      jsonRequest(gerenteCookie, "GET"),
    );

    expect(response.status).toBe(409);
  });

  it("IT-022 GET /notes/history devolve a lista completa com 100+ notas finalizadas", async () => {
    const db = app.connection.getDb();
    const [operador] = await db.select().from(users).limit(1);
    const closedAt = new Date("2026-08-16T12:00:00.000Z");
    await db.insert(invoiceNotes).values(
      Array.from({ length: 120 }, (_unused, index) => ({
        invoiceNumber: String(200000000 + index),
        nfeChaveAcesso: randomUUID(),
        nfeNumero: String(index),
        supplierCnpj: "61472205000407",
        supplierName: "IBAC",
        status: "closed_incomplete" as const,
        rawXml: "<nfeProc/>",
        openedBy: operador!.id,
        closedBy: operador!.id,
        closedAt,
      })),
    );

    const response = await fetch(
      `${app.baseUrl}/notes/history`,
      jsonRequest(gerenteCookie, "GET"),
    );

    expect(response.status).toBe(200);
    const history = (await response.json()) as unknown[];
    expect(history).toHaveLength(120);
  });
});
