-- Pix de 1 mês (pagamento único): quando data_fim passa, o acesso volta ao estado de "teste encerrado".
-- Aplicada direto no projeto em 04/11/2026; roda de hora em hora pelo pg_cron (job expirar-pix).
create or replace function public.expirar_pix()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r record;
begin
  for r in
    select id, corretor_id from assinaturas
     where status::text = 'ativa' and stripe_subscription_id is null and equipe_id is null
       and promo like 'PIX%' and data_fim is not null and data_fim < now()
  loop
    update assinaturas set status = 'cancelada' where id = r.id;
    insert into assinaturas (corretor_id, status, data_inicio) values (r.corretor_id, 'trial', now());
    update profiles set trial_usado = greatest(coalesce(trial_limite, 15), coalesce(trial_usado, 0)),
                        trial_expira_em = least(coalesce(trial_expira_em, now()), now())
     where id = r.corretor_id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.expirar_pix() from public, anon, authenticated;
select cron.schedule('expirar-pix', '3 * * * *', 'select public.expirar_pix()');
