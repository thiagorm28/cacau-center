import { HISTORY_INVOICE_NUMBER, PANETONE } from "../support/nfeFixtures.ts";
import { ADMIN, BackendClient, OPERADOR, expect, loginAs, logout, test } from "../support/fixtures.ts";

const OPERADOR_NAME = "Ana Operadora";

/** E2E-002 — Funcionário sai da loja (US-007, US-013, ADR-003). */
test("E2E-002: operador desativado perde o login mas continua nomeado no histórico", async ({
  page,
  request,
}) => {
  // Arrange — o operador deixa uma conferência finalizada no histórico
  const operador = await BackendClient.signIn(request, OPERADOR);
  const { noteId } = await operador.createNote(HISTORY_INVOICE_NUMBER);
  await operador.scan(PANETONE.cProd);
  await operador.finalize(noteId);

  // Act — o admin desativa a conta dele
  await loginAs(page, ADMIN);
  const row = page.getByRole("listitem").filter({ hasText: OPERADOR_NAME });
  await row.getByRole("button", { name: "Desativar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Desativar" }).click();

  // Assert — a listagem passa a mostrá-lo como desativado
  await expect(row).toContainText("Desativado");

  // Act — o operador tenta entrar, mesmo com a senha correta
  await logout(page);
  await loginAs(page, OPERADOR);

  // Assert — acesso recusado, sem revelar que a conta existe mas está desativada
  await expect(page.getByText("E-mail ou senha inválidos")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notas em conferência" })).toHaveCount(0);

  // Assert — o histórico preserva o que ele conferiu, com o nome dele (ADR-003)
  await loginAs(page, ADMIN);
  await page.goto("/historico");
  const entry = page.getByRole("button", { name: new RegExp(`Nota ${HISTORY_INVOICE_NUMBER}`) });
  await expect(entry).toContainText(`conferida por ${OPERADOR_NAME}`);
});
