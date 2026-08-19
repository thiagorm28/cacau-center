"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const bootstrap_1 = require("./bootstrap");
const Env_1 = require("./infra/util/Env");
/** Porta fixa do serviço em desenvolvimento, esperada pelo `playwright.config.ts`. */
const DEFAULT_PORT = 3001;
async function bootstrap() {
    const app = await (0, bootstrap_1.createApp)();
    if ((0, Env_1.optionalEnv)("SKIP_MIGRATIONS", "false") !== "true")
        await (0, bootstrap_1.runMigrations)(app);
    const port = Number.parseInt((0, Env_1.optionalEnv)("PORT", String(DEFAULT_PORT)), 10);
    await app.listen(port);
    new common_1.Logger("Bootstrap").log(`backend ouvindo na porta ${port}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map