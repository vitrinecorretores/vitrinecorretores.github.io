-- Avisos automáticos via n8n (13/10/2026): o banco avisa o fluxo "Vitrine — avisos automáticos" do n8n
-- quando um corretor se cadastra, um post é publicado/falha, ou o teste grátis acaba.
-- Envio assíncrono (pg_net): nunca trava nem derruba o insert/update original.
create extension if not exists pg_net;

create or replace function public.avisar_n8n(p_evento text, p_corretor uuid, p_extra jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text; v_nome text;
begin
  select u.email, coalesce(p.nome, '') into v_email, v_nome
    from auth.users u left join profiles p on p.id = u.id where u.id = p_corretor;
  perform net.http_post(
    url := 'https://vitrinecorretores.app.n8n.cloud/webhook/vitrine-570f8da3-d6fa-4cd6-b690-2420cfa19e0e',
    body := jsonb_build_object('evento', p_evento, 'email', v_email, 'nome', v_nome) || coalesce(p_extra, '{}'::jsonb),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'avisar_n8n falhou: %', sqlerrm;   -- aviso nunca quebra a operação principal
end $$;
revoke all on function public.avisar_n8n(text, uuid, jsonb) from public, anon, authenticated;

-- 1) corretor novo
create or replace function public.trg_n8n_novo_corretor() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform avisar_n8n('novo_corretor', new.id); return new; end $$;
drop trigger if exists n8n_novo_corretor on public.profiles;
create trigger n8n_novo_corretor after insert on public.profiles
  for each row execute function public.trg_n8n_novo_corretor();

-- 2) teste grátis esgotado (trial_usado chegou no limite)
create or replace function public.trg_n8n_teste_esgotado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.trial_usado, 0) >= coalesce(new.trial_limite, 3)
     and coalesce(old.trial_usado, 0) < coalesce(old.trial_limite, 3) then
    perform avisar_n8n('teste_esgotado', new.id);
  end if;
  return new;
end $$;
drop trigger if exists n8n_teste_esgotado on public.profiles;
create trigger n8n_teste_esgotado after update of trial_usado on public.profiles
  for each row execute function public.trg_n8n_teste_esgotado();

-- 3) post publicado / falha na publicação
create or replace function public.trg_n8n_publicacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_titulo text;
begin
  select coalesce(s.titulo, new.assunto_custom, 'Carrossel') into v_titulo
    from slides s where s.carrossel_id = new.id order by s.ordem limit 1;
  v_titulo := replace(coalesce(v_titulo, new.assunto_custom, 'Carrossel'), '*', '');
  if new.status = 'publicado' and old.status is distinct from 'publicado' then
    perform avisar_n8n('publicado', new.corretor_id, jsonb_build_object('titulo', v_titulo, 'permalink', new.instagram_permalink));
  elsif new.erro_publicacao is not null and old.erro_publicacao is distinct from new.erro_publicacao then
    perform avisar_n8n('erro_publicacao', new.corretor_id, jsonb_build_object('titulo', v_titulo, 'erro', left(new.erro_publicacao, 300)));
  end if;
  return new;
end $$;
drop trigger if exists n8n_publicacao on public.carrosseis;
create trigger n8n_publicacao after update of status, erro_publicacao on public.carrosseis
  for each row execute function public.trg_n8n_publicacao();
