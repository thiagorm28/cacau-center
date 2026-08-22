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
 * E2E-004 — Atalho de bipagem rápida (US-005, ADR-002).
 *
 * A nota mais avançada é bipada enquanto é a única aberta, para que o progresso não
 * dependa da alocação automática entre notas — o que está sob teste aqui é a escolha
 * da nota inicialmente exibida, não `resolveScan`.
 */
test("E2E-004: o botão Bipar abre a nota mais próxima da conclusão", async ({
  page,
  scanner,
}) => {
  // Arrange — primeira nota, com progresso
  await loginAs(page, OPERADOR);
  await page.getByLabel("Número de faturamento").fill(OFFLINE_INVOICE_NUMBER);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  await openNoteFromQueue(page, OFFLINE_INVOICE_NUMBER);
  await scanner.scan(PANETONE.cProd, async () => {
    await expect(itemCounter(page, PANETONE.description)).toHaveText("1/3");
  });
  await scanner.scan(PANETONE.cProd, async () => {
    await expect(itemCounter(page, PANETONE.description)).toHaveText("2/3");
  });
  await page.goto("/notas");

  // Arrange — segunda nota, aberta depois e ainda zerada
  await page.getByLabel("Número de faturamento").fill(REFERENCE_NOTE_1);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  await expect(queueNoteCard(page, OFFLINE_INVOICE_NUMBER)).toContainText("2/3");
  await expect(queueNoteCard(page, REFERENCE_NOTE_1)).toContainText("0/10");

  // Act — atalho único, fora dos cards
  await page.getByRole("button", { name: "Bipar" }).click();

  // Assert — caiu na bipagem da nota mais próxima de fechar
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]+\/bipagem$/);
  await expect(
    page.getByRole("heading", { name: `Nota ${OFFLINE_INVOICE_NUMBER}` }),
  ).toBeVisible();
});
