import type {
  DivergenceReport,
  HistoryEntry,
  NoteItemView,
  NoteView,
  UserListItem,
} from "../api/types";

export const buildItem = (overrides: Partial<NoteItemView> = {}): NoteItemView => ({
  itemId: "item-1",
  cProd: "1001",
  cEan: "7891234567895",
  description: "Panetone Trufado 400g",
  unit: "CX",
  expectedQty: 3,
  confirmedQty: 0,
  missingQty: 3,
  ...overrides,
});

export const buildNote = (overrides: Partial<NoteView> = {}): NoteView => {
  const items = overrides.items ?? [buildItem()];
  return {
    noteId: "note-1",
    invoiceNumber: "004005647",
    nfeChaveAcesso: "3524" + "0".repeat(40),
    nfeNumero: "4005647",
    supplierCnpj: "22000000000100",
    supplierName: "Cacau Show Indústria",
    status: "open",
    openedAt: "2026-08-17T10:00:00.000Z",
    closedAt: null,
    expectedTotal: items.reduce((total, item) => total + item.expectedQty, 0),
    confirmedTotal: items.reduce((total, item) => total + item.confirmedQty, 0),
    ...overrides,
    items,
  };
};

export const buildReport = (overrides: Partial<DivergenceReport> = {}): DivergenceReport => ({
  noteId: "note-1",
  invoiceNumber: "004005647",
  supplierName: "Cacau Show Indústria",
  status: "closed_incomplete",
  closedAt: "2026-08-17T12:00:00.000Z",
  isComplete: false,
  items: [],
  missingItems: [],
  exceededScans: [],
  unidentifiedScans: [],
  ...overrides,
});

export const buildHistoryEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  noteId: "note-1",
  invoiceNumber: "004005647",
  supplierName: "Cacau Show Indústria",
  status: "closed_incomplete",
  openedAt: "2026-08-17T10:00:00.000Z",
  closedAt: "2026-08-17T12:00:00.000Z",
  openedByName: "Marina Souza",
  closedByName: "Marina Souza",
  expectedTotal: 10,
  confirmedTotal: 7,
  missingTotal: 3,
  ...overrides,
});

export const buildUser = (overrides: Partial<UserListItem> = {}): UserListItem => ({
  id: "user-1",
  name: "Marina Souza",
  email: "marina@loja.com",
  cpf: "52998224725",
  birthDate: "1990-03-15",
  role: "operador",
  active: true,
  mustChangePassword: false,
  ...overrides,
});
