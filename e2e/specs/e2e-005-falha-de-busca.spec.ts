import {
  PANETONE,
  REAL_INVOICE_NUMBER,
  REFERENCE_NOTE_1,
  UNKNOWN_INVOICE_NUMBER,
} from "../support/nfeFixtures.ts";
import {
  OPERADOR,
  expect,
  loginAs,
  openNoteFromQueue,
  queueNoteCard,
  test,
} from "../support/fixtures.ts";

/**
 * E2E-005 — Falha de busca (US-003, US-003.EC-2).
 *
 * O número inexistente não está no catálogo de fixtures: o servidor responde o mesmo
 * "documento não localizado" da API real, o gateway traduz para 404 e a tela mostra o
 * erro. A tentativa seguinte precisa funcionar normalmente, sem retry limitado e sem
 * mexer nas notas já em conferência.
 */
test("E2E-005: número inexistente mostra erro e não impede a busca seguinte", async ({
  page,
  scanner,
}) => {
  // Arrange — uma nota já em conferência, com progresso
  await loginAs(page, OPERADOR);
  await page.getByLabel("Número de faturamento").fill(REFERENCE_NOTE_1);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  const existingCard = queueNoteCard(page, REFERENCE_NOTE_1);
  await expect(existingCard).toBeVisible();
  await openNoteFromQueue(page, REFERENCE_NOTE_1);
  await expect(page.getByRole("heading", { name: `Nota ${REFERENCE_NOTE_1}` })).toBeVisible();
  await scanner.scan(PANETONE.cProd, async () => {
    await expect(page.getByLabel(`${PANETONE.description}: caixas confirmadas`)).toHaveText("1/10");
  });
  await page.goto("/notas");

  // Act — busca um número que não existe
  await page.getByLabel("Número de faturamento").fill(UNKNOWN_INVOICE_NUMBER);
  await page.getByRole("button", { name: "Buscar nota" }).click();

  // Assert — erro explícito, e a nota em conferência segue intacta
  await expect(
    page.getByRole("status").filter({ hasText: "Nota não encontrada" }),
  ).toContainText("Confira o número e tente novamente.");
  await expect(existingCard).toBeVisible();
  await expect(existingCard).toContainText("1/10");

  // Act — nova tentativa, agora com um número válido
  await page.getByLabel("Número de faturamento").fill(REAL_INVOICE_NUMBER);
  await page.getByRole("button", { name: "Buscar nota" }).click();

  // Assert — a busca funciona normalmente e as duas notas convivem na fila
  await expect(queueNoteCard(page, REAL_INVOICE_NUMBER)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Nota não encontrada" })).toHaveCount(0);
  await expect(existingCard).toContainText("1/10");
});
