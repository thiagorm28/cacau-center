import { ADMIN, expect, loginAs, test } from "../support/fixtures.ts";

/**
 * E2E-001 — Cadastro e primeiro acesso (US-003, US-010, US-011).
 *
 * A numeração `E2E-00x` desta feature reaproveita IDs já usados pela suíte de
 * conferência de notas, por isso o prefixo no nome do arquivo.
 */
const NOVO = {
  name: "Nina Nova",
  birthDate: "1995-05-20",
  cpf: "11144477735",
  email: "nina@loja.com",
  // Senha inicial derivada do CPF e do nascimento (ADR-002).
  initialPassword: "11144477735@20051995",
  newPassword: "chocolate1",
} as const;

test("E2E-001: admin cadastra um operador que troca a senha no primeiro acesso", async ({
  page,
}) => {
  // Arrange — o admin entra e cai na gestão de usuários, sua tela inicial
  await loginAs(page, ADMIN);
  await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();

  // Act — cadastra o novo operador
  await page.getByRole("button", { name: "Cadastrar usuário" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome").fill(NOVO.name);
  await form.getByLabel("Data de nascimento").fill(NOVO.birthDate);
  await form.getByLabel("CPF").fill(NOVO.cpf);
  await form.getByLabel("E-mail").fill(NOVO.email);
  await form.getByText("Operador", { exact: true }).click();
  await form.getByRole("button", { name: "Cadastrar" }).click();

  // Assert — a conta aparece ativa na lista, com a senha inicial para comunicar
  const row = page.getByRole("listitem").filter({ hasText: NOVO.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Ativo");
  await expect(page.getByText(NOVO.initialPassword)).toBeVisible();

  // Act — o admin sai e o novo operador entra com a senha inicial
  await page.getByRole("button", { name: "Sair" }).click();
  await loginAs(page, { email: NOVO.email, password: NOVO.initialPassword });

  // Assert — o primeiro acesso cai direto na troca obrigatória (US-010/US-011)
  await expect(page.getByRole("heading", { name: "Defina uma nova senha" })).toBeVisible();

  // Act — define a nova senha
  await page.getByLabel("Nova senha", { exact: true }).fill(NOVO.newPassword);
  await page.getByLabel("Confirme a nova senha").fill(NOVO.newPassword);
  await page.getByRole("button", { name: "Salvar nova senha" }).click();

  // Assert — a trava cai e ele passa a usar a tela do seu papel
  await expect(page.getByRole("heading", { name: "Notas em conferência" })).toBeVisible();
});
