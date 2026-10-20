-- Ganchos alternativos da capa + aprovação do gestor na equipe (aditiva, idempotente)

-- 1) gancho escolhido na capa (0 = principal, 1-2 = alternativas)
alter table public.carrosseis add column if not exists gancho_idx smallint;

-- 2) aprovação na equipe
alter table public.equipes add column if not exists exigir_aprovacao boolean not null default false;
alter type public.carrossel_status add value if not exists 'aguardando_aprovacao';

-- gatilho: com a regra ligada, carrossel de MEMBRO que iria para 'agendado' fica aguardando o gestor.
-- Só vale quando quem grava é o próprio autor (auth.uid()); o dono aprovando (RPC) e o servidor (service role) passam direto.
create or replace function public.carrosseis_exigir_aprovacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.status::text = 'agendado'
     and (TG_OP = 'INSERT' or OLD.status::text is distinct from 'agendado')
     and auth.uid() is not null and auth.uid() = NEW.corretor_id
     and exists (
       select 1 from public.equipe_membros m join public.equipes e on e.id = m.equipe_id
       where m.corretor_id = NEW.corretor_id and m.status = 'ativo'
         and e.exigir_aprovacao and e.dono_id <> NEW.corretor_id)
  then
    NEW.status := 'aguardando_aprovacao';
  end if;
  return NEW;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_carrosseis_exigir_aprovacao') then
    create trigger trg_carrosseis_exigir_aprovacao before insert or update of status on public.carrosseis
      for each row execute function public.carrosseis_exigir_aprovacao();
  end if;
end $$;

-- configuração (dono liga/desliga; lê o estado atual)
create or replace function public.equipe_config() returns jsonb
language sql security definer set search_path = public stable as $$
  select coalesce((select jsonb_build_object('exigir_aprovacao', e.exigir_aprovacao) from public.equipes e where e.dono_id = auth.uid() limit 1),
                  '{}'::jsonb);
$$;

create or replace function public.equipe_definir_aprovacao(p_exigir boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.equipes set exigir_aprovacao = coalesce(p_exigir, false) where dono_id = auth.uid();
  if not found then raise exception 'Você não é dono de uma equipe.'; end if;
end $$;

-- pendentes do dono
create or replace function public.equipe_pendentes()
returns table (id uuid, corretor_id uuid, corretor_nome text, titulo text, data_agendada timestamptz, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select c.id, c.corretor_id, coalesce(p.nome, p.email), (select s.titulo from public.slides s where s.carrossel_id = c.id order by s.ordem limit 1),
         c.data_agendada, c.created_at
  from public.carrosseis c
  join public.equipe_membros m on m.corretor_id = c.corretor_id and m.status = 'ativo'
  join public.equipes e on e.id = m.equipe_id and e.dono_id = auth.uid()
  left join public.profiles p on p.id = c.corretor_id
  where c.status::text = 'aguardando_aprovacao'
  order by c.created_at;
$$;

create or replace function public.equipe_aprovar(p_carrossel uuid, p_aprovar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_autor uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select c.corretor_id into v_autor from public.carrosseis c where c.id = p_carrossel and c.status::text = 'aguardando_aprovacao';
  if v_autor is null then raise exception 'Esse carrossel não está aguardando aprovação.'; end if;
  if not exists (select 1 from public.equipe_membros m join public.equipes e on e.id = m.equipe_id
                 where m.corretor_id = v_autor and m.status = 'ativo' and e.dono_id = auth.uid()) then
    raise exception 'Você não é o gestor deste corretor.';
  end if;
  if p_aprovar then
    update public.carrosseis set status = 'agendado', erro_publicacao = null where id = p_carrossel;
  else
    update public.carrosseis set status = 'rascunho',
      erro_publicacao = 'Recusado pelo gestor' || case when nullif(trim(coalesce(p_motivo,'')), '') is not null then ': ' || left(trim(p_motivo), 300) else '.' end
      where id = p_carrossel;
  end if;
end $$;

revoke all on function public.equipe_config(), public.equipe_definir_aprovacao(boolean), public.equipe_pendentes(), public.equipe_aprovar(uuid, boolean, text), public.carrosseis_exigir_aprovacao() from public, anon;
grant execute on function public.equipe_config(), public.equipe_definir_aprovacao(boolean), public.equipe_pendentes(), public.equipe_aprovar(uuid, boolean, text) to authenticated;
