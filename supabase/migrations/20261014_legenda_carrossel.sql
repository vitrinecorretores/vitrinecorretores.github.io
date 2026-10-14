-- Legenda propria por carrossel (14/10/2026): usada pelo publicar-agendados; sem ela, a legenda junta os titulos dos slides
alter table public.carrosseis add column if not exists legenda text;
