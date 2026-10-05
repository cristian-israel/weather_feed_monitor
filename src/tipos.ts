export type Post = {
  id: string;
  legenda: string;
  imagemUrls: string[];
  screenshot?: Buffer;
};

export type Severidade = 'baixa' | 'media' | 'alta';

/** Lugar citado no post, como a IA o extraiu. */
export type Mencao = {
  nome: string;
  tipo: 'municipio' | 'regiao' | 'estado' | 'outro';
  uf: string | null;
};

/** O que a IA devolve: só extração, sem decidir relevância. */
export type AnaliseIA = {
  eh_alerta: boolean;
  tipo_alerta: string | null;
  severidade: Severidade | null;
  mencoes: Mencao[];
};

/** Município que você monitora (arquivo locais.json). */
export type LocalMonitorado = {
  municipio: string;
  uf: string;
  /** Avisar também quando um vizinho for citado. Padrão: true. */
  incluirVizinhas?: boolean;
  /** Vizinhos a mais, além da região imediata. "Nome" (mesma UF) ou "Nome/UF". */
  vizinhasExtras?: string[];
  /** Municípios da região imediata a ignorar como vizinhos. */
  vizinhasIgnorar?: string[];
  /** Limite de dias para os lembretes deste município. Padrão: MAX_DIAS_LEMBRETE. */
  maxDiasLembrete?: number;
};

/** data/catalogo.json (gerado pelo script a partir do IBGE). */
export type Catalogo = {
  gerado_em?: string;
  estados: Record<string, { nome: string; municipios: { nome: string; regiao: string }[] }>;
};

/** data/apelidos.json: regiões populares (Vale do Paranhana, Grande POA...). */
export type Apelidos = Record<string, { uf: string; municipios: string[] }>;

export type Relacao = 'direto' | 'vizinho';

export type Ocorrencia = {
  municipio: string;
  uf: string;
  relacao: Relacao;
  /** Direto: menções que atingiram o município. Vizinho: vizinhos citados. */
  via: string[];
  /** true quando o match dependeu de um nome ambíguo (homônimos). */
  incerto: boolean;
};

export type Alerta = {
  tipo_alerta: string | null;
  severidade: Severidade | null;
  ocorrencias: Ocorrencia[];
  /** Menções que não bateram com nenhum município/região/estado conhecido. */
  naoResolvidos: string[];
};

export type Lembrete = {
  municipio: string;
  uf: string;
  ultimoAlerta: Date;
  horas: number;
  dias: number;
  maxDias: number;
  tipo_alerta: string | null;
  severidade: Severidade | null;
};

/** Fonte de posts. Troque a implementação sem mexer no resto. */
export interface FontePosts {
  buscarNovos(jaVisto: (id: string) => Promise<boolean>): Promise<Post[]>;
}

/** Ponto de encaixe do seu notificador. */
export interface Notificador {
  enviar(post: Post, alerta: Alerta): Promise<void>;
  /** Lembrete diário: há quanto tempo foi o último alerta de cada município. */
  lembrar(lembretes: Lembrete[]): Promise<void>;
  avisarFalha(mensagem: string): Promise<void>;
}
