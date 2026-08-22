import { describe, expect, it } from "vitest";
import {
  isCloserToCompletion,
  parseOpenedAt,
  type CompletionCandidate,
} from "./completionOrder.js";

const makeCandidate = (
  confirmedQty: number,
  totalExpected: number,
  openedAtMs: number,
): CompletionCandidate => ({ confirmedQty, totalExpected, openedAtMs });

describe("isCloserToCompletion", () => {
  it("UT-006: retorna true quando o candidato tem percentual estritamente maior", () => {
    const candidate = makeCandidate(8, 10, 2_000);
    const incumbent = makeCandidate(3, 10, 1_000);

    expect(isCloserToCompletion(candidate, incumbent)).toBe(true);
    expect(isCloserToCompletion(incumbent, candidate)).toBe(false);
  });

  it("UT-007: empate exato resolve pelo openedAtMs mais antigo", () => {
    const older = makeCandidate(1, 2, 1_000);
    const newer = makeCandidate(5, 10, 2_000);

    expect(isCloserToCompletion(older, newer)).toBe(true);
    expect(isCloserToCompletion(newer, older)).toBe(false);
  });

  it("UT-008: dois candidatos 0/0 não dividem por zero e resolvem pelo openedAtMs", () => {
    const older = makeCandidate(0, 0, 1_000);
    const newer = makeCandidate(0, 0, 2_000);

    expect(isCloserToCompletion(older, newer)).toBe(true);
    expect(isCloserToCompletion(newer, older)).toBe(false);
  });

  it("UT-008: candidato 0/0 comparado a um percentual não nulo também não divide por zero", () => {
    const empty = makeCandidate(0, 0, 2_000);
    const partial = makeCandidate(1, 5, 1_000);

    // Multiplicação cruzada: 0*5 === 1*0, então a comparação cai no desempate FIFO.
    expect(isCloserToCompletion(empty, partial)).toBe(false);
    expect(isCloserToCompletion(partial, empty)).toBe(true);
  });
});

describe("parseOpenedAt", () => {
  it("UT-009: timestamp inválido vira +Infinity", () => {
    expect(parseOpenedAt("not-a-date")).toBe(Number.POSITIVE_INFINITY);
  });

  it("UT-009: timestamp ISO válido vira os milissegundos correspondentes", () => {
    expect(parseOpenedAt("2026-08-22T10:00:00.000Z")).toBe(
      Date.parse("2026-08-22T10:00:00.000Z"),
    );
  });
});
