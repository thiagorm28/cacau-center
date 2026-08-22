import { describe, expect, it } from "vitest";
import { pickQuickScanNote, resolveScan, type OpenNoteSummary, type PendingNote } from "shared";

/**
 * IT-012: a raiz do pacote `shared` continua resolvendo `resolveScan` e passa a resolver
 * `pickQuickScanNote` — os dois pontos de entrada que backend e frontend consomem.
 */
describe("shared package root exports", () => {
  it("expõe resolveScan e pickQuickScanNote como funções chamáveis", () => {
    expect(typeof resolveScan).toBe("function");
    expect(typeof pickQuickScanNote).toBe("function");
  });

  it("resolveScan continua alocando a bipagem após a extração de completionOrder", () => {
    const openNotes: readonly PendingNote[] = [
      {
        noteId: "note-a",
        openedAt: "2026-08-22T10:00:00.000Z",
        items: [
          { itemId: "item-a", cProd: "PAN-1", cEan: null, expectedQty: 10, confirmedQty: 3 },
        ],
      },
      {
        noteId: "note-b",
        openedAt: "2026-08-22T11:00:00.000Z",
        items: [
          { itemId: "item-b", cProd: "PAN-1", cEan: null, expectedQty: 10, confirmedQty: 8 },
        ],
      },
    ];

    expect(resolveScan(openNotes, "PAN-1")).toEqual({
      kind: "matched",
      noteId: "note-b",
      itemId: "item-b",
    });
    expect(resolveScan(openNotes, "DESCONHECIDO")).toEqual({ kind: "unidentified" });
  });

  it("pickQuickScanNote escolhe a nota mais próxima da conclusão pela raiz do pacote", () => {
    const openNotes: readonly OpenNoteSummary[] = [
      {
        noteId: "note-a",
        openedAt: "2026-08-22T10:00:00.000Z",
        confirmedTotal: 3,
        expectedTotal: 10,
      },
      {
        noteId: "note-b",
        openedAt: "2026-08-22T11:00:00.000Z",
        confirmedTotal: 8,
        expectedTotal: 10,
      },
    ];

    expect(pickQuickScanNote(openNotes)).toBe("note-b");
  });
});
