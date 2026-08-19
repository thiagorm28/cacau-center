import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { NoteView } from "../api/types";

/**
 * Último retrato conhecido das notas em conferência, com o progresso de bipagem já
 * aplicado. Complementa a fila de `queueStore`: a fila guarda o que ainda precisa ser
 * enviado, este retrato guarda o que a tela precisa mostrar para continuar bipando sem
 * rede (ADR-003, US-013) — `GET /notes` não tem cache de service worker, então sem ele
 * um reload offline deixa a bipagem sem nenhum estado para renderizar.
 *
 * Vive num banco próprio, e não no da fila, para não versionar o schema das bipagens
 * pendentes: as duas conexões são independentes e cada uma evolui sozinha.
 */
const DB_NAME = "cacau-center-notes";
const DB_VERSION = 1;
const STORE = "open-notes";
const SNAPSHOT_KEY = "snapshot";

interface SnapshotDatabase extends DBSchema {
  [STORE]: { key: string; value: readonly NoteView[] };
}

let connection: Promise<IDBPDatabase<SnapshotDatabase>> | null = null;

const connect = (): Promise<IDBPDatabase<SnapshotDatabase>> => {
  connection ??= openDB<SnapshotDatabase>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore(STORE);
    },
  });
  return connection;
};

const isNoteView = (value: unknown): value is NoteView =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as NoteView).noteId === "string" &&
  Array.isArray((value as NoteView).items);

/** Retrato salvo, ou `null` quando não há nenhum (ou o conteúdo não é utilizável). */
export const readOpenNotes = async (): Promise<readonly NoteView[] | null> => {
  try {
    const database = await connect();
    const stored = await database.get(STORE, SNAPSHOT_KEY);
    // Um retrato gravado por uma versão anterior do app pode não ter mais a forma
    // esperada: melhor ignorá-lo do que montar a bipagem com dados pela metade.
    if (!Array.isArray(stored) || !stored.every(isNoteView)) return null;
    return stored;
  } catch {
    // IndexedDB indisponível (modo privativo, cota): seguir sem cache.
    return null;
  }
};

/** Nunca rejeita: perder o retrato degrada o modo offline, não a bipagem em curso. */
export const saveOpenNotes = async (notes: readonly NoteView[]): Promise<void> => {
  try {
    const database = await connect();
    await database.put(STORE, notes, SNAPSHOT_KEY);
  } catch {
    // idem: sem storage o app continua funcionando, só não sobrevive a um reload.
  }
};
