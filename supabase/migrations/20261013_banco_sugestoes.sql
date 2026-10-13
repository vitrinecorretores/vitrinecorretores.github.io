-- Banco diário de assuntos via Batch API da Anthropic (13/10/2026) — ver supabase/painel/banco-sugestoes.ts
create table if not exists public.lotes_ia (
  id bigint generated always as identity primary key,
  tipo text not null,                    -- 'assuntos'
  batch_id text,                         -- id do lote na Anthropic
  status text not null,                  -- enviado | processado | erro
  detalhe text,
  created_at timestamptz not null default now(),
  processado_em timestamptz
);
create index if not exists lotes_ia_tipo_idx on public.lotes_ia (tipo, created_at desc);
alter table public.lotes_ia enable row level security;
revoke all on public.lotes_ia from anon, authenticated;

-- de hora em hora: processa o lote pronto ou envia um novo (a função só envia 1 lote a cada 20h)
select cron.unschedule('banco-sugestoes') where exists (select 1 from cron.job where jobname = 'banco-sugestoes');
select cron.schedule('banco-sugestoes', '41 * * * *', $$ select net.http_post(
  url := 'https://qbfmozumntequvecttfs.supabase.co/functions/v1/banco-sugestoes',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
); $$);

-- limpeza: lotes com mais de 60 dias
select cron.unschedule('limpar-lotes-ia') where exists (select 1 from cron.job where jobname = 'limpar-lotes-ia');
select cron.schedule('limpar-lotes-ia', '33 6 * * *', $$delete from public.lotes_ia where created_at < now() - interval '60 days'$$);
