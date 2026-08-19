import {
  BOMBOM,
  MANUAL_SELECTION_INVOICE_NUMBER,
  PANETONE,
  UNMATCHED_CODES,
} from "../support/nfeFixtures.ts";
import { OPERADOR, expect, itemCounter, loginAs, test } from "../support/fixtures.ts";

/**
 * E2E-003 — Bipagem sem correspondência (US-006, US-007).
 *
 * Os dois códigos bipados não existem em nenhuma nota do catálogo de fixtures: o
 * primeiro é resolvido pela seleção manual do item, o segundo é assumido como caixa
 * não identificada.
 */
test("E2E-003: código sem correspondência vai para seleção manual e para caixa não identificada", async ({
  page,
  scanner,
}) => {
  // Arrange — nota com dois itens distintos, um a um
  await loginAs(page, OPERADOR);
  await page.getByLabel("Número de faturamento").fill(MANUAL_SELECTION_INVOICE_NUMBER);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  await page
    .getByRole("button", { name: new RegExp(`Nota ${MANUAL_SELECTION_INVOICE_NUMBER}`) })
    .click();
  await expect(
    page.getByRole("heading", { name: `Nota ${MANUAL_SELECTION_INVOICE_NUMBER}` }),
  ).toBeVisible();

  // Act — primeira leitura sem correspondência: o operador escolhe o item na mão
  const manualDialog = page.getByRole("dialog", { name: "Código não reconhecido" });
  await scanner.scan(UNMATCHED_CODES[0], async () => {
    await expect(manualDialog).toBeVisible();
  });
  await expect(manualDialog).toContainText(UNMATCHED_CODES[0]);
  await manualDialog.getByRole("button", { name: new RegExp(PANETONE.description) }).click();

  // Assert — a caixa foi contabilizada no item escolhido
  await expect(itemCounter(page, PANETONE.description)).toHaveText("1/1");
  await expect(page.getByRole("status").filter({ hasText: "Confirmado" })).toContainText(
    PANETONE.description,
  );

  // Act — segunda leitura sem correspondência: registrada como não identificada
  await scanner.scan(UNMATCHED_CODES[1], async () => {
    await expect(manualDialog).toBeVisible();
  });
  await manualDialog
    .getByRole("button", { name: "Registrar como caixa não identificada" })
    .click();
  await expect(manualDialog).toHaveCount(0);
  await expect(itemCounter(page, BOMBOM.description)).toHaveText("0/1");

  // Act — fecha a nota com o item restante em falta
  await page.getByRole("button", { name: "Finalizar conferência" }).click();
  await page
    .getByRole("dialog", { name: "Finalizar mesmo assim?" })
    .getByRole("button", { name: "Finalizar com divergência" })
    .click();

  // Assert — o relatório separa o item faltante da caixa não identificada
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]+\/relatorio$/);
  const unidentified = page.locator("section", { hasText: "Caixas não identificadas" });
  await expect(unidentified).toContainText(UNMATCHED_CODES[1]);
  await expect(unidentified).not.toContainText(UNMATCHED_CODES[0]);
  await expect(page.getByText("Faltam 1 de 1 CX")).toBeVisible();
  await expect(page.getByText(BOMBOM.description)).toBeVisible();
});
