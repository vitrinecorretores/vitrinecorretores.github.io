-- Plataforma funcionando sozinha (15/10/2026):
--  1) e-mails automáticos passam pela função "avisos" (envia pelo Brevo se configurado; senão repassa pro n8n);
--  2) manutenção diária: renova o acesso ao Instagram antes de vencer e limpa imagens antigas do Storage.

-- avisos já enviados (evita repetir e impede disparo em massa por quem chamar a função de fora)
create table if not exists public.avisos_enviados (
  chave text primary key,
  evento text not null,
  corretor_id uuid,
  created_at timestamptz not null default now()
);
alter table public.avisos_enviados enable row level security;
revoke all on public.avisos_enviados from anon, authenticated;

-- o banco agora chama a função avisos (que decide entre Brevo e n8n); mesma assinatura de antes
create or replace function public.avisar_n8n(p_evento text, p_corretor uuid, p_extra jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://qbfmozumntequvecttfs.supabase.co/functions/v1/avisos',
    body := jsonb_build_object('evento', p_evento, 'corretor_id', p_corretor, 'extra', coalesce(p_extra, '{}'::jsonb)),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'avisar_n8n falhou: %', sqlerrm;   -- aviso nunca quebra a operação principal
end $$;
revoke all on function public.avisar_n8n(text, uuid, jsonb) from public, anon, authenticated;

-- publicação: manda também o id do carrossel (a função confere no banco antes de avisar)
create or replace function public.trg_n8n_publicacao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_titulo text;
begin
  select coalesce(s.titulo, new.assunto_custom, 'Carrossel') into v_titulo
    from slides s where s.carrossel_id = new.id order by s.ordem limit 1;
  v_titulo := replace(coalesce(v_titulo, new.assunto_custom, 'Carrossel'), '*', '');
  if new.status = 'publicado' and old.status is distinct from 'publicado' then
    perform avisar_n8n('publicado', new.corretor_id, jsonb_build_object('carrossel_id', new.id, 'titulo', v_titulo, 'permalink', new.instagram_permalink));
  elsif new.erro_publicacao is not null and old.erro_publicacao is distinct from new.erro_publicacao then
    perform avisar_n8n('erro_publicacao', new.corretor_id, jsonb_build_object('carrossel_id', new.id, 'titulo', v_titulo, 'erro', left(new.erro_publicacao, 300)));
  end if;
  return new;
end $$;

-- limpeza dos avisos com mais de 90 dias + manutenção diária (03:41 de Fortaleza)
select cron.unschedule('limpar-avisos') where exists (select 1 from cron.job where jobname = 'limpar-avisos');
select cron.schedule('limpar-avisos', '37 6 * * *', $$delete from public.avisos_enviados where created_at < now() - interval '90 days'$$);
select cron.unschedule('manutencao-diaria') where exists (select 1 from cron.job where jobname = 'manutencao-diaria');
select cron.schedule('manutencao-diaria', '41 6 * * *', $$ select net.http_post(
  url := 'https://qbfmozumntequvecttfs.supabase.co/functions/v1/manutencao-diaria',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
); $$);
