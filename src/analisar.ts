import { GoogleGenAI, Type } from "@google/genai";
import type { Part } from "@google/genai";
import { z } from "zod";
import { config } from "./config";
import type { AnaliseIA, Post } from "./tipos";

const schema = z.object({
  eh_alerta: z.boolean().default(false),
  tipo_alerta: z.string().nullable().default(null),
  severidade: z.enum(["baixa", "media", "alta"]).nullable().default(null),
  mencoes: z
    .array(
      z.object({
        nome: z.string(),
        tipo: z.enum(["municipio", "regiao", "estado", "outro"]).catch("outro"),
        uf: z.string().nullable().default(null),
      }),
    )
    .default([]),
});

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function normalizarTipo(t: string | null): MediaType {
  const tipo = (t ?? "").split(";")[0].trim().toLowerCase();
  if (tipo === "image/png" || tipo === "image/gif" || tipo === "image/webp")
    return tipo;
  return "image/jpeg";
}

async function imagemParaBloco(url: string): Promise<Part> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status})`);
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return {
    inlineData: {
      mimeType: normalizarTipo(res.headers.get("content-type")),
      data,
    },
  };
}

function extrairJson(texto: string): unknown {
  const limpo = texto.replace(/```(?:json)?/gi, "").trim();
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (ini === -1 || fim === -1) throw new Error("Resposta do modelo sem JSON");
  return JSON.parse(limpo.slice(ini, fim + 1));
}

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey() });
  }
  return aiClient;
}

/**
 * A IA só EXTRAI os lugares citados. Quem decide se afeta seus municípios
 * (direto, região, estado ou vizinho) é o código, em localizacao.ts.
 */
export async function analisar(
  post: Post,
  ufsInteresse: string[],
): Promise<AnaliseIA> {
  const partes: (Part | string)[] = [];

  if (post.screenshot) {
    partes.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: post.screenshot.toString("base64"),
      },
    });
  }

  for (const url of post.imagemUrls.slice(0, config.maxImagens)) {
    try {
      partes.push(await imagemParaBloco(url));
    } catch (e) {
      console.warn(`Imagem ignorada (${post.id}):`, (e as Error).message);
    }
  }

  const promptTexto = `Estados de interesse: ${ufsInteresse.join(", ")}.

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
"""${post.legenda}"""`;

  partes.push(promptTexto);

  const ai = getAi();
  const response = await ai.models.generateContent({
    model: config.modelo,
    contents: partes,
    config: {
      systemInstruction:
        "Você extrai informações de avisos meteorológicos publicados em redes sociais. Responda APENAS com JSON válido, sem texto extra.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          eh_alerta: { type: Type.BOOLEAN },
          tipo_alerta: { type: Type.STRING, nullable: true },
          severidade: {
            type: Type.STRING,
            enum: ["baixa", "media", "alta"],
            nullable: true,
          },
          mencoes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nome: { type: Type.STRING },
                tipo: {
                  type: Type.STRING,
                  enum: ["municipio", "regiao", "estado", "outro"],
                },
                uf: { type: Type.STRING, nullable: true },
              },
              required: ["nome", "tipo"],
            },
          },
        },
        required: ["eh_alerta", "mencoes"],
      },
      maxOutputTokens: 1000,
    },
  });

  const texto = response.text ?? "";
  return schema.parse(extrairJson(texto));
}
