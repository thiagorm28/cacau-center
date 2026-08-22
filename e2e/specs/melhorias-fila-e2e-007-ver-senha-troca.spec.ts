import { ADMIN, GERENTE, expect, loginAs, logout, test } from "../support/fixtures.ts";

const GERENTE_NAME = "Gil Gerente";
/** CPF `12345678909` e nascimento `1985-07-20` (semeados pelo control-server). */
const INITIAL_PASSWORD = "12345678909@20071985";
const NEW_PASSWORD = "chocolate1";

/**
 * E2E-007 — Ver a nova senha e a confirmação antes de salvar (US-007).
 *
 * A troca obrigatória é alcançada pelo caminho real: o admin reseta a senha, e o
 * funcionário entra com a senha inicial. O prefixo do arquivo é da feature porque a
 * numeração `E2E-00x` deste catálogo colide com a da suíte de conferência de notas.
 */
test("E2E-007: na troca obrigatória, os dois campos alternam a visibilidade de forma independente", async ({
  page,
}) => {
  // Arrange — o admin reseta a senha do gerente, que passa a exigir troca no login
  await loginAs(page, ADMIN);
  const row = page.getByRole("listitem").filter({ hasText: GERENTE_NAME });
  await row.getByRole("button", { name: "Resetar senha" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Resetar senha" }).click();
  await logout(page);

  await loginAs(page, { email: GERENTE.email, password: INITIAL_PASSWORD });
  await expect(page.getByRole("heading", { name: "Defina uma nova senha" })).toBeVisible();

  // Act — digita a nova senha e a confirmação
  const nova = page.getByLabel("Nova senha", { exact: true });
  const confirmacao = page.getByLabel("Confirme a nova senha");
  await nova.fill(NEW_PASSWORD);
  await confirmacao.fill(NEW_PASSWORD);

  // Act — mostra só a "Nova senha"
  const toggles = page.getByRole("button", { name: /(Mostrar|Ocultar) senha/ });
  await toggles.nth(0).click();

  // Assert — só o primeiro campo mudou de estado
  await expect(nova).toHaveAttribute("type", "text");
  await expect(confirmacao).toHaveAttribute("type", "password");

  // Act — mostra também a confirmação, para comparar os dois valores
  await toggles.nth(1).click();

  await expect(nova).toHaveValue(NEW_PASSWORD);
  await expect(confirmacao).toHaveAttribute("type", "text");
  await expect(confirmacao).toHaveValue(NEW_PASSWORD);

  // Act — volta a ocultar só a "Nova senha": os estados podem divergir (US-007.EC-1)
  await toggles.nth(0).click();
  await expect(nova).toHaveAttribute("type", "password");
  await expect(confirmacao).toHaveAttribute("type", "text");

  // Assert — salva e chega à tela do gerente, sem cair de novo na troca obrigatória
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
});
