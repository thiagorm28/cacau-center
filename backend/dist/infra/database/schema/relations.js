"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanEventsRelations = exports.noteItemsRelations = exports.invoiceNotesRelations = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const invoiceNotes_1 = require("./invoiceNotes");
const noteItems_1 = require("./noteItems");
const scanEvents_1 = require("./scanEvents");
const users_1 = require("./users");
exports.invoiceNotesRelations = (0, drizzle_orm_1.relations)(invoiceNotes_1.invoiceNotes, ({ one, many }) => ({
    items: many(noteItems_1.noteItems),
    scanEvents: many(scanEvents_1.scanEvents),
    openedByUser: one(users_1.users, { fields: [invoiceNotes_1.invoiceNotes.openedBy], references: [users_1.users.id] }),
}));
exports.noteItemsRelations = (0, drizzle_orm_1.relations)(noteItems_1.noteItems, ({ one }) => ({
    note: one(invoiceNotes_1.invoiceNotes, { fields: [noteItems_1.noteItems.noteId], references: [invoiceNotes_1.invoiceNotes.id] }),
}));
exports.scanEventsRelations = (0, drizzle_orm_1.relations)(scanEvents_1.scanEvents, ({ one }) => ({
    note: one(invoiceNotes_1.invoiceNotes, { fields: [scanEvents_1.scanEvents.noteId], references: [invoiceNotes_1.invoiceNotes.id] }),
    item: one(noteItems_1.noteItems, { fields: [scanEvents_1.scanEvents.noteItemId], references: [noteItems_1.noteItems.id] }),
    scannedByUser: one(users_1.users, { fields: [scanEvents_1.scanEvents.scannedBy], references: [users_1.users.id] }),
}));
//# sourceMappingURL=relations.js.map