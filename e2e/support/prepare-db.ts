import { ensureDatabase } from "./database.ts";

/**
 * Passo obrigatório antes do `backend` subir na suíte E2E: as migrations rodam no
 * boot do serviço e precisam de um banco já existente.
 */
await ensureDatabase();
