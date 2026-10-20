-- Importar imóvel por link + página pública do imóvel (aditiva, idempotente)

-- 1) log para rate limit da função importar-imovel (só service role acessa)
create table if not exists public.importacoes_imovel_log (
  id uuid primary key default gen_random_uuid(),
  corretor_id uuid not null,
  url text,
  created_at timestamptz not null default now()
);
create index if not exists importacoes_imovel_log_idx on public.importacoes_imovel_log (corretor_id, created_at desc);
alter table public.importacoes_imovel_log enable row level security;

-- 2) eventos da página pública
create table if not exists public.imovel_eventos (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  tipo text not null check (tipo in ('visita','whatsapp')),
  created_at timestamptz not null default now()
);
create index if not exists imovel_eventos_prop_idx on public.imovel_eventos (propriedade_id, tipo, created_at desc);
alter table public.imovel_eventos enable row level security;

drop policy if exists imovel_eventos_dono_select on public.imovel_eventos;
create policy imovel_eventos_dono_select on public.imovel_eventos
  for select to authenticated
  using (exists (select 1 from public.propriedades p where p.id = propriedade_id and p.corretor_id = auth.uid()));

-- 3) dados públicos do imóvel + corretor
create or replace function public.imovel_publico(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'titulo', p.titulo,
    'tipo', p.tipo,
    'finalidade', p.finalidade,
    'preco', p.preco,
    'bairro', p.bairro,
    'cidade', p.cidade,
    'quartos', p.quartos,
    'suites', p.suites,
    'vagas', p.vagas,
    'banheiros', p.banheiros,
    'area_m2', p.area_m2,
    'descricao', p.descricao,
    'diferenciais', coalesce(p.diferenciais, '[]'::jsonb),
    'fotos', coalesce(p.fotos, '[]'::jsonb),
    'corretor_nome', pr.nome,
    'corretor_creci', pr.creci,
    'corretor_telefone', pr.telefone
  )
  from public.propriedades p
  left join public.profiles pr on pr.id = p.corretor_id
  where p.id = p_id
$$;
revoke all on function public.imovel_publico(uuid) from public;
grant execute on function public.imovel_publico(uuid) to anon, authenticated;

-- 4) registrar visita/clique (limite simples por imóvel/tipo/hora)
create or replace function public.registrar_evento_imovel(p_id uuid, p_tipo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipo not in ('visita','whatsapp') then return; end if;
  if not exists (select 1 from public.propriedades where id = p_id) then return; end if;
  if (select count(*) from public.imovel_eventos
        where propriedade_id = p_id and tipo = p_tipo and created_at > now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into public.imovel_eventos (propriedade_id, tipo) values (p_id, p_tipo);
end;
$$;
revoke all on function public.registrar_evento_imovel(uuid, text) from public;
grant execute on function public.registrar_evento_imovel(uuid, text) to anon, authenticated;
