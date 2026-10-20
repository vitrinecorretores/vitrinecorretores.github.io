-- Fase 2-C: preço do m² por bairro, indique um colega, números reais da landing. Migração aditiva e idempotente.

-- ---------- helpers ----------
create or replace function public.norm_texto(t text) returns text
language sql immutable as $$
  select lower(btrim(translate(coalesce(t,''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')))
$$;

create or replace function public.vitrine_eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = 'f13c2703-8848-485a-ae60-97e139a2b0a6'::uuid
      or coalesce(auth.jwt() ->> 'email','') = 'evandrotorresrj@gmail.com'
$$;

-- ---------- 1) preço do m² por bairro ----------
create or replace function public.precos_bairro(p_cidade text)
returns table (bairro text, finalidade text, mediana_m2 numeric, qtd integer)
language sql stable security definer set search_path = public as $$
  select min(btrim(p.bairro))::text as bairro,
         p.finalidade::text,
         round((percentile_cont(0.5) within group (order by p.preco / p.area_m2))::numeric, 2) as mediana_m2,
         count(*)::integer as qtd
    from public.propriedades p
   where p_cidade is not null and btrim(p_cidade) <> ''
     and public.norm_texto(regexp_replace(coalesce(p.cidade,''), '\s*[·,/-].*$', '')) = public.norm_texto(regexp_replace(p_cidade, '\s*[·,/-].*$', ''))
     and p.bairro is not null and btrim(p.bairro) <> ''
     and p.finalidade in ('venda','aluguel')
     and p.area_m2 > 15 and p.preco > 0
   group by public.norm_texto(p.bairro), p.finalidade
  having count(*) >= 3
   order by count(*) desc, 1
$$;
revoke all on function public.precos_bairro(text) from public, anon;
grant execute on function public.precos_bairro(text) to authenticated;

-- ---------- 2) indique um colega ----------
create or replace function public.gerar_codigo_indicacao() returns text
language plpgsql as $$
declare c text; i int := 0;
begin
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text || i::text), 1, 6));
    exit when not exists (select 1 from public.profiles where codigo_indicacao = c) or i > 20;
    i := i + 1;
  end loop;
  return c;
end $$;

alter table public.profiles add column if not exists codigo_indicacao text;
update public.profiles set codigo_indicacao = public.gerar_codigo_indicacao() where codigo_indicacao is null;
alter table public.profiles alter column codigo_indicacao set default public.gerar_codigo_indicacao();
create unique index if not exists profiles_codigo_indicacao_key on public.profiles (codigo_indicacao);

create table if not exists public.indicacoes (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.profiles(id) on delete cascade,
  indicado_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'cadastrado' check (status in ('cadastrado','assinou')),
  recompensa_aplicada boolean not null default false
);
create index if not exists indicacoes_indicador_idx on public.indicacoes (indicador_id);
alter table public.indicacoes enable row level security;
drop policy if exists indicacoes_indicador_le on public.indicacoes;
create policy indicacoes_indicador_le on public.indicacoes for select to authenticated using (indicador_id = auth.uid());

create or replace function public.registrar_indicacao(p_codigo text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_ind uuid; v_criado timestamptz;
begin
  if auth.uid() is null or p_codigo is null then return false; end if;
  select created_at into v_criado from public.profiles where id = auth.uid();
  if v_criado is null or v_criado < now() - interval '2 days' then return false; end if;
  select id into v_ind from public.profiles where codigo_indicacao = upper(btrim(p_codigo));
  if v_ind is null or v_ind = auth.uid() then return false; end if;
  insert into public.indicacoes (indicador_id, indicado_id) values (v_ind, auth.uid()) on conflict (indicado_id) do nothing;
  return found;
end $$;
revoke all on function public.registrar_indicacao(text) from public, anon;
grant execute on function public.registrar_indicacao(text) to authenticated;

create or replace function public.indicacao_marcar_assinou() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ativa' and new.equipe_id is null then
    update public.indicacoes set status = 'assinou' where indicado_id = new.corretor_id and status = 'cadastrado';
  end if;
  return new;
end $$;
drop trigger if exists trg_indicacao_assinou on public.assinaturas;
create trigger trg_indicacao_assinou after insert or update of status on public.assinaturas
  for each row execute function public.indicacao_marcar_assinou();

-- só admin: indicações que assinaram e ainda sem recompensa aplicada
create or replace function public.indicacoes_pendentes()
returns table (id uuid, indicador_nome text, indicador_email text, indicado_nome text, indicado_email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.vitrine_eh_admin() then raise exception 'Acesso negado.'; end if;
  return query
    select i.id, a.nome, a.email, b.nome, b.email, i.created_at
      from public.indicacoes i
      join public.profiles a on a.id = i.indicador_id
      join public.profiles b on b.id = i.indicado_id
     where i.status = 'assinou' and not i.recompensa_aplicada
     order by i.created_at;
end $$;
revoke all on function public.indicacoes_pendentes() from public, anon;
grant execute on function public.indicacoes_pendentes() to authenticated;

create or replace function public.marcar_indicacao_aplicada(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.vitrine_eh_admin() then raise exception 'Acesso negado.'; end if;
  update public.indicacoes set recompensa_aplicada = true where id = p_id;
  return found;
end $$;
revoke all on function public.marcar_indicacao_aplicada(uuid) from public, anon;
grant execute on function public.marcar_indicacao_aplicada(uuid) to authenticated;

-- ---------- 3) números reais da landing ----------
create or replace function public.numeros_vitrine() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'carrosseis',  (select floor(count(*) / 10.0) * 10 from public.carrosseis),
    'publicados',  (select floor(count(*) / 10.0) * 10 from public.carrosseis where status = 'publicado'),
    'corretores',  (select floor(count(*) / 10.0) * 10 from public.profiles),
    'imoveis',     (select floor(count(*) / 10.0) * 10 from public.propriedades)
  )
$$;
grant execute on function public.numeros_vitrine() to anon, authenticated;
