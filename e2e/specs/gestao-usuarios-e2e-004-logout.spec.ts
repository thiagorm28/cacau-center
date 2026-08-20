import { GERENTE, OPERADOR, expect, loginAs, test } from "../support/fixtures.ts";

/**
 * E2E-004 — Logout alcançável de qualquer tela (US-002), agora pela gaveta (ADR-002).
 *
 * O arquivo é próprio da feature de gestão de usuários: a numeração `E2E-00x` do
 * catálogo desta feature reaproveita IDs já usados pela suíte de conferência de notas.
 */
const ACCOUNTS = [
  { label: "operador", credentials: OPERADOR, home: "Notas em conferência", protectedPath: "/notas" },
  { label: "gerente", credentials: GERENTE, home: "Histórico", protectedPath: "/historico" },
] as const;

for (const account of ACCOUNTS) {
  test(`E2E-004: ${account.label} sai pela gaveta e perde o acesso às rotas protegidas`, async ({
    page,
  }) => {
    // Arrange — entra e chega à sua tela inicial
    await loginAs(page, account.credentials);
    await expect(page.getByRole("heading", { name: account.home })).toBeVisible();

    // Act — o sair vive na gaveta de navegação, alcançável de qualquer tela (ADR-002)
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
    const sair = page.getByRole("dialog").getByRole("button", { name: "Sair" });
    await expect(sair).toBeVisible();
    await sair.click();

    // Assert — volta ao login, sem o aviso de sessão expirada (a saída foi voluntária)
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByText(/Sua sessão expirou/)).toHaveCount(0);

    // Assert — a sessão anterior não serve mais: a rota protegida devolve ao login
    await page.goto(account.protectedPath);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: account.home })).toHaveCount(0);
  });
}
