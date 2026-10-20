-- Comentário vira lead no WhatsApp + resumo semanal (21/10/2026). Só DDL aditiva, idempotente.
-- A resposta automática só funciona depois que o dono habilitar as permissões de comentários/mensagens no app da Meta.

-- regra por conta do Instagram (cada corretor configura a sua)
create table if not exists public.ig_comentario_regras (
  conta_id uuid primary key references public.instagram_contas(id) on delete cascade,
  corretor_id uuid not null references auth.users(id) on delete cascade,
  palavra_gatilho text not null default 'QUERO',
  mensagem_direct text not null default 'Oi {nome}! Vi seu comentário 😊 Me chama no WhatsApp pra eu te passar os detalhes: {whatsapp}',
  resposta_publica text,
  ativa boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists ig_comentario_regras_corretor_idx on public.ig_comentario_regras (corretor_id);

-- log: garante que nunca respondemos 2x o mesmo comentário
create table if not exists public.ig_comentarios_log (
  comment_id text primary key,
  conta_id uuid references public.instagram_contas(id) on delete cascade,
  corretor_id uuid references auth.users(id) on delete cascade,
  status text not null default 'recebido',   -- recebido | respondido | sem_regra | erro
  detalhe text,
  created_at timestamptz not null default now()
);
create index if not exists ig_comentarios_log_conta_idx on public.ig_comentarios_log (conta_id, created_at desc);

create table if not exists public.leads_instagram (
  id uuid primary key default gen_random_uuid(),
  corretor_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid references public.instagram_contas(id) on delete set null,
  username text,
  comentario text,
  media_id text,
  carrossel_id uuid references public.carrosseis(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists leads_instagram_corretor_idx on public.leads_instagram (corretor_id, created_at desc);

alter table public.ig_comentario_regras enable row level security;
alter table public.ig_comentarios_log enable row level security;
alter table public.leads_instagram enable row level security;
revoke all on public.ig_comentario_regras, public.ig_comentarios_log, public.leads_instagram from anon, authenticated;

drop policy if exists regras_dono_ler on public.ig_comentario_regras;
create policy regras_dono_ler on public.ig_comentario_regras for select to authenticated using (corretor_id = auth.uid());
drop policy if exists regras_dono_inserir on public.ig_comentario_regras;
create policy regras_dono_inserir on public.ig_comentario_regras for insert to authenticated
  with check (corretor_id = auth.uid() and exists (select 1 from public.instagram_contas c where c.id = conta_id and c.corretor_id = auth.uid()));
drop policy if exists regras_dono_editar on public.ig_comentario_regras;
create policy regras_dono_editar on public.ig_comentario_regras for update to authenticated
  using (corretor_id = auth.uid()) with check (corretor_id = auth.uid());
drop policy if exists log_dono_ler on public.ig_comentarios_log;
create policy log_dono_ler on public.ig_comentarios_log for select to authenticated using (corretor_id = auth.uid());
drop policy if exists leads_dono_ler on public.leads_instagram;
create policy leads_dono_ler on public.leads_instagram for select to authenticated using (corretor_id = auth.uid());

grant select, insert, update on public.ig_comentario_regras to authenticated;
grant select on public.ig_comentarios_log, public.leads_instagram to authenticated;
