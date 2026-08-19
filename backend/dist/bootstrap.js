"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrationsFolder = void 0;
exports.createApp = createApp;
exports.runMigrations = runMigrations;
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const migrator_1 = require("drizzle-orm/node-postgres/migrator");
const app_module_1 = require("./app.module");
const ErrorFilter_1 = require("./infra/filter/ErrorFilter");
const Env_1 = require("./infra/util/Env");
/**
 * Pasta de migrations, resolvida a partir do diretório de trabalho (a raiz do workspace
 * `backend`, tanto no `npm start` quanto no container). `MIGRATIONS_FOLDER` sobrescreve
 * quando o processo roda de outro lugar.
 */
const migrationsFolder = () => (0, Env_1.optionalEnv)("MIGRATIONS_FOLDER", (0, node_path_1.join)(process.cwd(), "drizzle"));
exports.migrationsFolder = migrationsFolder;
/**
 * Ordem de bootstrap fixa: cria o app → proxy confiável → cookies → validação de DTO →
 * filtro global de erro → CORS. Quem chama decide quando (e em qual porta) fazer `listen`.
 */
async function createApp() {
    const silent = (0, Env_1.optionalEnv)("LOG_LEVEL", "log") === "silent";
    const app = await core_1.NestFactory.create(app_module_1.AppModule, silent ? { logger: false } : {});
    // Em produção o Caddy é o único ingresso (ADR-011): confiar em 1 salto de
    // `X-Forwarded-For` faz `req.ip` valer o IP real, que é o que o throttle de login usa.
    app.set("trust proxy", Number.parseInt((0, Env_1.optionalEnv)("TRUST_PROXY_HOPS", "1"), 10));
    app.use((0, cookie_parser_1.default)());
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
    app.useGlobalFilters(new ErrorFilter_1.ErrorFilter());
    app.enableCors({
        origin: (0, Env_1.optionalEnv)("FRONTEND_ORIGIN", "http://localhost:5174"),
        credentials: true,
    });
    app.enableShutdownHooks();
    return app;
}
/** Aplica as migrations pendentes usando a conexão já registrada no container. */
async function runMigrations(app) {
    const connection = app.get("DatabaseConnection");
    await (0, migrator_1.migrate)(connection.getDb(), { migrationsFolder: (0, exports.migrationsFolder)() });
}
//# sourceMappingURL=bootstrap.js.map