import { ADMIN, GERENTE, expect, loginAs, test } from "../support/fixtures.ts";

const GERENTE_NAME = "Gil Gerente";
/** CPF `12345678909` e nascimento `1985-07-20` (semeados pelo control-server). */
const INITIAL_PASSWORD = "12345678909@20071985";

/** E2E-003 — Funcionário esquece a senha (US-009, US-010). */
test("E2E-003: admin reseta a senha do gerente, que volta à troca obrigatória", async ({ page }) => {
  // Arrange
  await loginAs(page, ADMIN);
  const row = page.getByRole("listitem").filter({ hasText: GERENTE_NAME });

  // Act — reseta a senha, com a confirmação explícita
  await row.getByRole("button", { name: "Resetar senha" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Resetar senha" }).click();

  // Assert — a senha inicial fica visível para o admin comunicá-la
  await expect(page.getByText(INITIAL_PASSWORD)).toBeVisible();

  // Act — o gerente entra com a senha inicial
  await page.getByRole("button", { name: "Sair" }).click();
  await loginAs(page, { email: GERENTE.email, password: INITIAL_PASSWORD });

  // Assert — cai na troca obrigatória, e a senha antiga não vale mais
  await expect(page.getByRole("heading", { name: "Defina uma nova senha" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Histórico" })).toHaveCount(0);
});
