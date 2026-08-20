import { join } from "node:path";
import { HttpStatus, type INestApplication, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { AppModule } from "./app.module";
import type { DatabaseConnection } from "./infra/database/DatabaseConnection";
import { ErrorFilter } from "./infra/filter/ErrorFilter";
import { optionalEnv } from "./infra/util/Env";

/**
 * Pasta de migrations, resolvida a partir do diretório de trabalho (a raiz do workspace
 * `backend`, tanto no `npm start` quanto no container). `MIGRATIONS_FOLDER` sobrescreve
 * quando o processo roda de outro lugar.
 */
export const migrationsFolder = (): string =>
  optionalEnv("MIGRATIONS_FOLDER", join(process.cwd(), "drizzle"));

/**
 * Ordem de bootstrap fixa: cria o app → proxy confiável → cookies → validação de DTO →
 * filtro global de erro → CORS. Quem chama decide quando (e em qual porta) fazer `listen`.
 */
export async function createApp(): Promise<INestApplication> {
  const silent = optionalEnv("LOG_LEVEL", "log") === "silent";
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    silent ? { logger: false } : {},
  );
  // Em produção o Caddy é o único ingresso (ADR-011): confiar em 1 salto de
  // `X-Forwarded-For` faz `req.ip` valer o IP real, que é o que o throttle de login usa.
  app.set("trust proxy", Number.parseInt(optionalEnv("TRUST_PROXY_HOPS", "1"), 10));
  app.use(cookieParser());
  app.useGlobalPipes(
    // 422 em vez do 400 padrão: o contrato de API trata erro de campo como erro de
    // regra de negócio, mesmo status que o `ErrorFilter` já usa para `Error` puro.
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  app.useGlobalFilters(new ErrorFilter());
  app.enableCors({
    origin: optionalEnv("FRONTEND_ORIGIN", "http://localhost:5174"),
    credentials: true,
  });
  app.enableShutdownHooks();
  return app;
}

/** Aplica as migrations pendentes usando a conexão já registrada no container. */
export async function runMigrations(app: INestApplication): Promise<void> {
  const connection = app.get<DatabaseConnection>("DatabaseConnection");
  await migrate(connection.getDb(), { migrationsFolder: migrationsFolder() });
}
