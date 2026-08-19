"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Registro imutável de uma bipagem (log append-only do ADR-007).
 */
class ScanEvent {
    constructor(scanEventId, clientEventId, scannedCode, result, noteId, noteItemId, scannedBy, scannedAt) {
        this.scanEventId = scanEventId;
        this.clientEventId = clientEventId;
        this.scannedCode = scannedCode;
        this.result = result;
        this.noteId = noteId;
        this.noteItemId = noteItemId;
        this.scannedBy = scannedBy;
        this.scannedAt = scannedAt;
    }
}
exports.default = ScanEvent;
//# sourceMappingURL=ScanEvent.js.map