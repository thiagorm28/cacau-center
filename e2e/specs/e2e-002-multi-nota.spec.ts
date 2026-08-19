import {
  PANETONE,
  REFERENCE_NOTE_1,
  REFERENCE_NOTE_2,
  TRUFA,
} from "../support/nfeFixtures.ts";
import { OPERADOR, expect, itemCounter, loginAs, test } from "../support/fixtures.ts";

const searchNote = async (page: import("@playwright/test").Page, invoiceNumber: string) => {
  await page.getByLabel("Número de faturamento").fill(invoiceNumber);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`Nota ${invoiceNumber}`) })).toBeVisible();
};

/**
 * E2E-002 — Conferência multi-nota com alocação automática
 * (US-008, US-009, US-010, US-011, US-012), no cenário de referência da ADR-001.
 *
 * A trufa (item exclusivo da nota 2) é bipada antes dos panetones compartilhados: é
 * essa ordem que o motor de alocação da Task 1 fixou por teste (UT-003) para creditar
 * todo o lote à nota 2. O desfecho verificado aqui é exatamente o que o `_tests.md`
 * pede — nota 2 completa e os 10 panetones da nota 1 como faltantes.
 */
test("E2E-002: bipagens vão para a nota mais próxima de fechar e a nota 1 fecha incompleta", async ({
  page,
  scanner,
}) => {
  // Arrange — duas notas em conferência: a nota 1 abre primeiro (desempate FIFO)
  await loginAs(page, OPERADOR);
  await expect(page.getByRole("heading", { name: "Notas em conferência" })).toBeVisible();
  await searchNote(page, REFERENCE_NOTE_1);
  await searchNote(page, REFERENCE_NOTE_2);

  // Act — bipa o item exclusivo e depois os 10 panetones, tudo na tela da nota 2
  await page.getByRole("button", { name: new RegExp(`Nota ${REFERENCE_NOTE_2}`) }).click();
  await expect(page.getByRole("heading", { name: `Nota ${REFERENCE_NOTE_2}` })).toBeVisible();

  const trufaCounter = itemCounter(page, TRUFA.description);
  const panetoneCounter = itemCounter(page, PANETONE.description);

  await scanner.scan(TRUFA.cProd, async () => {
    await expect(trufaCounter).toHaveText("1/1");
  });
  await scanner.scanMany(PANETONE.cProd, 10, async (scanNumber) => {
    await expect(panetoneCounter).toHaveText(`${scanNumber}/10`);
  });

  // Assert — a nota 2 fechou 100%, sem que o operador jamais a tenha escolhido
  await expect(panetoneCounter).toHaveText("10/10");
  await expect(trufaCounter).toHaveText("1/1");

  // Assert — a nota 1 continua intocada e é a única ainda em conferência
  await page.goto("/notas");
  const note1Card = page.getByRole("button", { name: new RegExp(`Nota ${REFERENCE_NOTE_1}`) });
  await expect(note1Card).toBeVisible();
  await expect(note1Card).toContainText("0/10");
  await expect(
    page.getByRole("button", { name: new RegExp(`Nota ${REFERENCE_NOTE_2}`) }),
  ).toHaveCount(0);

  // Act — finaliza a nota 1 manualmente, assumindo a divergência
  await note1Card.click();
  await page.getByRole("button", { name: "Finalizar conferência" }).click();
  const dialog = page.getByRole("dialog", { name: "Finalizar mesmo assim?" });
  await expect(dialog).toContainText("Ainda há 1 item pendente");
  await dialog.getByRole("button", { name: "Finalizar com divergência" }).click();

  // Assert — o relatório da nota 1 lista os 10 panetones como faltantes
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]+\/relatorio$/);
  await expect(page.getByText("Finalizada com divergência")).toBeVisible();
  await expect(page.getByText(`Faltam 10 de 10 CX`)).toBeVisible();
  await expect(page.getByText(PANETONE.description)).toBeVisible();
});
