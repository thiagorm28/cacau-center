import { chromium } from "playwright";

const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;
const shotDir = process.env.SHOT_DIR;

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

await page.goto("http://localhost:5174");
await page.waitForSelector("#email", { timeout: 15000 });
await page.screenshot({ path: `${shotDir}/1-login-screen.png` });

await page.fill("#email", email);
await page.fill("#password", password);
await page.click('button[type="submit"]');

await page.waitForURL(/\/trocar-senha|\/usuarios|\/notas|\/historico/, { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${shotDir}/2-post-login.png` });

console.log("URL após login:", page.url());
console.log("Erros de console:", JSON.stringify(consoleErrors));

await browser.close();
