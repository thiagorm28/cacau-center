import { type APIRequestContext, type Page, expect, test as base } from "@playwright/test";
import { BoxScanner, installFakeCamera } from "./fakeCamera.ts";

export const BACKEND_URL = "http://localhost:3001";
export const CONTROL_URL = `http://127.0.0.1:${process.env.E2E_CONTROL_PORT ?? "3002"}`;

export const ADMIN = { email: "admin@loja.com", password: "senha-admin" } as const;
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
  // `exact` porque o botão de ver a senha ao lado do campo se chama "Mostrar senha".
  await page.getByLabel("Senha", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/**
 * Sai da sessão como o usuário sai: abrindo a gaveta de navegação e tocando no "Sair"
 * de dentro dela — desde o ADR-002 o logout não existe mais solto no cabeçalho.
 */
export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sair" }).click();
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

/**
 * Card de uma nota na fila de conferência. Desde o ADR-003 o card não é mais clicável
 * inteiro: ele é um item de lista com dois botões próprios ("Ver produtos" e "Excluir").
 */
export const queueNoteCard = (page: Page, invoiceNumber: string) =>
  page.getByRole("listitem").filter({ hasText: `Nota ${invoiceNumber}` });

/** Abre a bipagem de uma nota específica pelo botão explícito do card (ADR-003). */
export async function openNoteFromQueue(page: Page, invoiceNumber: string): Promise<void> {
  await queueNoteCard(page, invoiceNumber).getByRole("button", { name: "Ver produtos" }).click();
}

/** Contador `confirmadas/esperadas` de um item na tela de bipagem. */
export const itemCounter = (page: Page, description: string) =>
  page.getByLabel(`${description}: caixas confirmadas`);
