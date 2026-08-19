import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { createApp, runMigrations } from "./bootstrap";
import { optionalEnv } from "./infra/util/Env";

/** Porta fixa do serviço em desenvolvimento, esperada pelo `playwright.config.ts`. */
const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await createApp();
  if (optionalEnv("SKIP_MIGRATIONS", "false") !== "true") await runMigrations(app);
  const port = Number.parseInt(optionalEnv("PORT", String(DEFAULT_PORT)), 10);
  await app.listen(port);
  new Logger("Bootstrap").log(`backend ouvindo na porta ${port}`);
}

void bootstrap();
