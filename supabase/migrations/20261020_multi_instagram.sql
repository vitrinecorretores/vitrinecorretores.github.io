-- Vários Instagram por corretor (Starter 1, Pro 3, equipe 3, teste grátis 1 — o limite é aplicado na edge function).
-- Idempotente: pode rodar mais de uma vez. Não apaga nenhuma conta nem token existente.

-- 1) instagram_contas: id próprio; deixa de ser "uma por corretor"
alter table public.instagram_contas add column if not exists id uuid default gen_random_uuid();
update public.instagram_contas set id = gen_random_uuid() where id is null;
alter table public.instagram_contas alter column id set not null;

do $$
declare r record; att int2;
begin
  select attnum into att from pg_attribute where attrelid = 'public.instagram_contas'::regclass and attname = 'corretor_id';
  -- remove PK/unique que cobrem SÓ corretor_id (a regra antiga de 1 conta por corretor)
  for r in select conname from pg_constraint
           where conrelid = 'public.instagram_contas'::regclass and contype in ('p','u') and conkey = array[att]
  loop
    execute format('alter table public.instagram_contas drop constraint %I', r.conname);
  end loop;
  for r in select i.indexrelid::regclass::text as idx from pg_index i
           where i.indrelid = 'public.instagram_contas'::regclass and i.indisunique and not i.indisprimary
             and i.indkey::int2[] = array[att]
             and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
  loop
    execute format('drop index %s', r.idx);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.instagram_contas'::regclass and contype = 'p') then
    alter table public.instagram_contas add primary key (id);
  end if;
end $$;

-- se alguma conta antiga não tem instagram_business_id, a unique abaixo ignora (null não conflita)
create unique index if not exists instagram_contas_corretor_ig_uniq
  on public.instagram_contas (corretor_id, instagram_business_id);
create index if not exists instagram_contas_corretor_idx on public.instagram_contas (corretor_id);

alter table public.instagram_contas enable row level security;
drop policy if exists "usuário vê a própria conta do instagram" on public.instagram_contas;
create policy "usuário vê a própria conta do instagram" on public.instagram_contas
  for select to authenticated using (auth.uid() = corretor_id);
revoke insert, update, delete on public.instagram_contas from anon, authenticated;

-- 2) instagram_tokens: um token por conta (ligado à conta)
alter table public.instagram_tokens add column if not exists id uuid default gen_random_uuid();
update public.instagram_tokens set id = gen_random_uuid() where id is null;
alter table public.instagram_tokens add column if not exists conta_id uuid references public.instagram_contas(id) on delete cascade;

-- liga cada token existente à conta que o corretor já tinha (só uma por corretor até agora)
update public.instagram_tokens t set conta_id = c.id
  from public.instagram_contas c
  where t.conta_id is null and c.corretor_id = t.corretor_id;

do $$
declare r record; att int2;
begin
  select attnum into att from pg_attribute where attrelid = 'public.instagram_tokens'::regclass and attname = 'corretor_id';
  for r in select conname from pg_constraint
           where conrelid = 'public.instagram_tokens'::regclass and contype in ('p','u') and conkey = array[att]
  loop
    execute format('alter table public.instagram_tokens drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.instagram_tokens'::regclass and contype = 'p') then
    alter table public.instagram_tokens alter column id set not null;
    alter table public.instagram_tokens add primary key (id);
  end if;
end $$;
create unique index if not exists instagram_tokens_conta_uniq on public.instagram_tokens (conta_id);
alter table public.instagram_tokens enable row level security;   -- sem policies: só service role
revoke all on public.instagram_tokens from anon, authenticated;

-- 3) carrosseis: conta(s) de destino. vazio/null = conta principal (a mais antiga ativa)
alter table public.carrosseis add column if not exists instagram_contas_ids uuid[];

-- 4) métricas por conta (cada Instagram tem a sua linha por dia)
alter table public.ig_metricas_conta add column if not exists conta_id uuid references public.instagram_contas(id) on delete cascade;
update public.ig_metricas_conta m set conta_id = c.id from public.instagram_contas c
  where m.conta_id is null and c.corretor_id = m.corretor_id and c.status = 'ativo';
alter table public.ig_metricas_conta drop constraint if exists ig_metricas_conta_pkey;
create unique index if not exists ig_metricas_conta_conta_dia on public.ig_metricas_conta (conta_id, dia);
