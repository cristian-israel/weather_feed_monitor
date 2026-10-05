import { chromium, type BrowserContext } from 'playwright';
import { config } from './config';
import type { FontePosts, Post } from './tipos';

const SELETOR_LINKS = 'a[href*="/p/"], a[href*="/reel/"]';
const LIMITE_POSTS = 12;

const pausa = (min: number, max: number) =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

export const fontePlaywright: FontePosts = {
  async buscarNovos(jaVisto) {
    if (!config.perfil) throw new Error('PERFIL não definido no .env');

    const browser = await chromium.launch({ headless: true });
    try {
      const ctx = await browser.newContext({ storageState: config.sessaoPath });
      const page = await ctx.newPage();

      await page.goto(`https://www.instagram.com/${config.perfil}/`, {
        waitUntil: 'domcontentloaded',
      });

      if (page.url().includes('/accounts/login')) {
        throw new Error('Sessão expirada: rode `pnpm login:instagram` novamente');
      }

      await page.waitForSelector(SELETOR_LINKS, { timeout: 15000 }).catch(() => {});

      const hrefs = await page.$$eval(SELETOR_LINKS, (as) =>
        as.map((a) => a.getAttribute('href') ?? ''),
      );

      const itens = [...new Set(hrefs)]
        .map((href) => ({ href, id: href.match(/\/(?:p|reel)\/([^/?]+)/)?.[1] }))
        .filter((x): x is { href: string; id: string } => !!x.id)
        .slice(0, LIMITE_POSTS);

      if (itens.length === 0) {
        throw new Error('Nenhum post encontrado (sessão expirada, bloqueio ou layout mudou)');
      }

      const novos: Post[] = [];
      for (const { href, id } of itens) {
        if (await jaVisto(id)) continue;
        novos.push(await lerPost(ctx, href, id));
        await pausa(2000, 5000);
      }
      return novos;
    } finally {
      await browser.close();
    }
  },
};

async function lerPost(ctx: BrowserContext, href: string, id: string): Promise<Post> {
  const page = await ctx.newPage();
  try {
    const url = href.startsWith('http') ? href : `https://www.instagram.com${href}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const meta = (prop: string) =>
      page
        .locator(`meta[property="${prop}"]`)
        .first()
        .getAttribute('content', { timeout: 3000 })
        .catch(() => null);

    const legenda = (await meta('og:description')) ?? '';
    const img = await meta('og:image');
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 });

    return { id, legenda, imagemUrls: img ? [img] : [], screenshot };
  } finally {
    await page.close();
  }
}
