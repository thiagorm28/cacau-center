import { OFFLINE_INVOICE_NUMBER, PANETONE } from "../support/nfeFixtures.ts";
import {
  OPERADOR,
  expect,
  itemCounter,
  loginAs,
  openNoteFromQueue,
  test,
} from "../support/fixtures.ts";

/**
 * E2E-004 — Operação offline (US-013, US-014) e US-017.EC-1.
 *
 * A queda de conexão é simulada pelo próprio navegador (`context.setOffline`), então
 * as bipagens offline percorrem o mesmo caminho de produção: falham na rede, caem na
 * fila do IndexedDB e são drenadas por `POST /scan-events/sync` ao reconectar.
 */
test("E2E-004: bipagens feitas offline são sincronizadas sozinhas ao reconectar", async ({
  page,
  context,
  scanner,
}) => {
  // Arrange — nota carregada com a conexão ainda de pé
  await loginAs(page, OPERADOR);
  await page.getByLabel("Número de faturamento").fill(OFFLINE_INVOICE_NUMBER);
  await page.getByRole("button", { name: "Buscar nota" }).click();
  await openNoteFromQueue(page, OFFLINE_INVOICE_NUMBER);
  await expect(page.getByRole("heading", { name: `Nota ${OFFLINE_INVOICE_NUMBER}` })).toBeVisible();

  const counter = itemCounter(page, PANETONE.description);
  await scanner.scan(PANETONE.cProd, async () => {
    await expect(counter).toHaveText("1/3");
  });

  // Act — cai a conexão
  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: "Offline: bipagens seguem sendo salvas no aparelho." }),
  ).toBeVisible();

  // Act — a bipagem continua funcionando, com feedback local imediato
  await scanner.scan(PANETONE.cProd, async () => {
    await expect(counter).toHaveText("2/3");
  });
  await scanner.scan(PANETONE.cProd, async () => {
    await expect(counter).toHaveText("3/3");
  });
  await expect(page.getByText("Item completo")).toBeVisible();
  // A conclusão da nota é anunciada mesmo offline: `resolveScan` roda no aparelho.
  await expect(page.getByRole("status").filter({ hasText: "Nota completa!" })).toBeVisible();

  // Act — volta a conexão; a sincronização parte sozinha, sem ação do operador
  const synchronized = page.waitForResponse(
    (response) => response.url().endsWith("/scan-events/sync") && response.status() === 200,
  );
  await context.setOffline(false);
  const syncResponse = await synchronized;

  // Assert — as duas bipagens da fila foram enviadas no mesmo lote
  const synced = (await syncResponse.request().postDataJSON()) as { events: unknown[] };
  expect(synced.events).toHaveLength(2);
  await expect(
    page.getByRole("status").filter({ hasText: "Offline: bipagens seguem sendo salvas" }),
  ).toHaveCount(0);

  // Assert — o relatório do servidor reflete o progresso feito offline
  await page.getByRole("button", { name: "Ver relatório da nota" }).click();
  await expect(page).toHaveURL(/\/notas\/[0-9a-f-]+\/relatorio$/);
  await expect(page.getByText("Conferência completa")).toBeVisible();
  await expect(page.getByText("Nenhum item faltante.")).toBeVisible();
});
