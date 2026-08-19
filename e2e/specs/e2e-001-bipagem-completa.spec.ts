import { PANETONE, REAL_INVOICE_NUMBER, REAL_NOTE_QUANTITY } from "../support/nfeFixtures.ts";
import { OPERADOR, expect, itemCounter, loginAs, test } from "../support/fixtures.ts";

/**
 * E2E-001 — Busca e bipagem completa de uma nota
 * (US-001, US-003, US-004, US-005, US-010, US-012).
 */
test("E2E-001: operador busca a nota, bipa todas as caixas e vê o relatório sem pendências", async ({
  page,
  scanner,
}) => {
  // Arrange
  await loginAs(page, OPERADOR);
  await expect(page.getByRole("heading", { name: "Notas em conferência" })).toBeVisible();

  // Act — busca a nota pelo número de faturamento
  await page.getByLabel("Número de faturamento").fill(REAL_INVOICE_NUMBER);
  await page.getByRole("button", { name: "Buscar nota" }).click();

  // Assert — a nota entra na fila de conferência
  const queueCard = page.getByRole("button", { name: new RegExp(`Nota ${REAL_INVOICE_NUMBER}`) });
  await expect(queueCard).toBeVisible();

  // Act — abre a bipagem e bipa todas as caixas esperadas
  await queueCard.click();
  await expect(page.getByRole("heading", { name: `Nota ${REAL_INVOICE_NUMBER}` })).toBeVisible();
  const counter = itemCounter(page, PANETONE.description);
  await expect(counter).toHaveText(`0/${REAL_NOTE_QUANTITY}`);

  await scanner.scanMany(PANETONE.cProd, REAL_NOTE_QUANTITY, async (scanNumber) => {
    await expect(counter).toHaveText(`${scanNumber}/${REAL_NOTE_QUANTITY}`);
  });

  // Assert — nota completa, com confirmação da última leitura
  await expect(page.getByRole("status").filter({ hasText: "Confirmado" })).toContainText(
    PANETONE.description,
  );
  await expect(page.getByText("Item completo")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Nota completa!" })).toContainText(
    `${REAL_NOTE_QUANTITY} de ${REAL_NOTE_QUANTITY} caixas conferidas`,
  );

  // Act — fecha a conferência
  await page.getByRole("button", { name: "Ver relatório da nota" }).click();

  // Assert — relatório final sem nenhuma divergência
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]+\/relatorio$/);
  await expect(page.getByText("Conferência completa")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Tudo certo: todos os itens foram conferidos.");
  await expect(page.getByText("Nenhum item faltante.")).toBeVisible();
  await expect(page.getByText("Nenhuma caixa excedente.")).toBeVisible();
  await expect(page.getByText("Nenhuma caixa não identificada.")).toBeVisible();
});
