import { type APIRequestContext, type Page, expect, test as base } from "@playwright/test";
import { BoxScanner, installFakeCamera } from "./fakeCamera.ts";

export const BACKEND_URL = "http://localhost:3001";
export const CONTROL_URL = `http://127.0.0.1:${process.env.E2E_CONTROL_PORT ?? "3002"}`;

export const OPERADOR = { email: "operador@loja.com", password: "senha-operador" } as const;
export const GERENTE = { email: "gerente@loja.com", password: "senha-gerente" } as const;

interface Credentials {
  readonly email: string;
  readonly password: string;
}

/**
 * Fixtures da suíte E2E: cada teste começa com o banco truncado e as duas contas
 * recriadas, e com a câmera falsa já instalada no contexto do navegador.
 */
export const test = base.extend<{ scanner: BoxScanner }>({
  context: async ({ context }, use) => {
    await installFakeCamera(context);
    await use(context);
  },
  // Auto-fixture: roda antes de qualquer teste, garantindo estado determinístico.
  page: async ({ page, request }, use) => {
    const reset = await request.post(`${CONTROL_URL}/__control/reset`);
    expect(reset.status(), "reset do estado de teste").toBe(204);
    await use(page);
  },
  scanner: async ({ page }, use) => {
    await use(new BoxScanner(page));
  },
});

export { expect } from "@playwright/test";

/** Faz login pela própria tela de login, como o operador da loja faz. */
export async function loginAs(page: Page, credentials: Credentials): Promise<void> {
  await page.goto("/");
  await page.getByLabel("E-mail").fill(credentials.email);
  await page.getByLabel("Senha").fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/**
 * Cliente HTTP autenticado no backend, para montar o estado que a jornada sob teste
 * pressupõe (por exemplo, uma nota já finalizada antes do gerente abrir o histórico).
 */
export class BackendClient {
  private constructor(private readonly request: APIRequestContext) {}

  static async signIn(
    request: APIRequestContext,
    credentials: Credentials,
  ): Promise<BackendClient> {
    const response = await request.post(`${BACKEND_URL}/auth/login`, { data: credentials });
    expect(response.status(), "login no backend").toBe(200);
    return new BackendClient(request);
  }

  async createNote(invoiceNumber: string): Promise<{ noteId: string }> {
    const response = await this.request.post(`${BACKEND_URL}/notes`, { data: { invoiceNumber } });
    expect(response.status(), `criação da nota ${invoiceNumber}`).toBe(201);
    return (await response.json()) as { noteId: string };
  }

  async scan(scannedCode: string): Promise<void> {
    const response = await this.request.post(`${BACKEND_URL}/scan-events`, {
      data: {
        clientEventId: crypto.randomUUID(),
        scannedCode,
        scannedAt: new Date().toISOString(),
      },
    });
    expect(response.status(), `bipagem de ${scannedCode}`).toBe(200);
  }

  async finalize(noteId: string): Promise<void> {
    const response = await this.request.post(`${BACKEND_URL}/notes/${noteId}/finalize`, {
      data: { confirmIncomplete: true },
    });
    expect(response.status(), "finalização da nota").toBe(200);
  }
}

/** Contador `confirmadas/esperadas` de um item na tela de bipagem. */
export const itemCounter = (page: Page, description: string) =>
  page.getByLabel(`${description}: caixas confirmadas`);
