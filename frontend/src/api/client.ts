import type {
  ChangePasswordInput,
  CreateUserInput,
  CreatedNote,
  DivergenceReport,
  FinalizeResult,
  HistoryEntry,
  NoteStatus,
  NoteView,
  ScanEventPayload,
  ScanEventResult,
  SessionUser,
  SyncResult,
  UpdateUserInput,
  UserListItem,
} from "./types";

/** Erro de resposta HTTP do backend, já com o `statusCode` do `ErrorFilter`. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Falha de rede/offline: nenhuma resposta chegou do backend. */
export class NetworkError extends Error {
  constructor(message = "Sem conexão com o servidor") {
    super(message);
    this.name = "NetworkError";
  }
}

const baseUrl = (): string => (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type SessionExpiredListener = () => void;

let sessionExpiredListener: SessionExpiredListener | null = null;

/**
 * Registra quem reage a um `401` (ou remove o ouvinte, com `null`). O cliente HTTP é o
 * único ponto que enxerga o status de toda chamada, então é daqui que a camada de sessão
 * fica sabendo que o cookie expirou no meio da conferência (US-015.EC-2).
 */
export const setSessionExpiredListener = (listener: SessionExpiredListener | null): void => {
  sessionExpiredListener = listener;
};

const errorMessage = async (response: Response): Promise<string> => {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "message" in body) {
      const { message } = body as { message: unknown };
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.join(", ");
    }
  } catch {
    // corpo vazio ou não-JSON: cai na mensagem genérica abaixo
  }
  return `Falha na requisição (${response.status})`;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${baseUrl()}${path}`, {
    // A sessão é um cookie httpOnly (ADR-009): o cliente nunca lê o token,
    // apenas garante que ele viaje em toda requisição cross-origin.
    credentials: "include",
    headers: init?.body === undefined ? {} : { "Content-Type": "application/json" },
    ...init,
  }).catch(() => {
    throw new NetworkError();
  });
  if (!response.ok) {
    if (response.status === 401) sessionExpiredListener?.();
    throw new ApiError(response.status, await errorMessage(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

const patch = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });

const del = <T>(path: string): Promise<T> => request<T>(path, { method: "DELETE" });

export const login = (email: string, password: string): Promise<SessionUser> =>
  post<SessionUser>("/auth/login", { email, password });

export const logout = (): Promise<void> => post<void>("/auth/logout");

export const me = (): Promise<SessionUser> => request<SessionUser>("/auth/me");

/**
 * Conclui a troca obrigatória (ADR-002). O backend reemite o cookie de sessão já sem a
 * pendência e devolve a identidade atualizada — não é preciso relogar depois.
 */
export const changePassword = (input: ChangePasswordInput): Promise<SessionUser> =>
  post<SessionUser>("/auth/change-password", input);

/**
 * Gestão de contas (`/users`, exclusiva do admin — US-012). O backend devolve a lista
 * embrulhada em `{ users }`; o cliente entrega só o array, que é o que as telas usam.
 */
export const listUsers = async (): Promise<readonly UserListItem[]> => {
  const { users } = await request<{ users: UserListItem[] }>("/users");
  return users;
};

export const createUser = (input: CreateUserInput): Promise<{ id: string }> =>
  post<{ id: string }>("/users", input);

export const updateUser = (userId: string, input: UpdateUserInput): Promise<{ id: string }> =>
  patch<{ id: string }>(`/users/${userId}`, input);

export const deactivateUser = (userId: string): Promise<void> =>
  post<void>(`/users/${userId}/deactivate`);

export const reactivateUser = (userId: string): Promise<void> =>
  post<void>(`/users/${userId}/reactivate`);

/** Devolve a conta à senha inicial `CPF@DDMMAAAA` e reabre a troca obrigatória (US-009). */
export const resetUserPassword = (userId: string): Promise<void> =>
  post<void>(`/users/${userId}/reset-password`);

export const createNote = (invoiceNumber: string): Promise<CreatedNote> =>
  post<CreatedNote>("/notes", { invoiceNumber });

export const listNotes = (status?: NoteStatus): Promise<readonly NoteView[]> =>
  request<readonly NoteView[]>(status === undefined ? "/notes" : `/notes?status=${status}`);

export const getNote = (noteId: string): Promise<NoteView> =>
  request<NoteView>(`/notes/${noteId}`);

/**
 * Exclusão definitiva de uma nota em conferência (ADR-001): o backend responde `204` sem
 * corpo, e `request()` já devolve `undefined` nesse caso.
 */
export const deleteNote = (noteId: string): Promise<void> => del<void>(`/notes/${noteId}`);

export const finalizeNote = (noteId: string, confirmIncomplete: boolean): Promise<FinalizeResult> =>
  post<FinalizeResult>(`/notes/${noteId}/finalize`, { confirmIncomplete });

export const getNoteReport = (noteId: string): Promise<DivergenceReport> =>
  request<DivergenceReport>(`/notes/${noteId}/report`);

export const listHistory = (): Promise<readonly HistoryEntry[]> =>
  request<readonly HistoryEntry[]>("/notes/history");

export const sendScanEvent = (payload: ScanEventPayload): Promise<ScanEventResult> =>
  post<ScanEventResult>("/scan-events", payload);

export const syncScanEvents = (
  events: readonly ScanEventPayload[],
): Promise<SyncResult> => post<SyncResult>("/scan-events/sync", { events });
