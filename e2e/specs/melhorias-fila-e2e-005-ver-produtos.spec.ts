import { OFFLINE_INVOICE_NUMBER, PANETONE, REFERENCE_NOTE_1 } from "../support/nfeFixtures.ts";
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
 * E2E-005 — "Ver produtos" abre exatamente a nota escolhida (US-004, ADR-003),
 * mesmo quando ela não é a mais próxima da conclusão.
 */
test("E2E-005: 'Ver produtos' abre a nota do card, não a mais avançada", async ({
  page,
  scanner,
}) => {
  // Arrange — uma nota adiantada e outra zerada na fila
  await loginAs(page, OPERADOR);
  await page.getByLabel("Número de faturamento").fill(OFFLINE_INVOICE_NUMBER);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  await openNoteFromQueue(page, OFFLINE_INVOICE_NUMBER);
  await scanner.scan(PANETONE.cProd, async () => {
    await expect(itemCounter(page, PANETONE.description)).toHaveText("1/3");
  });
  await page.goto("/notas");
  await page.getByLabel("Número de faturamento").fill(REFERENCE_NOTE_1);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  await expect(queueNoteCard(page, REFERENCE_NOTE_1)).toContainText("0/10");

  // Act — abre a nota menos avançada pelo botão do próprio card
  await openNoteFromQueue(page, REFERENCE_NOTE_1);

  // Assert — a nota exibida é a escolhida, não a mais próxima da conclusão
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]+\/bipagem$/);
  await expect(page.getByRole("heading", { name: `Nota ${REFERENCE_NOTE_1}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Nota ${OFFLINE_INVOICE_NUMBER}` })).toHaveCount(0);
});
