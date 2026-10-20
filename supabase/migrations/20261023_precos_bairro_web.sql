-- Preço do m² por bairro buscado na internet (cache de 30 dias) + log para rate limit.
create table if not exists public.precos_bairro_web (
  id uuid primary key default gen_random_uuid(),
  cidade text not null,
  bairro text not null,
  finalidade text not null check (finalidade in ('venda','aluguel')),
  valor_m2 numeric not null,
  fonte_nome text not null,
  fonte_url text not null,
  referencia text,
  trecho text,
  created_at timestamptz not null default now()
);
create index if not exists precos_bairro_web_chave_idx on public.precos_bairro_web (cidade, bairro, finalidade, created_at desc);
alter table public.precos_bairro_web enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='precos_bairro_web' and policyname='precos_bairro_web_select') then
    create policy precos_bairro_web_select on public.precos_bairro_web for select to authenticated using (true);
  end if;
end $$;

create table if not exists public.precos_bairro_web_log (
  id uuid primary key default gen_random_uuid(),
  corretor_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists precos_bairro_web_log_idx on public.precos_bairro_web_log (corretor_id, created_at desc);
alter table public.precos_bairro_web_log enable row level security;
