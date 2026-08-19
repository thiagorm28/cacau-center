import { defineConfig, devices } from "@playwright/test";
import { DEFAULT_DATABASE_URL } from "./e2e/support/database.ts";

const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5174;
const CONTROL_PORT = Number.parseInt(process.env.E2E_CONTROL_PORT ?? "3002", 10);

const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
export const CONTROL_URL = `http://127.0.0.1:${CONTROL_PORT}`;

const databaseUrl = process.env.E2E_DATABASE_URL ?? DEFAULT_DATABASE_URL;

/**
 * Suíte E2E das jornadas de conferência de notas (`_tests.md` → End-to-End Tests).
 *
 * `backend` (3001) e `frontend` (5174) sobem juntos, como documentado no `CLAUDE.md`.
 * Um terceiro serviço local substitui a API interna da Cacau Show: o `backend` recebe
 * `NFE_BASE_URL` apontando para ele, então a suíte roda inteira sem rede externa.
 */
export default defineConfig({
  testDir: "./e2e/specs",
  // Bipar caixa a caixa exige respeitar o debounce do scanner (1,2s por releitura do
  // mesmo código), então as jornadas mais longas passam de um minuto.
  timeout: 150_000,
  expect: { timeout: 15_000 },
  // Os testes compartilham um único banco e cada um o trunca no início: rodar em
  // paralelo faria um teste apagar o estado do outro.
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? [["list"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: "retain-on-failure",
    video: "off",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/support/control-server.ts",
      url: `${CONTROL_URL}/__control/ready`,
      reuseExistingServer: process.env.CI === undefined,
      stdout: "pipe",
      timeout: 60_000,
      env: { E2E_CONTROL_PORT: String(CONTROL_PORT), E2E_DATABASE_URL: databaseUrl },
    },
    {
      // O banco precisa existir antes do boot: é no boot que o backend migra o schema.
      command:
        "node e2e/support/prepare-db.ts && npm run build -w shared -w backend && npm start -w backend",
      // `GET /auth/me` sem sessão responde 401 — status que o Playwright já aceita como
      // "servidor de pé", e não há rota pública de health no backend.
      url: `${BACKEND_URL}/auth/me`,
      reuseExistingServer: process.env.CI === undefined,
      stdout: "pipe",
      timeout: 180_000,
      env: {
        PORT: String(BACKEND_PORT),
        DATABASE_URL: databaseUrl,
        E2E_DATABASE_URL: databaseUrl,
        JWT_SECRET: "segredo-e2e",
        EMPRESA_CODE: "1102",
        // Sem isto o gateway iria à API real da Cacau Show (ADR-011).
        NFE_BASE_URL: CONTROL_URL,
        FRONTEND_ORIGIN: FRONTEND_URL,
        // A suíte loga dezenas de vezes com a mesma conta e IP; o freio de força bruta
        // do login fica desligado aqui (ele tem cobertura própria em test/integration).
        LOGIN_RATE_LIMIT: "0",
      },
    },
    {
      command: "npm run dev -w frontend",
      url: FRONTEND_URL,
      reuseExistingServer: process.env.CI === undefined,
      stdout: "pipe",
      timeout: 120_000,
      env: { VITE_API_URL: BACKEND_URL },
    },
  ],
});
