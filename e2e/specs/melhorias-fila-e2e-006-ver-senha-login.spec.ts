import { OPERADOR, expect, test } from "../support/fixtures.ts";

/**
 * E2E-006 — Ver a senha digitada no login antes de entrar (US-006).
 *
 * O arquivo leva o prefixo da feature: a numeração `E2E-00x` deste catálogo reaproveita
 * IDs já usados pela suíte de conferência de notas (`e2e-006-007-gerente.spec.ts`).
 */
test("E2E-006: operador confere a senha em texto plano, oculta de novo e entra", async ({
  page,
}) => {
  // Arrange — preenche o login sem enviar
  await page.goto("/");
  await page.getByLabel("E-mail").fill(OPERADOR.email);
  const senha = page.getByLabel("Senha", { exact: true });
  await senha.fill(OPERADOR.password);
  await expect(senha).toHaveAttribute("type", "password");

  // Act — toca no olho para conferir o que digitou
  await page.getByRole("button", { name: "Mostrar senha" }).click();

  // Assert — a senha aparece em texto plano, com o valor intacto
  await expect(senha).toHaveAttribute("type", "text");
  await expect(senha).toHaveValue(OPERADOR.password);

  // Act — volta a ocultar
  await page.getByRole("button", { name: "Ocultar senha" }).click();
  await expect(senha).toHaveAttribute("type", "password");

  // Act/Assert — o envio funciona normalmente e o operador chega à sua tela inicial
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Notas em conferência" })).toBeVisible();
});
