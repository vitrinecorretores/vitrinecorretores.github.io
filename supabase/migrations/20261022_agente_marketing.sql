-- Agente de Marketing (22/10/2026)
-- 1) marketing_experimentos: cada post do agente vira um experimento (pilar, fórmula do gancho, estilo, cor, fonte, horário).
--    Cruzado com ig_metricas_posts, decide o que repetir e o que testar.
-- 2) agente_config: configurações privadas (chave do CallMeBot). Sem policies = só o service role lê.
-- 3) Aviso no WhatsApp do Evandro quando um post do @vitrinecorretores é publicado (ou falha), via CallMeBot.

create table if not exists public.marketing_experimentos (
  carrossel_id uuid primary key references public.carrosseis(id) on delete cascade,
  corretor_id uuid not null,
  pilar text, formula text, estilo text, cor text, fonte text, slot text,
  assunto text, por_que text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_experimentos_corretor_idx on public.marketing_experimentos (corretor_id, created_at desc);
alter table public.marketing_experimentos enable row level security;
revoke all on public.marketing_experimentos from anon, authenticated;

create table if not exists public.agente_config (
  chave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);
alter table public.agente_config enable row level security;
revoke all on public.agente_config from anon, authenticated;

-- telefone do Evandro (só ele recebe) — a apikey do CallMeBot entra depois:
--   insert into agente_config (chave, valor) values ('callmebot_apikey', 'SUA_CHAVE')
--   on conflict (chave) do update set valor = excluded.valor, updated_at = now();
insert into public.agente_config (chave, valor) values ('whatsapp_dono', '+5585981665189')
  on conflict (chave) do nothing;

create or replace function public.avisar_whatsapp_dono(p_texto text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_tel text; v_key text;
begin
  select valor into v_tel from agente_config where chave = 'whatsapp_dono';
  select valor into v_key from agente_config where chave = 'callmebot_apikey';
  if v_tel is null or v_key is null then return; end if;   -- sem chave configurada: não faz nada
  perform net.http_get(
    url := 'https://api.callmebot.com/whatsapp.php',
    params := jsonb_build_object('phone', v_tel, 'text', left(p_texto, 1500), 'apikey', v_key),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'avisar_whatsapp_dono falhou: %', sqlerrm;   -- aviso nunca quebra a publicação
end $$;
revoke all on function public.avisar_whatsapp_dono(text) from public, anon, authenticated;

create or replace function public.trg_whatsapp_post_vitrine() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_capa text; e record; v_txt text;
begin
  if new.corretor_id <> 'f13c2703-8848-485a-ae60-97e139a2b0a6' then return new; end if;
  select replace(coalesce(s.titulo, 'Carrossel'), '*', '') into v_capa
    from slides s where s.carrossel_id = new.id order by s.ordem limit 1;
  select * into e from marketing_experimentos where carrossel_id = new.id;

  if new.status = 'publicado' and old.status is distinct from 'publicado' then
    v_txt := 'Post publicado no @vitrinecorretores' || chr(10) || chr(10) ||
      'Capa: ' || coalesce(v_capa, 'Carrossel') || chr(10) ||
      coalesce('Link: ' || new.instagram_permalink || chr(10), '') ||
      case when e.carrossel_id is not null then
        chr(10) || 'Teste: pilar ' || coalesce(e.pilar, '-') || ' | estilo ' || coalesce(e.estilo, '-') ||
        ' | cor ' || coalesce(e.cor, '-') || ' | ' || coalesce(e.slot, '') || chr(10) ||
        'Por que: ' || coalesce(e.por_que, '')
      else chr(10) || '(post agendado manualmente)' end;
    perform avisar_whatsapp_dono(v_txt);
  elsif new.erro_publicacao is not null and old.erro_publicacao is distinct from new.erro_publicacao then
    perform avisar_whatsapp_dono('ATENCAO: falhou a publicacao no @vitrinecorretores' || chr(10) || 'Capa: ' || coalesce(v_capa, 'Carrossel') ||
      chr(10) || 'Motivo: ' || left(new.erro_publicacao, 300));
  end if;
  return new;
end $$;
drop trigger if exists whatsapp_post_vitrine on public.carrosseis;
create trigger whatsapp_post_vitrine after update of status, erro_publicacao on public.carrosseis
  for each row execute function public.trg_whatsapp_post_vitrine();
