import 'dotenv/config';

function obrigatoria(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return v;
}

export const config = {
  perfil: process.env.PERFIL ?? '',
  fonte: (process.env.FONTE ?? 'playwright') as 'playwright' | 'mock',
  modelo: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  geminiApiKey: () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || obrigatoria('GEMINI_API_KEY'),
  sessaoPath: process.env.SESSAO_PATH ?? 'sessao.json',
  maxImagens: Number(process.env.MAX_IMAGENS ?? 4),

  locaisPath: process.env.LOCAIS_PATH ?? 'locais.json',
  catalogoPath: process.env.CATALOGO_PATH ?? 'data/catalogo.json',
  apelidosPath: process.env.APELIDOS_PATH ?? 'data/apelidos.json',

  cron: process.env.CRON ?? '*/20 * * * *',
  cronLembrete: process.env.CRON_LEMBRETE ?? '0 9 * * *',
  maxDiasLembrete: Number(process.env.MAX_DIAS_LEMBRETE ?? 7),
  timezone: process.env.TZ_AGENDA ?? 'America/Sao_Paulo',
  rodarAoIniciar: (process.env.RODAR_AO_INICIAR ?? 'true') === 'true',

  supabaseUrl: () => obrigatoria('SUPABASE_URL'),
  supabaseKey: () => obrigatoria('SUPABASE_SERVICE_KEY'),
};
