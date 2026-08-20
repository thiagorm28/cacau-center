import { ADMIN, GERENTE, OPERADOR, expect, loginAs, test } from "../support/fixtures.ts";

const NON_ADMINS = [
  { label: "operador", credentials: OPERADOR, home: "Notas em conferência" },
  { label: "gerente", credentials: GERENTE, home: "Histórico" },
] as const;

/** E2E-005 — Gestão de usuários é exclusiva do admin (US-012). */
for (const account of NON_ADMINS) {
  test(`E2E-005: ${account.label} não acessa a gestão de usuários nem vê link para ela`, async ({
    page,
  }) => {
    // Arrange
    await loginAs(page, account.credentials);
    await expect(page.getByRole("heading", { name: account.home })).toBeVisible();

    // Assert — nenhum caminho para a tela aparece na navegação (US-012.AC-2)
    await expect(page.getByRole("link", { name: /usuário/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /usuário/i })).toHaveCount(0);

    // Act — tenta chegar lá pela URL direta (US-012.AC-1)
    await page.goto("/usuarios");

    // Assert — acesso negado, sem nenhum dado de outros usuários na tela
    await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
    await expect(page.getByText(ADMIN.email)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cadastrar usuário" })).toHaveCount(0);
  });
}

/** E2E-006 — A conta admin não se autodesativa (US-013). */
test("E2E-006: a linha do próprio admin não oferece a ação de desativar", async ({ page }) => {
  // Arrange
  await loginAs(page, ADMIN);
  await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();

  // Assert — a própria linha não tem a ação; as demais têm
  const own = page.getByRole("listitem").filter({ hasText: "Dora Dona" });
  await expect(own).toBeVisible();
  await expect(own.getByRole("button", { name: "Desativar" })).toHaveCount(0);
  const outro = page.getByRole("listitem").filter({ hasText: "Ana Operadora" });
  await expect(outro.getByRole("button", { name: "Desativar" })).toBeVisible();
});

/** E2E-007 — Acesso irrestrito do admin (US-001, US-005, ADR-006). */
test("E2E-007: admin navega por bipagem, histórico e gestão de usuários na mesma sessão", async ({
  page,
}) => {
  // Arrange — a tela inicial do admin é a gestão de usuários
  await loginAs(page, ADMIN);
  await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();

  // Act/Assert — a bipagem, exclusiva do operador, abre sem bloqueio
  await page.goto("/notas");
  await expect(page.getByRole("heading", { name: "Notas em conferência" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acesso restrito" })).toHaveCount(0);

  // Act/Assert — o histórico, exclusivo do gerente, também
  await page.goto("/historico");
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acesso restrito" })).toHaveCount(0);

  // Act/Assert — e a volta à gestão de usuários continua liberada
  await page.goto("/usuarios");
  await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();
});
