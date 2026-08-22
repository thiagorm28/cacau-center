import { REFERENCE_NOTE_1, REFERENCE_NOTE_2 } from "../support/nfeFixtures.ts";
import { OPERADOR, expect, loginAs, queueNoteCard, test } from "../support/fixtures.ts";

/**
 * E2E-003 — Offline, a exclusão fica indisponível (US-003).
 *
 * A exclusão nunca é enfileirada para sincronizar depois (ADR-001): sem conexão, o
 * botão de cada card simplesmente desabilita.
 */
test("E2E-003: offline, o botão de excluir de cada card fica desabilitado", async ({
  page,
  context,
}) => {
  // Arrange — duas notas na fila, ainda com conexão
  await loginAs(page, OPERADOR);
  for (const invoiceNumber of [REFERENCE_NOTE_1, REFERENCE_NOTE_2]) {
    await page.getByLabel("Número de faturamento").fill(invoiceNumber);
    await page.getByRole("button", { name: "Buscar nota" }).click();
    await expect(queueNoteCard(page, invoiceNumber)).toBeVisible();
  }

  const deleteButtons = page.getByRole("button", { name: "Excluir", exact: true });
  await expect(deleteButtons).toHaveCount(2);
  for (const button of await deleteButtons.all()) await expect(button).toBeEnabled();

  // Act — cai a conexão
  await context.setOffline(true);

  // Assert — nenhum card permite excluir enquanto estiver offline
  for (const button of await deleteButtons.all()) await expect(button).toBeDisabled();

  // Assert — ao reconectar, a ação volta a ficar disponível
  await context.setOffline(false);
  for (const button of await deleteButtons.all()) await expect(button).toBeEnabled();
});
