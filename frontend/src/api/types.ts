/**
 * Espelho tipado do contrato REST do `backend` (TechSpec — API Endpoints).
 * Nenhum destes tipos é editado no cliente: são apenas a forma do que chega.
 */

export type UserRole = "operador" | "gerente" | "admin";

export type NoteStatus = "open" | "completed" | "closed_incomplete";

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
  /** Troca de senha obrigatória pendente (ADR-002): bloqueia o resto do app. */
  mustChangePassword: boolean;
}

/** Papel atribuível pela gestão de usuários: `admin` nunca é opção (ADR-001). */
export type AssignableRole = Exclude<UserRole, "admin">;

/** Linha de `GET /users`: basta para a listagem e para pré-preencher a edição. */
export interface UserListItem {
  id: string;
  name: string;
  email: string;
  /** Só dígitos, 11 caracteres. */
  cpf: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  cpf: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  role: AssignableRole;
}

/** CPF e e-mail não são editáveis (Business Rules do PRD). */
export interface UpdateUserInput {
  name: string;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  role: AssignableRole;
}

export interface ChangePasswordInput {
  newPassword: string;
  confirmPassword: string;
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
