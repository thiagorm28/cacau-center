"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanEvents = exports.scanResult = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const invoiceNotes_1 = require("./invoiceNotes");
const noteItems_1 = require("./noteItems");
const users_1 = require("./users");
exports.scanResult = (0, pg_core_1.pgEnum)("scan_result", [
    "matched",
    "manual_matched",
    "exceeded",
    "unidentified",
]);
exports.scanEvents = (0, pg_core_1.pgTable)("scan_events", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    clientEventId: (0, pg_core_1.uuid)("client_event_id").notNull().unique(),
    scannedCode: (0, pg_core_1.text)("scanned_code").notNull(),
    result: (0, exports.scanResult)("result").notNull(),
    noteId: (0, pg_core_1.uuid)("note_id").references(() => invoiceNotes_1.invoiceNotes.id),
    noteItemId: (0, pg_core_1.uuid)("note_item_id").references(() => noteItems_1.noteItems.id),
    scannedBy: (0, pg_core_1.uuid)("scanned_by")
        .notNull()
        .references(() => users_1.users.id),
    scannedAt: (0, pg_core_1.timestamp)("scanned_at", { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    (0, pg_core_1.index)("scan_events_note_id_idx").on(table.noteId),
    (0, pg_core_1.index)("scan_events_result_idx").on(table.result),
]);
//# sourceMappingURL=scanEvents.js.map