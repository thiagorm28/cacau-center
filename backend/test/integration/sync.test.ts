import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { OPERADOR, type TestApp, jsonRequest, startTestApp } from "../support/TestApp";
import {
  PANETONE_CPROD,
  REAL_FIXTURE_INVOICE_NUMBER,
  readRealNfeFixture,
} from "../support/nfeFixtures";

const SCANNED_AT = "2026-08-17T10:00:00.000Z";

describe("Sincronização offline em lote (HTTP)", () => {
  let app: TestApp;
  let cookie: string;
  let noteId: string;

  const syncBatch = (events: ReadonlyArray<{ clientEventId: string; scannedCode: string }>) =>
    fetch(
      `${app.baseUrl}/scan-events/sync`,
      jsonRequest(cookie, "POST", {
        events: events.map((event) => ({ ...event, scannedAt: SCANNED_AT })),
      }),
    );

  const confirmedQty = async (): Promise<number> => {
    const response = await fetch(`${app.baseUrl}/notes/${noteId}`, jsonRequest(cookie, "GET"));
    const body = (await response.json()) as { items: { confirmedQty: number }[] };
    return body.items[0]?.confirmedQty ?? 0;
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
    const created = await fetch(
      `${app.baseUrl}/notes`,
      jsonRequest(cookie, "POST", { invoiceNumber: REAL_FIXTURE_INVOICE_NUMBER }),
    );
    noteId = ((await created.json()) as { noteId: string }).noteId;
  });

  it("IT-010 aplica o lote sequencialmente e o estado final reflete todas as bipagens", async () => {
    const events = Array.from({ length: 3 }, () => ({
      clientEventId: randomUUID(),
      scannedCode: PANETONE_CPROD,
    }));

    const response = await syncBatch(events);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ applied: 3, duplicates: 0 });
    expect(await confirmedQty()).toBe(3);
  });

  it("IT-011 reenviar um lote já aplicado conta duplicados sem dobrar a contagem", async () => {
    const events = Array.from({ length: 3 }, () => ({
      clientEventId: randomUUID(),
      scannedCode: PANETONE_CPROD,
    }));
    await syncBatch(events);

    const retry = await syncBatch(events);

    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toEqual({ applied: 0, duplicates: 3 });
    expect(await confirmedQty()).toBe(3);
  });
});
