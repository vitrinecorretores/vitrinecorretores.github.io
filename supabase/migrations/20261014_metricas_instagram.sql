-- Métricas do Instagram (14/10/2026) — ver supabase/painel/instagram-metricas.ts
-- Uma foto por dia da conta (seguidores, alcance...) e o desempenho de cada post, pra acompanhar o crescimento orgânico.
create table if not exists public.ig_metricas_conta (
  corretor_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  seguidores int, seguindo int, posts int,
  alcance int, visitas_perfil int, cliques_link int, contas_engajadas int, interacoes int,
  created_at timestamptz not null default now(),
  primary key (corretor_id, dia)
);
create table if not exists public.ig_metricas_posts (
  media_id text primary key,
  corretor_id uuid not null references auth.users(id) on delete cascade,
  carrossel_id uuid references public.carrosseis(id) on delete set null,
  publicado_em timestamptz, tipo text, legenda_inicio text, permalink text,
  curtidas int, comentarios int, salvamentos int, compartilhamentos int, alcance int, visualizacoes int, interacoes int,
  atualizado_em timestamptz not null default now()
);
create index if not exists ig_metricas_posts_corretor_idx on public.ig_metricas_posts (corretor_id, publicado_em desc);
alter table public.ig_metricas_conta enable row level security;
alter table public.ig_metricas_posts enable row level security;
revoke all on public.ig_metricas_conta, public.ig_metricas_posts from anon, authenticated;
-- cada corretor pode ler só as próprias métricas (pra mostrar no app no futuro)
drop policy if exists ig_metricas_conta_ler on public.ig_metricas_conta;
create policy ig_metricas_conta_ler on public.ig_metricas_conta for select to authenticated using (corretor_id = auth.uid());
drop policy if exists ig_metricas_posts_ler on public.ig_metricas_posts;
create policy ig_metricas_posts_ler on public.ig_metricas_posts for select to authenticated using (corretor_id = auth.uid());
grant select on public.ig_metricas_conta, public.ig_metricas_posts to authenticated;

-- 1x por dia, 23:13 de Fortaleza (02:13 UTC)
select cron.unschedule('instagram-metricas') where exists (select 1 from cron.job where jobname = 'instagram-metricas');
select cron.schedule('instagram-metricas', '13 2 * * *', $$ select net.http_post(
  url := 'https://qbfmozumntequvecttfs.supabase.co/functions/v1/instagram-metricas',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
); $$);
