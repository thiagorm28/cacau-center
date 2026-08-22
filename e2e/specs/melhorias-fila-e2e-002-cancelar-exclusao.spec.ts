import { OFFLINE_INVOICE_NUMBER, PANETONE } from "../support/nfeFixtures.ts";
import {
  OPERADOR,
  expect,
  itemCounter,
  loginAs,
  openNoteFromQueue,
  queueNoteCard,
  test,
} from "../support/fixtures.ts";

/**
 * E2E-002 — Cancelar a exclusão de uma nota com progresso (US-001.AC-3, US-002.AC-2).
 */
test("E2E-002: cancelar a exclusão deixa a nota e o progresso intactos", async ({
  page,
  scanner,
}) => {
  // Arrange — nota com uma caixa já bipada
  await loginAs(page, OPERADOR);
  await page.getByLabel("Número de faturamento").fill(OFFLINE_INVOICE_NUMBER);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  await openNoteFromQueue(page, OFFLINE_INVOICE_NUMBER);
  await scanner.scan(PANETONE.cProd, async () => {
    await expect(itemCounter(page, PANETONE.description)).toHaveText("1/3");
  });
  await page.goto("/notas");

  const card = queueNoteCard(page, OFFLINE_INVOICE_NUMBER);
  await expect(card).toContainText("1/3");

  // Act — abre o diálogo de exclusão
  await card.getByRole("button", { name: "Excluir" }).click();

  // Assert — o aviso declara a contagem exata que seria perdida
  const dialog = page.getByRole("dialog", { name: `Excluir a nota ${OFFLINE_INVOICE_NUMBER}?` });
  await expect(dialog).toContainText("1 de 3 caixas conferidas");
  await expect(dialog).toContainText("permanente e não pode ser desfeita");

  // Act — desiste
  await dialog.getByRole("button", { name: "Cancelar" }).click();

  // Assert — nada mudou: a nota segue na fila com o mesmo progresso
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeVisible();
  await expect(card).toContainText("1/3");
  await page.reload();
  await expect(queueNoteCard(page, OFFLINE_INVOICE_NUMBER)).toContainText("1/3");
});
