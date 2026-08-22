import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { noteItems, scanEvents } from "../../src/infra/database/schema";
import { GERENTE, OPERADOR, type TestApp, jsonRequest, startTestApp } from "../support/TestApp";
import {
  PANETONE_CPROD,
  REAL_FIXTURE_INVOICE_NUMBER,
  readRealNfeFixture,
} from "../support/nfeFixtures";

const SCANNED_AT = "2026-08-17T10:00:00.000Z";

describe("Exclusão de nota em conferência (HTTP)", () => {
  let app: TestApp;
  let cookie: string;

  const createNote = async () => {
    const response = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(cookie, "POST", { invoiceNumber: REAL_FIXTURE_INVOICE_NUMBER }),
    );
    expect(response.status).toBe(201);
    return (await response.json()) as { noteId: string; items: { itemId: string }[] };
  };

  const scan = (scannedCode: string) =>
    fetch(
      `${app.baseUrl}/scan-events`,
      jsonRequest(cookie, "POST", {
        clientEventId: randomUUID(),
        scannedCode,
        scannedAt: SCANNED_AT,
      }),
    );

  const deleteNote = (noteId: string, sessionCookie = cookie) =>
    fetch(`${app.baseUrl}/notes/${noteId}`, jsonRequest(sessionCookie, "DELETE"));

  const getNote = (noteId: string, sessionCookie = cookie) =>
    fetch(`${app.baseUrl}/notes/${noteId}`, jsonRequest(sessionCookie, "GET"));

  const countRows = async (noteId: string) => {
    const db = app.connection.getDb();
    const items = await db.select().from(noteItems).where(eq(noteItems.noteId, noteId));
    const events = await db.select().from(scanEvents).where(eq(scanEvents.noteId, noteId));
    return { items: items.length, events: events.length };
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

  it("IT-001 operador exclui uma nota aberta sem bipagens e ela some do sistema", async () => {
    const note = await createNote();

    const response = await deleteNote(note.noteId);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect((await getNote(note.noteId)).status).toBe(404);
    expect(await countRows(note.noteId)).toEqual({ items: 0, events: 0 });
  });

  it("IT-002 operador exclui uma nota com itens confirmados e bipagens registradas", async () => {
    const note = await createNote();
    await scan(PANETONE_CPROD);
    await scan(PANETONE_CPROD);
    expect(await countRows(note.noteId)).toEqual({ items: 1, events: 2 });

    const response = await deleteNote(note.noteId);

    expect(response.status).toBe(204);
    const queue = await fetch(`${app.baseUrl}/notes?status=open`, jsonRequest(cookie, "GET"));
    const notes = (await queue.json()) as { noteId: string }[];
    expect(notes.map((entry) => entry.noteId)).not.toContain(note.noteId);
    expect((await getNote(note.noteId)).status).toBe(404);
    expect(await countRows(note.noteId)).toEqual({ items: 0, events: 0 });
  });

  it("IT-003 gerente autenticado não pode excluir e a nota permanece intacta", async () => {
    const note = await createNote();
    const gerenteCookie = await app.login(GERENTE);

    const response = await deleteNote(note.noteId, gerenteCookie);

    expect(response.status).toBe(403);
    expect((await getNote(note.noteId, gerenteCookie)).status).toBe(200);
  });

  it("IT-004 requisição sem sessão devolve 401", async () => {
    const note = await createNote();

    const response = await deleteNote(note.noteId, "");

    expect(response.status).toBe(401);
    expect((await getNote(note.noteId)).status).toBe(200);
  });

  it("IT-005 uuid válido sem nota correspondente devolve 404", async () => {
    const response = await deleteNote(randomUUID());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ message: "Nota não encontrada" });
  });

  it("IT-006 id fora do formato uuid devolve 404", async () => {
    const response = await deleteNote("nota-invalida");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ message: "Nota não encontrada" });
  });

  it("IT-007 nota já completed devolve 409 e continua no banco", async () => {
    const note = await createNote();
    for (let index = 0; index < 8; index += 1) await scan(PANETONE_CPROD);

    const response = await deleteNote(note.noteId);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: "Nota não está mais em conferência",
    });
    expect((await getNote(note.noteId)).status).toBe(200);
  });

  it("IT-008 nota já closed_incomplete devolve 409", async () => {
    const note = await createNote();
    const finalize = await fetch(
      `${app.baseUrl}/notes/${note.noteId}/finalize`,
      jsonRequest(cookie, "POST", { confirmIncomplete: true }),
    );
    expect(finalize.status).toBe(200);

    const response = await deleteNote(note.noteId);

    expect(response.status).toBe(409);
    expect((await getNote(note.noteId)).status).toBe(200);
  });

  it("IT-009 excluir duas vezes a mesma nota devolve 204 e depois 404", async () => {
    const note = await createNote();

    const first = await deleteNote(note.noteId);
    const second = await deleteNote(note.noteId);

    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
  });

  it("IT-010 sync de bipagem manual para item de nota excluída falha sem gravar evento", async () => {
    const note = await createNote();
    const itemId = note.items[0]?.itemId;
    expect(itemId).toBeDefined();
    expect((await deleteNote(note.noteId)).status).toBe(204);

    const response = await fetch(
      `${app.baseUrl}/scan-events/sync`,
      jsonRequest(cookie, "POST", {
        events: [
          {
            clientEventId: randomUUID(),
            scannedCode: PANETONE_CPROD,
            scannedAt: SCANNED_AT,
            manualItemId: itemId,
          },
        ],
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      message: "Item não encontrado nas notas em conferência",
    });
    const events = await app.connection.getDb().select().from(scanEvents);
    expect(events).toHaveLength(0);
  });

  it("IT-011 finalizar uma nota já excluída devolve 404", async () => {
    const note = await createNote();
    expect((await deleteNote(note.noteId)).status).toBe(204);

    const response = await fetch(
      `${app.baseUrl}/notes/${note.noteId}/finalize`,
      jsonRequest(cookie, "POST", { confirmIncomplete: true }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ message: "Nota não encontrada" });
  });
});
