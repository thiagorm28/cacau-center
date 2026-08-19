import { describe, expect, it } from "vitest";
import { resolveScan } from "./resolveScan.js";
import type { PendingNote, PendingNoteItem, ScanResolution } from "./types.js";

interface ItemOverrides {
  readonly itemId: string;
  readonly cProd: string;
  readonly cEan?: string | null;
  readonly expectedQty: number;
  readonly confirmedQty?: number;
}

const makeItem = (overrides: ItemOverrides): PendingNoteItem => ({
  itemId: overrides.itemId,
  cProd: overrides.cProd,
  cEan: overrides.cEan ?? null,
  expectedQty: overrides.expectedQty,
  confirmedQty: overrides.confirmedQty ?? 0,
});

const makeNote = (
  noteId: string,
  openedAt: string,
  items: readonly PendingNoteItem[],
): PendingNote => ({ noteId, openedAt, items });

/**
 * Aplica uma resolução `matched` ao estado em memória, como os chamadores fazem antes da
 * bipagem seguinte. Só assim os testes de sequência exercitam o recálculo por bipagem
 * exigido pela ADR-001.
 */
const applyResolution = (
  notes: readonly PendingNote[],
  resolution: ScanResolution,
): readonly PendingNote[] => {
  if (resolution.kind !== "matched") {
    return notes;
  }
  return notes.map((note) =>
    note.noteId === resolution.noteId
      ? {
          ...note,
          items: note.items.map((item) =>
            item.itemId === resolution.itemId
              ? { ...item, confirmedQty: item.confirmedQty + 1 }
              : item,
          ),
        }
      : note,
  );
};

interface SequenceResult {
  readonly notes: readonly PendingNote[];
  readonly resolutions: readonly ScanResolution[];
}

const scanSequence = (
  initialNotes: readonly PendingNote[],
  scannedCodes: readonly string[],
): SequenceResult =>
  scannedCodes.reduce<SequenceResult>(
    (state, scannedCode) => {
      const resolution = resolveScan(state.notes, scannedCode);
      return {
        notes: applyResolution(state.notes, resolution),
        resolutions: [...state.resolutions, resolution],
      };
    },
    { notes: initialNotes, resolutions: [] },
  );

const confirmedOf = (notes: readonly PendingNote[], noteId: string, itemId: string): number =>
  notes
    .find((note) => note.noteId === noteId)
    ?.items.find((item) => item.itemId === itemId)?.confirmedQty ?? -1;

describe("resolveScan", () => {
  it("UT-001: credita a bipagem ao item pendente quando o código bate com o cProd", () => {
    // Arrange
    const notes = [
      makeNote("note-1", "2026-08-16T10:00:00.000Z", [
        makeItem({ itemId: "item-1", cProd: "PAN-001", expectedQty: 5 }),
      ]),
    ];

    // Act
    const resolution = resolveScan(notes, "PAN-001");

    // Assert
    expect(resolution).toEqual({ kind: "matched", noteId: "note-1", itemId: "item-1" });
  });

  it("UT-002: usa o cEan como fallback quando o cProd não bate", () => {
    // Arrange
    const notes = [
      makeNote("note-1", "2026-08-16T10:00:00.000Z", [
        makeItem({
          itemId: "item-1",
          cProd: "PAN-001",
          cEan: "7891234567890",
          expectedQty: 5,
        }),
      ]),
    ];

    // Act
    const resolution = resolveScan(notes, "7891234567890");

    // Assert
    expect(resolution).toEqual({ kind: "matched", noteId: "note-1", itemId: "item-1" });
  });

  describe("UT-003: cenário de referência da ADR-001 (10 panetones + 1 trufa)", () => {
    const referenceNotes = (): readonly PendingNote[] => [
      makeNote("note-1", "2026-08-16T09:00:00.000Z", [
        makeItem({ itemId: "n1-panetone", cProd: "PAN-001", expectedQty: 10 }),
      ]),
      makeNote("note-2", "2026-08-16T10:00:00.000Z", [
        makeItem({ itemId: "n2-panetone", cProd: "PAN-001", expectedQty: 10 }),
        makeItem({ itemId: "n2-trufa", cProd: "TRU-001", expectedQty: 1 }),
      ]),
    ];

    const panetones = Array.from({ length: 10 }, () => "PAN-001");

    it("credita tudo à nota 2 e mantém a nota 1 intacta (item exclusivo bipado primeiro)", () => {
      // Arrange
      const notes = referenceNotes();

      // Act
      const { notes: finalNotes, resolutions } = scanSequence(notes, ["TRU-001", ...panetones]);

      // Assert
      expect(resolutions.every((resolution) => resolution.kind === "matched")).toBe(true);
      expect(
        resolutions.every(
          (resolution) => resolution.kind === "matched" && resolution.noteId === "note-2",
        ),
      ).toBe(true);
      expect(confirmedOf(finalNotes, "note-2", "n2-panetone")).toBe(10);
      expect(confirmedOf(finalNotes, "note-2", "n2-trufa")).toBe(1);
      expect(confirmedOf(finalNotes, "note-1", "n1-panetone")).toBe(0);
    });

    it("credita tudo à nota 2 quando a trufa vem antes de qualquer panetone compartilhado", () => {
      // Arrange
      const notes = referenceNotes();
      const interleaved = ["TRU-001", ...panetones.slice(0, 4), ...panetones.slice(4)];

      // Act
      const { notes: finalNotes } = scanSequence(notes, interleaved);

      // Assert
      expect(confirmedOf(finalNotes, "note-2", "n2-panetone")).toBe(10);
      expect(confirmedOf(finalNotes, "note-2", "n2-trufa")).toBe(1);
      expect(confirmedOf(finalNotes, "note-1", "n1-panetone")).toBe(0);
    });

    /**
     * Limite conhecido do recálculo por bipagem escolhido na ADR-001: com todos os
     * panetones bipados ANTES da trufa, a nota 1 já é a que maximiza o percentual de
     * conclusão em cada bipagem individual e absorve os 10 panetones. A ADR só garante
     * que o item exclusivo "puxa" as bipagens SEGUINTES — sem lookahead sobre bipagens
     * futuras, nenhuma função pura por bipagem consegue reverter as anteriores. Este
     * teste fixa o comportamento real para que a divergência com o texto "em qualquer
     * ordem" (US-009.AC-3) fique explícita em vez de silenciosa.
     */
    it("com a trufa por último, a nota 1 absorve os panetones (limite do recálculo por bipagem)", () => {
      // Arrange
      const notes = referenceNotes();

      // Act
      const { notes: finalNotes } = scanSequence(notes, [...panetones, "TRU-001"]);

      // Assert
      expect(confirmedOf(finalNotes, "note-1", "n1-panetone")).toBe(10);
      expect(confirmedOf(finalNotes, "note-2", "n2-panetone")).toBe(0);
      expect(confirmedOf(finalNotes, "note-2", "n2-trufa")).toBe(1);
    });
  });

  it("UT-004: desempata pelo openedAt mais antigo quando o percentual resultante empata", () => {
    // Arrange
    const olderNote = makeNote("note-older", "2026-08-16T08:00:00.000Z", [
      makeItem({ itemId: "older-item", cProd: "PAN-001", expectedQty: 4 }),
    ]);
    const newerNote = makeNote("note-newer", "2026-08-16T09:00:00.000Z", [
      makeItem({ itemId: "newer-item", cProd: "PAN-001", expectedQty: 4 }),
    ]);

    // Act
    const resolution = resolveScan([newerNote, olderNote], "PAN-001");

    // Assert
    expect(resolution).toEqual({
      kind: "matched",
      noteId: "note-older",
      itemId: "older-item",
    });
  });

  it("UT-005: entre três notas candidatas, escolhe a de maior percentual resultante", () => {
    // Arrange
    const notes = [
      // 2/10 = 20%
      makeNote("note-1", "2026-08-16T08:00:00.000Z", [
        makeItem({ itemId: "item-1", cProd: "PAN-001", expectedQty: 10, confirmedQty: 1 }),
      ]),
      // 4/5 = 80%
      makeNote("note-2", "2026-08-16T09:00:00.000Z", [
        makeItem({ itemId: "item-2", cProd: "PAN-001", expectedQty: 5, confirmedQty: 3 }),
      ]),
      // 3/6 = 50%
      makeNote("note-3", "2026-08-16T10:00:00.000Z", [
        makeItem({ itemId: "item-3", cProd: "PAN-001", expectedQty: 6, confirmedQty: 2 }),
      ]),
    ];

    // Act
    const resolution = resolveScan(notes, "PAN-001");

    // Assert
    expect(resolution).toEqual({ kind: "matched", noteId: "note-2", itemId: "item-2" });
  });

  it("UT-006: resolve exceeded quando o item já está totalmente confirmado", () => {
    // Arrange
    const notes = [
      makeNote("note-1", "2026-08-16T10:00:00.000Z", [
        makeItem({ itemId: "item-1", cProd: "PAN-001", expectedQty: 3, confirmedQty: 3 }),
      ]),
    ];

    // Act
    const resolution = resolveScan(notes, "PAN-001");

    // Assert
    expect(resolution).toEqual({ kind: "exceeded", noteId: "note-1", itemId: "item-1" });
  });

  it("UT-007: resolve unidentified quando o código não existe em nenhuma nota aberta", () => {
    // Arrange
    const notes = [
      makeNote("note-1", "2026-08-16T10:00:00.000Z", [
        makeItem({ itemId: "item-1", cProd: "PAN-001", cEan: "7891234567890", expectedQty: 3 }),
      ]),
      makeNote("note-2", "2026-08-16T11:00:00.000Z", [
        makeItem({ itemId: "item-2", cProd: "TRU-001", expectedQty: 1, confirmedQty: 1 }),
      ]),
    ];

    // Act
    const resolution = resolveScan(notes, "DESCONHECIDO-999");

    // Assert
    expect(resolution).toEqual({ kind: "unidentified" });
  });

  it("UT-008: resolve unidentified quando não há notas abertas", () => {
    // Arrange
    const notes: readonly PendingNote[] = [];

    // Act
    const resolution = resolveScan(notes, "PAN-001");

    // Assert
    expect(resolution).toEqual({ kind: "unidentified" });
  });

  it("UT-009: item pendente continua candidato mesmo com outro item da nota já completo", () => {
    // Arrange
    const notes = [
      makeNote("note-1", "2026-08-16T10:00:00.000Z", [
        makeItem({ itemId: "item-completo", cProd: "TRU-001", expectedQty: 2, confirmedQty: 2 }),
        makeItem({ itemId: "item-pendente", cProd: "PAN-001", expectedQty: 4, confirmedQty: 1 }),
      ]),
    ];

    // Act
    const resolution = resolveScan(notes, "PAN-001");

    // Assert
    expect(resolution).toEqual({
      kind: "matched",
      noteId: "note-1",
      itemId: "item-pendente",
    });
  });

  it("UT-010: bipar o mesmo conjunto de produtos em ordens diferentes converge para a mesma alocação", () => {
    // Arrange
    const initialNotes = (): readonly PendingNote[] => [
      makeNote("note-1", "2026-08-16T08:00:00.000Z", [
        makeItem({ itemId: "n1-panetone", cProd: "PAN-001", expectedQty: 1 }),
        makeItem({ itemId: "n1-trufa", cProd: "TRU-001", expectedQty: 1 }),
      ]),
      makeNote("note-2", "2026-08-16T09:00:00.000Z", [
        makeItem({ itemId: "n2-panetone", cProd: "PAN-001", expectedQty: 1 }),
        makeItem({ itemId: "n2-trufa", cProd: "TRU-001", expectedQty: 1 }),
      ]),
    ];

    // Act
    const forward = scanSequence(initialNotes(), ["PAN-001", "TRU-001", "PAN-001", "TRU-001"]);
    const reversed = scanSequence(initialNotes(), ["TRU-001", "PAN-001", "TRU-001", "PAN-001"]);

    // Assert
    expect(reversed.notes).toEqual(forward.notes);
    expect(confirmedOf(forward.notes, "note-1", "n1-panetone")).toBe(1);
    expect(confirmedOf(forward.notes, "note-1", "n1-trufa")).toBe(1);
    expect(confirmedOf(forward.notes, "note-2", "n2-panetone")).toBe(1);
    expect(confirmedOf(forward.notes, "note-2", "n2-trufa")).toBe(1);
  });
});
