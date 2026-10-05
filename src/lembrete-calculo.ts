import type { Lembrete, LocalMonitorado, Severidade } from './tipos';

export type UltimoAlerta = {
  criado_em: string | Date;
  tipo_alerta: string | null;
  severidade: string | null;
};

/**
 * Monta o lembrete de um município, ou null quando já passou do limite de dias
 * (depois disso o município deixa de receber lembretes até surgir um novo alerta).
 */
export function montarLembrete(
  local: LocalMonitorado,
  ultimo: UltimoAlerta,
  agora: Date,
  maxDiasPadrao: number,
): Lembrete | null {
  const quando = new Date(ultimo.criado_em);
  const horas = Math.max(0, Math.floor((agora.getTime() - quando.getTime()) / 3_600_000));
  const dias = Math.floor(horas / 24);
  const maxDias = local.maxDiasLembrete ?? maxDiasPadrao;

  if (dias > maxDias) return null;

  return {
    municipio: local.municipio,
    uf: local.uf.toUpperCase(),
    ultimoAlerta: quando,
    horas,
    dias,
    maxDias,
    tipo_alerta: ultimo.tipo_alerta,
    severidade: ultimo.severidade as Severidade | null,
  };
}
