import type { Apelidos, Catalogo, LocalMonitorado, Mencao, Ocorrencia } from './tipos';

/** Minúsculas, sem acento e sem pontuação, para comparar nomes. */
export const normalizar = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type Mun = { nome: string; uf: string; regiao: string };
type Resolucao = { municipios: Mun[]; incerto: boolean };

const chave = (uf: string, nome: string) => `${uf}:${normalizar(nome)}`;

function adicionar<K, V>(mapa: Map<K, V[]>, k: K, v: V) {
  const lista = mapa.get(k);
  if (lista) lista.push(v);
  else mapa.set(k, [v]);
}

const unicos = (xs: string[]) => [...new Set(xs)];

export class Localizador {
  readonly avisos: string[] = [];

  private porChave = new Map<string, Mun>();
  private porNome = new Map<string, Mun[]>();
  private porUf = new Map<string, Mun[]>();
  private porRegiao = new Map<string, Mun[]>();
  private estados = new Map<string, string>();
  private apelidos = new Map<string, Mun[]>();
  private cacheVizinhos = new Map<string, Mun[]>();

  constructor(catalogo: Catalogo, apelidos: Apelidos = {}) {
    for (const [ufBruta, estado] of Object.entries(catalogo.estados)) {
      const uf = ufBruta.toUpperCase();
      this.estados.set(normalizar(uf), uf);
      this.estados.set(normalizar(estado.nome), uf);

      const lista: Mun[] = [];
      for (const m of estado.municipios) {
        const mun: Mun = { nome: m.nome, uf, regiao: m.regiao };
        lista.push(mun);
        this.porChave.set(chave(uf, m.nome), mun);
        adicionar(this.porNome, normalizar(m.nome), mun);
        adicionar(this.porRegiao, `${uf}|${m.regiao}`, mun);
      }
      this.porUf.set(uf, lista);
    }

    for (const [nome, def] of Object.entries(apelidos)) {
      const uf = def.uf.toUpperCase();
      const membros: Mun[] = [];
      for (const n of def.municipios) {
        const mun = this.porChave.get(chave(uf, n));
        if (mun) membros.push(mun);
        else this.avisos.push(`Apelido "${nome}": município fora do catálogo: ${n}/${uf}`);
      }
      this.apelidos.set(normalizar(nome), membros);
    }
  }

  /** Confere os municípios monitorados e devolve a grafia oficial do catálogo. */
  canonizar(locais: LocalMonitorado[]): { locais: LocalMonitorado[]; problemas: string[] } {
    const problemas: string[] = [];
    const saida: LocalMonitorado[] = [];
    for (const l of locais) {
      const uf = l.uf.toUpperCase();
      const mun = this.porChave.get(chave(uf, l.municipio));
      if (!mun) {
        problemas.push(`Município não encontrado no catálogo: ${l.municipio}/${uf}`);
        continue;
      }
      const canonico: LocalMonitorado = { ...l, municipio: mun.nome, uf };
      saida.push(canonico);
      if (l.incluirVizinhas !== false && this.vizinhos(canonico).length === 0) {
        this.avisos.push(`${mun.nome}/${uf}: nenhum vizinho encontrado (região imediata sem outros municípios)`);
      }
    }
    return { locais: saida, problemas };
  }

  /** Vizinhos = demais municípios da região imediata, ajustados por extras/ignorar. */
  vizinhos(l: LocalMonitorado): Mun[] {
    const uf = l.uf.toUpperCase();
    const k = chave(uf, l.municipio);
    const kCache = `${k}|${JSON.stringify([l.vizinhasIgnorar ?? [], l.vizinhasExtras ?? []])}`;
    const emCache = this.cacheVizinhos.get(kCache);
    if (emCache) return emCache;

    const base = this.porChave.get(k);
    if (!base) return [];

    const ignorar = new Set((l.vizinhasIgnorar ?? []).map(normalizar));
    const lista = (this.porRegiao.get(`${uf}|${base.regiao}`) ?? []).filter(
      (m) => m !== base && !ignorar.has(normalizar(m.nome)),
    );

    for (const extra of l.vizinhasExtras ?? []) {
      const [nome, ufExtra] = extra.split('/').map((s) => s.trim());
      const mun = this.porChave.get(chave((ufExtra ?? uf).toUpperCase(), nome));
      if (!mun) this.avisos.push(`${base.nome}: vizinho extra fora do catálogo: ${extra}`);
      else if (mun !== base && !lista.includes(mun)) lista.push(mun);
    }

    this.cacheVizinhos.set(kCache, lista);
    return lista;
  }

  /** Traduz uma menção (município, apelido de região ou estado) em municípios. */
  resolver(m: Mencao): Resolucao {
    const n = normalizar(m.nome);
    const vazio: Resolucao = { municipios: [], incerto: false };
    if (!n) return vazio;
    const uf = m.uf ? m.uf.trim().toUpperCase() : null;

    const tentarMunicipio = (): Resolucao | null => {
      const todos = this.porNome.get(n) ?? [];
      if (todos.length === 0) return null;
      if (!uf) return { municipios: todos, incerto: todos.length > 1 };
      const filtrados = todos.filter((x) => x.uf === uf);
      // UF informada não bate com nenhum candidato: mantém todos, mas como incerto.
      if (filtrados.length === 0) return { municipios: todos, incerto: true };
      return { municipios: filtrados, incerto: filtrados.length > 1 };
    };

    const tentarApelido = (): Resolucao | null => {
      const membros = this.apelidos.get(n);
      return membros && membros.length > 0 ? { municipios: membros, incerto: false } : null;
    };

    const tentarEstado = (): Resolucao | null => {
      const sigla = this.estados.get(n);
      return sigla ? { municipios: this.porUf.get(sigla) ?? [], incerto: false } : null;
    };

    const ordem =
      m.tipo === 'estado'
        ? [tentarEstado, tentarMunicipio, tentarApelido]
        : m.tipo === 'regiao'
          ? [tentarApelido, tentarMunicipio, tentarEstado]
          : [tentarMunicipio, tentarApelido, tentarEstado];

    for (const tentar of ordem) {
      const r = tentar();
      if (r) return r;
    }
    return vazio;
  }

  /** Cruza as menções do post com os municípios monitorados. */
  avaliar(
    mencoes: Mencao[],
    locais: LocalMonitorado[],
  ): { ocorrencias: Ocorrencia[]; naoResolvidos: string[] } {
    const resolvidas = mencoes.map((m) => ({ m, r: this.resolver(m) }));
    const naoResolvidos = resolvidas.filter((x) => x.r.municipios.length === 0).map((x) => x.m.nome);
    const ocorrencias: Ocorrencia[] = [];

    for (const l of locais) {
      const uf = l.uf.toUpperCase();
      const alvo = this.porChave.get(chave(uf, l.municipio));
      if (!alvo) continue;

      const diretas = resolvidas.filter((x) => x.r.municipios.includes(alvo));
      if (diretas.length > 0) {
        ocorrencias.push({
          municipio: alvo.nome,
          uf,
          relacao: 'direto',
          via: unicos(diretas.map((x) => x.m.nome)),
          incerto: diretas.every((x) => x.r.incerto),
        });
        continue;
      }

      if (l.incluirVizinhas === false) continue;

      const vizinhos = new Set(this.vizinhos(l));
      const acertos = new Map<Mun, boolean>(); // vizinho -> algum match certo?
      for (const x of resolvidas) {
        for (const v of x.r.municipios) {
          if (vizinhos.has(v)) acertos.set(v, (acertos.get(v) ?? false) || !x.r.incerto);
        }
      }
      if (acertos.size > 0) {
        ocorrencias.push({
          municipio: alvo.nome,
          uf,
          relacao: 'vizinho',
          via: [...acertos.keys()].map((v) => v.nome).slice(0, 10),
          incerto: [...acertos.values()].every((certo) => !certo),
        });
      }
    }

    return { ocorrencias, naoResolvidos };
  }
}
