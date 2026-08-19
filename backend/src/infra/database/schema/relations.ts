import { relations } from "drizzle-orm";
import { invoiceNotes } from "./invoiceNotes";
import { noteItems } from "./noteItems";
import { scanEvents } from "./scanEvents";
import { users } from "./users";

export const invoiceNotesRelations = relations(invoiceNotes, ({ one, many }) => ({
  items: many(noteItems),
  scanEvents: many(scanEvents),
  openedByUser: one(users, { fields: [invoiceNotes.openedBy], references: [users.id] }),
}));

export const noteItemsRelations = relations(noteItems, ({ one }) => ({
  note: one(invoiceNotes, { fields: [noteItems.noteId], references: [invoiceNotes.id] }),
}));

export const scanEventsRelations = relations(scanEvents, ({ one }) => ({
  note: one(invoiceNotes, { fields: [scanEvents.noteId], references: [invoiceNotes.id] }),
  item: one(noteItems, { fields: [scanEvents.noteItemId], references: [noteItems.id] }),
  scannedByUser: one(users, { fields: [scanEvents.scannedBy], references: [users.id] }),
}));
