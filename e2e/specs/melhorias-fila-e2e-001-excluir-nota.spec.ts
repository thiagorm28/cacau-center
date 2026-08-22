import { REFERENCE_NOTE_1 } from "../support/nfeFixtures.ts";
import { OPERADOR, expect, loginAs, queueNoteCard, test } from "../support/fixtures.ts";

/**
 * E2E-001 — Exclusão de uma nota sem bipagens (US-001, US-002).
 *
 * Sem progresso, o aviso do diálogo declara só a permanência da exclusão — nenhuma
 * contagem de caixas perdidas (ADR-001).
 */
test("E2E-001: operador exclui da fila uma nota sem bipagens", async ({ page }) => {
  // Arrange — uma nota recém-aberta, ainda zerada
  await loginAs(page, OPERADOR);
  await page.getByLabel("Número de faturamento").fill(REFERENCE_NOTE_1);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  const card = queueNoteCard(page, REFERENCE_NOTE_1);
  await expect(card).toBeVisible();
  await expect(card).toContainText("0/10");

  // Act — pede a exclusão pelo botão do card
  await card.getByRole("button", { name: "Excluir" }).click();

  // Assert — o diálogo avisa a permanência, sem falar em progresso perdido
  const dialog = page.getByRole("dialog", { name: `Excluir a nota ${REFERENCE_NOTE_1}?` });
  await expect(dialog).toContainText("permanente e não pode ser desfeita");
  await expect(dialog).not.toContainText("caixas conferidas");

  // Act — confirma
  await dialog.getByRole("button", { name: "Excluir nota" }).click();

  // Assert — a nota sai da fila e a fila fica vazia
  await expect(dialog).toHaveCount(0);
  await expect(card).toHaveCount(0);
  await expect(page.getByText("Nenhuma nota em conferência no momento.")).toBeVisible();
});
