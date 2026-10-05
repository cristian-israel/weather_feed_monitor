import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import type { Alerta, Post } from './tipos';
import type { UltimoAlerta } from './lembrete-calculo';

let cliente: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!cliente) cliente = createClient(config.supabaseUrl(), config.supabaseKey());
  return cliente;
}

export async function jaProcessado(id: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from('posts_processados')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Supabase (consulta): ${error.message}`);
  return !!data;
}

export async function marcarProcessado(post: Post, alerta: Alerta): Promise<void> {
  const { error } = await supabase()
    .from('posts_processados')
    .upsert({
      id: post.id,
      legenda: post.legenda,
      locais_afetados: alerta.ocorrencias.map((o) => `${o.municipio}/${o.uf}:${o.relacao}`),
      tipo_alerta: alerta.tipo_alerta,
      severidade: alerta.severidade,
    });
  if (error) throw new Error(`Supabase (gravação): ${error.message}`);
}

/** Registra uma linha por município afetado (direto ou via vizinho). */
export async function registrarAlertas(post: Post, alerta: Alerta): Promise<void> {
  if (alerta.ocorrencias.length === 0) return;
  const linhas = alerta.ocorrencias.map((o) => ({
    post_id: post.id,
    municipio: o.municipio,
    uf: o.uf,
    relacao: o.relacao,
    via: o.via,
    incerto: o.incerto,
    tipo_alerta: alerta.tipo_alerta,
    severidade: alerta.severidade,
  }));
  const { error } = await supabase()
    .from('alertas_municipio')
    .upsert(linhas, { onConflict: 'post_id,municipio,uf' });
  if (error) throw new Error(`Supabase (alertas): ${error.message}`);
}

/**
 * Último alerta que atingiu o município diretamente.
 * Alertas só por vizinho ou com nome ambíguo não contam.
 */
export async function ultimoAlertaDireto(
  municipio: string,
  uf: string,
): Promise<UltimoAlerta | null> {
  const { data, error } = await supabase()
    .from('alertas_municipio')
    .select('criado_em, tipo_alerta, severidade')
    .eq('municipio', municipio)
    .eq('uf', uf)
    .eq('relacao', 'direto')
    .eq('incerto', false)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase (último alerta): ${error.message}`);
  return data as UltimoAlerta | null;
}
