-- Banco próprio de fotos reais de imóveis (14/10/2026) — ver supabase/painel/abastecer-fotos.ts
-- O buscar-imagens tira fotos daqui primeiro; a API do Unsplash/Pexels vira reserva (o limite gratuito acabava rápido).
create table if not exists public.banco_fotos (
  id text primary key,                  -- "u<id>" (Unsplash) ou "p<id>" (Pexels): mesmo formato de fotos_usadas
  categoria text not null,              -- sala, cozinha, fachada, chaves, fortaleza... (lista no abastecer-fotos)
  url text not null,
  credito text not null,
  link text not null,
  download_location text,               -- Unsplash: avisar o "download" quando a foto for usada (regra da API)
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists banco_fotos_categoria_idx on public.banco_fotos (categoria) where ativo;
alter table public.banco_fotos enable row level security;
revoke all on public.banco_fotos from anon, authenticated;

create or replace function public.banco_fotos_contagem()
returns table (categoria text, n bigint) language sql stable security definer set search_path = public as $$
  select categoria, count(*) from banco_fotos where ativo group by categoria
$$;
revoke all on function public.banco_fotos_contagem() from public, anon, authenticated;

-- sorteia fotos de uma categoria que o corretor ainda não usou (fotos_usadas)
create or replace function public.banco_fotos_sortear(p_categoria text, p_corretor uuid, p_excluir text[] default '{}', p_qtd int default 1)
returns setof public.banco_fotos language sql volatile security definer set search_path = public as $$
  select b.* from banco_fotos b
  where b.ativo and b.categoria = p_categoria
    and not (b.id = any(p_excluir)) and not (b.url = any(p_excluir))
    and not exists (select 1 from fotos_usadas f where f.corretor_id = p_corretor and f.foto_id = b.id)
  order by random() limit greatest(1, least(p_qtd, 10))
$$;
revoke all on function public.banco_fotos_sortear(text, uuid, text[], int) from public, anon, authenticated;

-- a cada 20 min abastece um pouco (a função tem trava de 15 min e para quando cada categoria enche)
select cron.unschedule('abastecer-fotos') where exists (select 1 from cron.job where jobname = 'abastecer-fotos');
select cron.schedule('abastecer-fotos', '7,27,47 * * * *', $$ select net.http_post(
  url := 'https://qbfmozumntequvecttfs.supabase.co/functions/v1/abastecer-fotos',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
); $$);
