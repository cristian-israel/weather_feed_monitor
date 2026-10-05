import { chromium } from 'playwright';
import { config } from './config';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('https://www.instagram.com/accounts/login/');

  console.log('Faça login manualmente (inclusive 2FA) com uma conta SECUNDÁRIA.');
  console.log('Quando terminar, volte aqui e pressione Enter.');
  await new Promise<void>((resolve) => process.stdin.once('data', () => resolve()));

  await ctx.storageState({ path: config.sessaoPath });
  console.log(`Sessão salva em ${config.sessaoPath}`);
  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
