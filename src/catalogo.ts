import { existsSync, readFileSync } from 'node:fs';
import { config } from './config';
import { Localizador } from './localizacao';
import type { Apelidos, Catalogo, LocalMonitorado } from './tipos';

export type Contexto = {
  localizador: Localizador;
  locais: LocalMonitorado[];
  ufs: string[];
};

function lerJson<T>(caminho: string, dica: string): T {
  if (!existsSync(caminho)) throw new Error(`Arquivo não encontrado: ${caminho}. ${dica}`);
  try {
    return JSON.parse(readFileSync(caminho, 'utf-8')) as T;
  } catch (e) {
    throw new Error(`JSON inválido em ${caminho}: ${(e as Error).message}`);
  }
}

/** Carrega catálogo, apelidos e municípios monitorados. Falha cedo se algo estiver errado. */
export function carregarContexto(): Contexto {
  const catalogo = lerJson<Catalogo>(config.catalogoPath, 'Gere com `pnpm catalogo`.');
  const apelidos = existsSync(config.apelidosPath)
    ? lerJson<Apelidos>(config.apelidosPath, '')
    : {};
  const brutos = lerJson<LocalMonitorado[]>(
    config.locaisPath,
    'Crie o locais.json (veja o README).',
  );

  if (!Array.isArray(brutos) || brutos.length === 0) {
    throw new Error(`${config.locaisPath} precisa ser uma lista com ao menos um município`);
  }

  const localizador = new Localizador(catalogo, apelidos);
  const { locais, problemas } = localizador.canonizar(brutos);
  if (problemas.length > 0) throw new Error(problemas.join('\n'));

  for (const aviso of localizador.avisos) console.warn(`[aviso] ${aviso}`);

  const ufs = [...new Set(locais.map((l) => l.uf))];
  return { localizador, locais, ufs };
}
