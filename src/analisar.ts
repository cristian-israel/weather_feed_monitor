import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from './config';
import type { AnaliseIA, Post } from './tipos';

const client = new Anthropic();

const schema = z.object({
  eh_alerta: z.boolean().default(false),
  tipo_alerta: z.string().nullable().default(null),
  severidade: z.enum(['baixa', 'media', 'alta']).nullable().default(null),
  mencoes: z
    .array(
      z.object({
        nome: z.string(),
        tipo: z.enum(['municipio', 'regiao', 'estado', 'outro']).catch('outro'),
        uf: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

function normalizarTipo(t: string | null): MediaType {
  const tipo = (t ?? '').split(';')[0].trim().toLowerCase();
  if (tipo === 'image/png' || tipo === 'image/gif' || tipo === 'image/webp') return tipo;
  return 'image/jpeg';
}

async function imagemParaBloco(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status})`);
  const data = Buffer.from(await res.arrayBuffer()).toString('base64');
  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: normalizarTipo(res.headers.get('content-type')),
      data,
    },
  };
}

function extrairJson(texto: string): unknown {
  const limpo = texto.replace(/```(?:json)?/gi, '').trim();
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini === -1 || fim === -1) throw new Error('Resposta do modelo sem JSON');
  return JSON.parse(limpo.slice(ini, fim + 1));
}

/**
 * A IA só EXTRAI os lugares citados. Quem decide se afeta seus municípios
 * (direto, região, estado ou vizinho) é o código, em localizacao.ts.
 */
export async function analisar(post: Post, ufsInteresse: string[]): Promise<AnaliseIA> {
  const blocosImagem = [];

  if (post.screenshot) {
    blocosImagem.push({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: post.screenshot.toString('base64'),
      },
    });
  }

  for (const url of post.imagemUrls.slice(0, config.maxImagens)) {
    try {
      blocosImagem.push(await imagemParaBloco(url));
    } catch (e) {
      console.warn(`Imagem ignorada (${post.id}):`, (e as Error).message);
    }
  }

  const msg = await client.messages.create({
    model: config.modelo,
    max_tokens: 600,
    system:
      'Você extrai informações de avisos meteorológicos publicados em redes sociais. Responda APENAS com JSON válido, sem texto extra.',
    messages: [
      {
        role: 'user',
        content: [
          ...blocosImagem,
          {
            type: 'text',
            text: `Estados de interesse: ${ufsInteresse.join(', ')}.

Se o post for um aviso meteorológico, liste os lugares onde o fenômeno está previsto ou acontecendo.
Regras:
- Escreva cada nome exatamente como aparece no post (legenda, textos e mapas nas imagens), um por item.
- tipo: "municipio"; "regiao" (ex.: Vale do Paranhana, Grande Porto Alegre, litoral norte); "estado"; ou "outro".
- uf: sigla de duas letras quando o post ou o contexto deixar claro; caso contrário null. Não adivinhe.
- Não acrescente cidades vizinhas por dedução; liste só o que o post cita ou mostra.
- Ignore nomes citados apenas como fonte ou autoria (ex.: órgãos, páginas, institutos).
- Se não for um aviso meteorológico, retorne eh_alerta false e mencoes [].
Retorne: {"eh_alerta": boolean, "tipo_alerta": string|null, "severidade": "baixa"|"media"|"alta"|null, "mencoes": [{"nome": string, "tipo": "municipio"|"regiao"|"estado"|"outro", "uf": string|null}]}

Legenda:
"""${post.legenda}"""`,
          },
        ],
      },
    ],
  });

  const bloco = msg.content.find((b) => b.type === 'text');
  const texto = bloco && bloco.type === 'text' ? bloco.text : '';
  return schema.parse(extrairJson(texto));
}
