import { ADMIN, expect, loginAs, logout, test } from "../support/fixtures.ts";

/** Nome semeado da conta admin pelo control-server. */
const ADMIN_NAME = "Dora Dona";

/**
 * E2E-001 — Caminho crítico da gaveta de navegação (US-001, US-003, US-004, US-005).
 *
 * O arquivo é próprio da feature de navegação: a numeração `E2E-00x` do catálogo desta
 * feature reaproveita IDs já usados pelas suítes de conferência e de gestão de usuários.
 */
test("E2E-001: admin abre a gaveta, navega para o histórico e sai por ela", async ({ page }) => {
  // Arrange — o admin entra e cai na sua tela inicial
  await loginAs(page, ADMIN);
  await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();

  // Act — abre a gaveta pelo gatilho global do cabeçalho
  await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
  const drawer = page.getByRole("dialog");

  // Assert — identidade e as três funcionalidades que o papel alcança
  await expect(drawer.getByText(ADMIN_NAME)).toBeVisible();
  await expect(drawer.getByText("Administrador")).toBeVisible();
  for (const label of ["Fila de notas", "Histórico", "Gestão de usuários"]) {
    await expect(drawer.getByRole("button", { name: label })).toBeVisible();
  }

  // Act — toca em "Histórico"
  await drawer.getByRole("button", { name: "Histórico" }).click();

  // Assert — chega na tela do histórico e a gaveta fecha sozinha
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Act — reabre a gaveta e sai por ela
  await logout(page);

  // Assert — volta ao login, e voltar no navegador não devolve a rota protegida
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await page.goto("/usuarios");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Usuários" })).toHaveCount(0);
});
