import { analisar } from './analisar';
import type { Contexto } from './catalogo';
import { jaProcessado, marcarProcessado, registrarAlertas } from './db';
import { gerarLembretes } from './lembretes';
import type { Alerta, FontePosts, Notificador } from './tipos';

/** Uma rodada: captura, extração pela IA, cruzamento com seus municípios e registro. */
export async function executar(
  fonte: FontePosts,
  notif: Notificador,
  ctx: Contexto,
): Promise<void> {
  let posts;
  try {
    posts = await fonte.buscarNovos(jaProcessado);
  } catch (e) {
    await notif.avisarFalha((e as Error).message);
    return;
  }

  console.log(`[${new Date().toISOString()}] ${posts.length} post(s) novo(s)`);

  for (const post of posts) {
    try {
      const analise = await analisar(post, ctx.ufs);

      const { ocorrencias, naoResolvidos } = analise.eh_alerta
        ? ctx.localizador.avaliar(analise.mencoes, ctx.locais)
        : { ocorrencias: [], naoResolvidos: [] };

      if (naoResolvidos.length > 0) {
        console.warn(`Post ${post.id}: menções não resolvidas: ${naoResolvidos.join(', ')}`);
      }

      const alerta: Alerta = {
        tipo_alerta: analise.tipo_alerta,
        severidade: analise.severidade,
        ocorrencias,
        naoResolvidos,
      };

      if (ocorrencias.length > 0) {
        await notif.enviar(post, alerta);
        await registrarAlertas(post, alerta);
      }
      // Só marca como processado depois de analisar e notificar com sucesso.
      await marcarProcessado(post, alerta);
    } catch (e) {
      console.error(`Erro no post ${post.id}:`, (e as Error).message);
    }
  }
}

/** Rodada do lembrete diário: tempo desde o último alerta de cada município. */
export async function executarLembretes(notif: Notificador, ctx: Contexto): Promise<void> {
  try {
    const lembretes = await gerarLembretes(ctx.locais);
    console.log(`[${new Date().toISOString()}] ${lembretes.length} lembrete(s)`);
    if (lembretes.length > 0) await notif.lembrar(lembretes);
  } catch (e) {
    await notif.avisarFalha(`Lembretes: ${(e as Error).message}`);
  }
}
