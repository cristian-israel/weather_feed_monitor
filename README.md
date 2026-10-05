# alertas-clima

Monitora uma conta do Instagram com avisos meteorológicos e avisa quando o alerta atinge os **municípios** que você definiu ou um **vizinho** deles. Um segundo cron manda, todo dia, há quanto tempo foi o último alerta de cada município, e para sozinho depois de X dias sem novidade.

## Como a localização funciona

A IA **só extrai** os lugares citados no post (município, região popular, estado). Quem decide se afeta você é o código (`src/localizacao.ts`), com dados em arquivo:

| Arquivo | Conteúdo |
| --- | --- |
| `locais.json` | Seus municípios, com opções de vizinhança e limite de lembretes |
| `data/catalogo.json` | Estado > municípios, cada um com sua região imediata (gerado do IBGE) |
| `data/apelidos.json` | Regiões populares ("Vale do Paranhana", "Grande POA") com seus municípios |

Regras de cruzamento:

- **Direto:** o município foi citado, ou está dentro de uma região/estado citado.
- **Vizinho:** algum município da mesma região imediata foi citado (ajustável por município).
- **Incerto:** o nome é ambíguo (existe em mais de um estado) e o post não deixa claro. O alerta sai marcado como `incerto`.
- **Não resolvido:** menções que não batem com nada conhecido (ex.: "litoral norte" sem apelido) são registradas no log. Cadastre em `apelidos.json` para passarem a valer.

### locais.json

```json
[
  {
    "municipio": "Parobé",
    "uf": "RS",
    "incluirVizinhas": true,
    "vizinhasExtras": ["Sapiranga", "Canela/RS"],
    "vizinhasIgnorar": ["Rolante"],
    "maxDiasLembrete": 7
  }
]
```

Só `municipio` e `uf` são obrigatórios. A grafia é validada contra o catálogo na inicialização.

### data/apelidos.json

```json
{
  "Vale do Paranhana": { "uf": "RS", "municipios": ["Parobé", "Taquara", "Igrejinha"] }
}
```

## Fluxo da captura

1. `FontePosts` captura posts novos (Playwright, com mock para testes).
2. A IA lê legenda, imagens e screenshot e devolve os lugares citados.
3. O código cruza com `locais.json` e gera ocorrências (`direto` / `vizinho`).
4. Se houver ocorrências, chama o `Notificador` e grava em `alertas_municipio`.
5. O post é gravado em `posts_processados` para não ser analisado de novo.

## Lembrete diário

O cron `CRON_LEMBRETE` (padrão `0 9 * * *`) calcula, para cada município, o tempo desde o último alerta **direto e certo** (vizinho e incerto não contam). Se o último alerta tem mais de `MAX_DIAS_LEMBRETE` dias, o município deixa de receber lembretes até surgir um novo. Municípios sem nenhum registro não geram lembrete. Use `CRON_LEMBRETE=off` para desligar.

## Configuração

```bash
pnpm install
pnpm exec playwright install chromium
cp .env.example .env   # preencha as variáveis
pnpm catalogo          # gera data/catalogo.json (estados do locais.json)
```

1. Rode o conteúdo de `supabase.sql` no SQL Editor do Supabase.
2. Teste o fluxo sem Instagram: `FONTE=mock` no `.env`, depois `pnpm start`.
3. Para a captura real: `pnpm login:instagram` (use uma conta secundária), depois `FONTE=playwright` e `pnpm start`.

> Para testar sem internet para o IBGE, copie `data/catalogo.exemplo.json` para `data/catalogo.json`. É só um exemplo mínimo, com regiões fictícias.

> Não use `pnpm login`: é um comando nativo do pnpm. Por isso o script se chama `login:instagram`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm start` | Uma rodada de captura e encerra |
| `pnpm agendar` | Fica rodando: captura (`CRON`) e lembrete (`CRON_LEMBRETE`) |
| `pnpm lembrete` | Dispara os lembretes uma vez, para testar |
| `pnpm catalogo [UFs]` | Gera o catálogo a partir do IBGE |
| `pnpm login:instagram` | Abre o navegador para salvar a sessão |
| `pnpm typecheck` | Verifica os tipos |

Para manter o agendador vivo em segundo plano, use `pm2 start "pnpm agendar" --name alertas-clima` ou um serviço do systemd.

## Notificador

Edite `src/notificador.ts` e implemente a interface `Notificador`:

- `enviar(post, alerta)`: `alerta.ocorrencias` traz município, `relacao` (`direto`/`vizinho`), `via` (menções ou vizinhos citados) e `incerto`.
- `lembrar(lembretes)`: lista com município, dias e horas desde o último alerta.
- `avisarFalha(mensagem)`: erros de captura ou das rotinas.

## Quando a captura falha

A fonte depende só de links `/p/` e `/reel/` e das meta tags `og:*`. Se quebrar (sessão expirada, bloqueio ou layout), `avisarFalha` é chamado com o motivo. Sessão expirada se resolve com `pnpm login:instagram`.

## Observações

- "Vizinho" é aproximado: mesma região imediata do IBGE, não necessariamente divisa. Ajuste com `vizinhasExtras` e `vizinhasIgnorar`.
- O horário do "último alerta" é o de processamento do post (até um intervalo do cron após a publicação).
- Se o alerta for enviado e a gravação no banco falhar, ele pode chegar duplicado na rodada seguinte.
- Scraping viola os termos do Instagram; use conta secundária e intervalos espaçados.
- Em IP de datacenter o bloqueio é comum. Rodar em casa costuma funcionar melhor.
- O `og:image` e o screenshot mostram só o primeiro slide de carrosséis.
