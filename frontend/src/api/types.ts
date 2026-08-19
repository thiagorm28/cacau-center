/**
 * Espelho tipado do contrato REST do `backend` (TechSpec — API Endpoints).
 * Nenhum destes tipos é editado no cliente: são apenas a forma do que chega.
 */

export type UserRole = "operador" | "gerente";

export type NoteStatus = "open" | "completed" | "closed_incomplete";

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface NoteItemView {
  itemId: string;
  cProd: string;
  cEan: string | null;
  description: string;
  unit: string;
  expectedQty: number;
  confirmedQty: number;
  missingQty: number;
}

export interface NoteView {
  noteId: string;
  invoiceNumber: string;
  nfeChaveAcesso: string;
  nfeNumero: string;
  supplierCnpj: string;
  supplierName: string;
  status: NoteStatus;
  openedAt: string;
  closedAt: string | null;
  expectedTotal: number;
  confirmedTotal: number;
  items: readonly NoteItemView[];
}

export interface CreatedNote {
  noteId: string;
  status: NoteStatus;
  items: ReadonlyArray<{
    itemId: string;
    description: string;
    expectedQty: number;
    confirmedQty: number;
  }>;
}

export interface ReportItem {
  itemId: string;
  cProd: string;
  description: string;
  unit: string;
  expectedQty: number;
  confirmedQty: number;
  missingQty: number;
}

export interface ReportScan {
  scanEventId: string;
  scannedCode: string;
  scannedAt: string;
  itemId: string | null;
  description: string | null;
}

export interface DivergenceReport {
  noteId: string;
  invoiceNumber: string;
  supplierName: string;
  status: NoteStatus;
  closedAt: string | null;
  isComplete: boolean;
  items: readonly ReportItem[];
  missingItems: readonly ReportItem[];
  exceededScans: readonly ReportScan[];
  unidentifiedScans: readonly ReportScan[];
}

export interface HistoryEntry {
  noteId: string;
  invoiceNumber: string;
  supplierName: string;
  status: NoteStatus;
  openedAt: string;
  closedAt: string | null;
  openedByName: string | null;
  closedByName: string | null;
  expectedTotal: number;
  confirmedTotal: number;
  missingTotal: number;
}

export interface ScanEventPayload {
  clientEventId: string;
  scannedCode: string;
  scannedAt: string;
  manualItemId?: string;
  markUnidentified?: boolean;
}

export interface ScanEventResult {
  resolution:
    | { kind: "matched"; noteId: string; itemId: string }
    | { kind: "exceeded"; noteId: string; itemId: string }
    | { kind: "unidentified" };
}

export interface SyncResult {
  applied: number;
  duplicates: number;
}

export interface FinalizeResult {
  status: Exclude<NoteStatus, "open">;
  report: DivergenceReport;
}
