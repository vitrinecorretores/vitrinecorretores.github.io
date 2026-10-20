-- Kit da marca (logo, cor, ativar/desativar) e "melhorar fotos" por carrossel
alter table public.profiles add column if not exists logo_url text;
alter table public.profiles add column if not exists cor_marca text;
alter table public.profiles add column if not exists marca_ativa boolean not null default true;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_cor_marca_hex') then
    alter table public.profiles add constraint profiles_cor_marca_hex check (cor_marca is null or cor_marca ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;
-- o app só pode editar colunas liberadas explicitamente (grant por coluna)
grant update (logo_url, cor_marca, marca_ativa) on public.profiles to authenticated;

alter table public.carrosseis add column if not exists melhorar_fotos boolean not null default true;
grant select (melhorar_fotos), insert (melhorar_fotos), update (melhorar_fotos) on public.carrosseis to authenticated;
grant select (logo_url, cor_marca, marca_ativa) on public.profiles to authenticated;
