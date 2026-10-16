-- Log de autorespostas de e-mail da Vitrine.
-- Guarda a solicitação recebida, a resposta enviada e para quem a confirmação foi direcionada.

create table if not exists public.email_auto_respostas (
  id uuid primary key default gen_random_uuid(),
  remetente_email text not null,
  remetente_nome text,
  assunto text not null default '',
  corpo_texto text not null default '',
  categoria text not null default 'geral',
  confianca integer not null default 0 check (confianca >= 0 and confianca <= 100),
  status text not null default 'respondido' check (status in ('respondido', 'ignorado', 'falha')),
  resposta_assunto text,
  resposta_texto text,
  resposta_html text,
  destinatario_resposta text not null,
  owner_email text,
  owner_tipo text,
  message_id text,
  thread_id text,
  fontes jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_auto_respostas_remetente_idx on public.email_auto_respostas (remetente_email);
create index if not exists email_auto_respostas_created_at_idx on public.email_auto_respostas (created_at desc);
create index if not exists email_auto_respostas_status_idx on public.email_auto_respostas (status, created_at desc);

alter table public.email_auto_respostas enable row level security;

revoke all on public.email_auto_respostas from anon, authenticated;
