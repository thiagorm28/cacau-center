import { describe, expect, it } from "vitest";
import { pickQuickScanNote, type OpenNoteSummary } from "./pickQuickScanNote.js";

interface NoteOverrides {
  readonly noteId: string;
  readonly openedAt?: string;
  readonly confirmedTotal: number;
  readonly expectedTotal: number;
}

const makeNote = (overrides: NoteOverrides): OpenNoteSummary => ({
  noteId: overrides.noteId,
  openedAt: overrides.openedAt ?? "2026-08-22T10:00:00.000Z",
  confirmedTotal: overrides.confirmedTotal,
  expectedTotal: overrides.expectedTotal,
});

describe("pickQuickScanNote", () => {
  it("UT-010: escolhe a nota com maior percentual de conclusão", () => {
    const noteId = pickQuickScanNote([
      makeNote({ noteId: "note-a", confirmedTotal: 3, expectedTotal: 10 }),
      makeNote({ noteId: "note-b", confirmedTotal: 8, expectedTotal: 10 }),
      makeNote({ noteId: "note-c", confirmedTotal: 1, expectedTotal: 5 }),
    ]);

    expect(noteId).toBe("note-b");
  });

  it("UT-011: empate resolve pela nota aberta há mais tempo", () => {
    const notes = [
      makeNote({
        noteId: "note-a",
        openedAt: "2026-08-22T11:00:00.000Z",
        confirmedTotal: 5,
        expectedTotal: 10,
      }),
      makeNote({
        noteId: "note-b",
        openedAt: "2026-08-22T10:00:00.000Z",
        confirmedTotal: 5,
        expectedTotal: 10,
      }),
    ];

    expect(pickQuickScanNote(notes)).toBe("note-b");
    expect(pickQuickScanNote([...notes].reverse())).toBe("note-b");
  });

  it("UT-012: lista vazia retorna null", () => {
    expect(pickQuickScanNote([])).toBeNull();
  });

  it("UT-013: nota 0/0 não causa divisão por zero nem vence a nota com bipagens", () => {
    const notes = [
      makeNote({
        noteId: "note-a",
        openedAt: "2026-08-22T11:00:00.000Z",
        confirmedTotal: 0,
        expectedTotal: 0,
      }),
      makeNote({
        noteId: "note-b",
        openedAt: "2026-08-22T10:00:00.000Z",
        confirmedTotal: 1,
        expectedTotal: 5,
      }),
    ];

    expect(pickQuickScanNote(notes)).toBe("note-b");
    expect(pickQuickScanNote([...notes].reverse())).toBe("note-b");
  });

  it("openedAt inválido nunca vence o desempate contra um timestamp válido", () => {
    const notes = [
      makeNote({
        noteId: "note-a",
        openedAt: "not-a-date",
        confirmedTotal: 5,
        expectedTotal: 10,
      }),
      makeNote({
        noteId: "note-b",
        openedAt: "2026-08-22T10:00:00.000Z",
        confirmedTotal: 5,
        expectedTotal: 10,
      }),
    ];

    expect(pickQuickScanNote(notes)).toBe("note-b");
    expect(pickQuickScanNote([...notes].reverse())).toBe("note-b");
  });
});
