import type { APIRequestContext } from "@playwright/test";
import { HISTORY_INVOICE_NUMBER, PANETONE, SUPPLIER_NAME } from "../support/nfeFixtures.ts";
import {
  BackendClient,
  GERENTE,
  OPERADOR,
  expect,
  loginAs,
  test,
} from "../support/fixtures.ts";

/**
 * Deixa uma nota finalizada com divergência no histórico: 2 caixas esperadas, 1 bipada.
 * O arranjo passa pelo backend real com a sessão do operador, porque o gerente não tem
 * permissão para abrir nem bipar notas — é justamente o que o E2E-007 verifica.
 */
const closeNoteWithDivergence = async (request: APIRequestContext): Promise<string> => {
  const operador = await BackendClient.signIn(request, OPERADOR);
  const { noteId } = await operador.createNote(HISTORY_INVOICE_NUMBER);
  await operador.scan(PANETONE.cProd);
  await operador.finalize(noteId);
  return noteId;
};

/** E2E-006 — Acesso e histórico gerencial (US-015, US-016, US-017). */
test("E2E-006: gerente entra, abre o histórico e lê o relatório da nota finalizada", async ({
  page,
  request,
}) => {
  // Arrange
  await closeNoteWithDivergence(request);

  // Act — o gerente entra e cai direto no histórico, sua tela inicial
  await loginAs(page, GERENTE);

  // Assert — a conferência finalizada aparece no histórico
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
  const entry = page.getByRole("button", { name: new RegExp(`Nota ${HISTORY_INVOICE_NUMBER}`) });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText("Com divergência");
  await expect(entry).toContainText(SUPPLIER_NAME);

  // Act — abre o relatório daquela nota
  await entry.click();

  // Assert — o relatório mostra a divergência apurada na conferência
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]+\/relatorio$/);
  await expect(
    page.getByRole("heading", { name: `Nota ${HISTORY_INVOICE_NUMBER}` }),
  ).toBeVisible();
  await expect(page.getByText("Finalizada com divergência")).toBeVisible();
  await expect(page.getByText("Faltam 1 de 2 CX")).toBeVisible();
  await expect(page.getByText(PANETONE.description)).toBeVisible();
});

/** E2E-007 — Acesso cruzado de papel negado (US-015.EC-3). */
test("E2E-007: gerente autenticado não acessa a tela de bipagem", async ({ page, request }) => {
  // Arrange
  const noteId = await closeNoteWithDivergence(request);
  await loginAs(page, GERENTE);
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();

  // Act — tenta abrir a bipagem direto pela URL
  await page.goto(`/notas/${noteId}/bipagem`);

  // Assert — acesso negado, com a razão explícita e sem nenhuma câmera na tela
  await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Esta tela é exclusiva do papel operador.");
  await expect(page.getByLabel("Leitor de código de barras")).toHaveCount(0);

  // Assert — a fila de notas do operador também continua bloqueada
  await page.goto("/notas");
  await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
});
