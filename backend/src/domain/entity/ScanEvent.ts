export type ScanEventResult = "matched" | "manual_matched" | "exceeded" | "unidentified";

/**
 * Registro imutável de uma bipagem (log append-only do ADR-007).
 */
export default class ScanEvent {
  constructor(
    readonly scanEventId: string,
    readonly clientEventId: string,
    readonly scannedCode: string,
    readonly result: ScanEventResult,
    readonly noteId: string | null,
    readonly noteItemId: string | null,
    readonly scannedBy: string,
    readonly scannedAt: Date,
  ) {}
}
