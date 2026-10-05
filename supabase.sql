-- Rode no SQL Editor do Supabase

-- Posts já analisados (evita reprocessar)
create table if not exists posts_processados (
  id text primary key,
  legenda text,
  locais_afetados text[] default '{}',
  tipo_alerta text,
  severidade text,
  criado_em timestamptz default now()
);

-- Um registro por município afetado em cada post (base dos lembretes)
create table if not exists alertas_municipio (
  id bigint generated always as identity primary key,
  post_id text not null,
  municipio text not null,
  uf text not null,
  relacao text not null check (relacao in ('direto', 'vizinho')),
  via text[] default '{}',
  incerto boolean not null default false,
  tipo_alerta text,
  severidade text,
  criado_em timestamptz not null default now(),
  unique (post_id, municipio, uf)
);

create index if not exists alertas_municipio_ultimo_idx
  on alertas_municipio (municipio, uf, relacao, criado_em desc);

-- A service_role ignora RLS; mantenha o RLS ligado para bloquear acesso público.
alter table posts_processados enable row level security;
alter table alertas_municipio enable row level security;
