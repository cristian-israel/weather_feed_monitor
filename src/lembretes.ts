import { config } from './config';
import { ultimoAlertaDireto } from './db';
import { montarLembrete } from './lembrete-calculo';
import type { Lembrete, LocalMonitorado } from './tipos';

/**
 * Para cada município monitorado, calcula há quanto tempo foi o último alerta direto.
 * Municípios sem registro, ou além do limite de dias, não geram lembrete.
 */
export async function gerarLembretes(
  locais: LocalMonitorado[],
  agora: Date = new Date(),
): Promise<Lembrete[]> {
  const lembretes: Lembrete[] = [];
  for (const local of locais) {
    const ultimo = await ultimoAlertaDireto(local.municipio, local.uf);
    if (!ultimo) continue;
    const l = montarLembrete(local, ultimo, agora, config.maxDiasLembrete);
    if (l) lembretes.push(l);
  }
  return lembretes;
}
