"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const drizzle_orm_1 = require("drizzle-orm");
const ScanEvent_1 = __importDefault(require("../../domain/entity/ScanEvent"));
const schema_1 = require("../database/schema");
const toScanEvent = (row) => new ScanEvent_1.default(row.id, row.clientEventId, row.scannedCode, row.result, row.noteId, row.noteItemId, row.scannedBy, row.scannedAt);
class ScanEventRepositoryDatabase {
    constructor(exec) {
        this.exec = exec;
    }
    async findByClientEventId(clientEventId) {
        const [row] = await this.exec
            .select()
            .from(schema_1.scanEvents)
            .where((0, drizzle_orm_1.eq)(schema_1.scanEvents.clientEventId, clientEventId))
            .limit(1);
        return row === undefined ? null : toScanEvent(row);
    }
    async create(input) {
        const [row] = await this.exec.insert(schema_1.scanEvents).values(input).returning();
        if (row === undefined)
            throw new Error("Falha ao registrar a bipagem");
        return toScanEvent(row);
    }
    async listByNoteId(noteId) {
        const rows = await this.exec
            .select()
            .from(schema_1.scanEvents)
            .where((0, drizzle_orm_1.eq)(schema_1.scanEvents.noteId, noteId))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.scanEvents.scannedAt), (0, drizzle_orm_1.asc)(schema_1.scanEvents.createdAt));
        return rows.map(toScanEvent);
    }
    async claimUnidentified(noteId) {
        const rows = await this.exec
            .update(schema_1.scanEvents)
            .set({ noteId })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.scanEvents.result, "unidentified"), (0, drizzle_orm_1.isNull)(schema_1.scanEvents.noteId)))
            .returning({ id: schema_1.scanEvents.id });
        return rows.length;
    }
    async deleteByNoteId(noteId) {
        const rows = await this.exec
            .delete(schema_1.scanEvents)
            .where((0, drizzle_orm_1.eq)(schema_1.scanEvents.noteId, noteId))
            .returning({ id: schema_1.scanEvents.id });
        return rows.length;
    }
}
exports.default = ScanEventRepositoryDatabase;
//# sourceMappingURL=ScanEventRepository.js.map