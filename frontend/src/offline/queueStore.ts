import { type DBSchema, type IDBPDatabase, openDB } from "idb";

/** Bipagem feita offline, no formato aceito por `POST /scan-events/sync`. */
export interface QueuedScan {
  kind: "scan";
  clientEventId: string;
  scannedCode: string;
  scannedAt: string;
  manualItemId?: string;
  markUnidentified?: boolean;
}

/**
 * Finalização manual de nota incompleta feita offline (US-013.EC-2). O endpoint de
 * sincronização em lote só aceita bipagens, então a ação viaja no mesmo flush, mas
 * pelo seu próprio endpoint (`POST /notes/:id/finalize`), depois das bipagens.
 */
export interface QueuedFinalize {
  kind: "finalize";
  clientEventId: string;
  noteId: string;
  confirmIncomplete: boolean;
}

export type QueuedAction = QueuedScan | QueuedFinalize;

export interface QueuedEntry {
  key: number;
  action: QueuedAction;
}

const DB_NAME = "cacau-center";
const DB_VERSION = 1;
const STORE = "pending-actions";

interface QueueDatabase extends DBSchema {
  [STORE]: {
    key: number;
    value: QueuedAction;
    indexes: { clientEventId: string };
  };
}

let connection: Promise<IDBPDatabase<QueueDatabase>> | null = null;

/** Uma única conexão por aba: abrir uma por operação vazaria handles do IndexedDB. */
const connect = (): Promise<IDBPDatabase<QueueDatabase>> => {
  connection ??= openDB<QueueDatabase>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Chave autoincremental: a ordem de leitura é a ordem de bipagem, e o
      // `resolveScan` do backend depende dessa ordem para reproduzir a alocação.
      const store = database.createObjectStore(STORE, { autoIncrement: true });
      store.createIndex("clientEventId", "clientEventId", { unique: true });
    },
  });
  return connection;
};

/** Fila completa, em ordem de enfileiramento. */
export async function readQueue(): Promise<readonly QueuedEntry[]> {
  const database = await connect();
  const [keys, actions] = await Promise.all([
    database.getAllKeys(STORE),
    database.getAll(STORE),
  ]);
  return keys.flatMap((key, index) => {
    const action = actions[index];
    return action === undefined ? [] : [{ key, action }];
  });
}

/** Enfileira a ação; `clientEventId` repetido é ignorado (idempotência local). */
export async function enqueueAction(action: QueuedAction): Promise<void> {
  const database = await connect();
  const existing = await database.getKeyFromIndex(STORE, "clientEventId", action.clientEventId);
  if (existing !== undefined) return;
  await database.add(STORE, action);
}

export async function removeActions(keys: readonly number[]): Promise<void> {
  if (keys.length === 0) return;
  const database = await connect();
  const transaction = database.transaction(STORE, "readwrite");
  await Promise.all([...keys.map((key) => transaction.store.delete(key)), transaction.done]);
}
