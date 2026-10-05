import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config';
import type { Catalogo, LocalMonitorado } from '../tipos';

/**
 * Gera data/catalogo.json (estado > municípios, com a região imediata de cada um)
 * a partir da API de localidades do IBGE.
 *
 * Uso: pnpm catalogo            (usa os estados do locais.json)
 *      pnpm catalogo RS SC PR   (estados explícitos)
 */
const BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';

type IbgeEstado = { sigla: string; nome: string };
type IbgeMunicipio = {
  nome: string;
  'regiao-imediata'?: { nome: string } | null;
  microrregiao?: { nome: string } | null;
};

async function obter<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IBGE respondeu ${res.status} em ${url}`);
  return (await res.json()) as T;
}

function ufsDoLocais(): string[] {
  if (!existsSync(config.locaisPath)) return [];
  const locais = JSON.parse(readFileSync(config.locaisPath, 'utf-8')) as LocalMonitorado[];
  return [...new Set(locais.map((l) => l.uf.toUpperCase()))];
}

async function main() {
  const argumentos = process.argv.slice(2).map((s) => s.toUpperCase());
  const ufs = argumentos.length > 0 ? argumentos : ufsDoLocais();
  if (ufs.length === 0) throw new Error('Informe os estados: pnpm catalogo RS SC');

  const catalogo: Catalogo = existsSync(config.catalogoPath)
    ? (JSON.parse(readFileSync(config.catalogoPath, 'utf-8')) as Catalogo)
    : { estados: {} };

  for (const uf of ufs) {
    const estado = await obter<IbgeEstado>(`${BASE}/estados/${uf}`);
    const municipios = await obter<IbgeMunicipio[]>(`${BASE}/estados/${uf}/municipios`);
    catalogo.estados[uf] = {
      nome: estado.nome,
      municipios: municipios
        .map((m) => ({
          nome: m.nome,
          regiao: m['regiao-imediata']?.nome ?? m.microrregiao?.nome ?? m.nome,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    };
    console.log(`${uf}: ${municipios.length} municípios`);
  }

  catalogo.gerado_em = new Date().toISOString();
  mkdirSync(dirname(config.catalogoPath), { recursive: true });
  writeFileSync(config.catalogoPath, JSON.stringify(catalogo, null, 1));
  console.log(`Catálogo salvo em ${config.catalogoPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
