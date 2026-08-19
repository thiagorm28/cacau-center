import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { invoiceNotes } from "./invoiceNotes";
import { noteItems } from "./noteItems";
import { users } from "./users";

export const scanResult = pgEnum("scan_result", [
  "matched",
  "manual_matched",
  "exceeded",
  "unidentified",
]);

export const scanEvents = pgTable(
  "scan_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientEventId: uuid("client_event_id").notNull().unique(),
    scannedCode: text("scanned_code").notNull(),
    result: scanResult("result").notNull(),
    noteId: uuid("note_id").references(() => invoiceNotes.id),
    noteItemId: uuid("note_item_id").references(() => noteItems.id),
    scannedBy: uuid("scanned_by")
      .notNull()
      .references(() => users.id),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scan_events_note_id_idx").on(table.noteId),
    index("scan_events_result_idx").on(table.result),
  ],
);

export type ScanEventRow = typeof scanEvents.$inferSelect;
export type NewScanEventRow = typeof scanEvents.$inferInsert;
