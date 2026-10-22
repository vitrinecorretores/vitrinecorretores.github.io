# Agente de Marketing — @vitrinecorretores

Cria, desenha e agenda sozinho os carrosséis do Instagram da Vitrine. Depois o `publicar-agendados`,
que já existe, publica no horário marcado. Roda no GitHub Actions (grátis). O único custo são os
tokens da API da Anthropic: cerca de 3 chamadas por post, centavos por dia.

## Como funciona (todo dia às 05:17 de Fortaleza)

1. **Aprende**: lê as métricas dos posts publicados (`ig_metricas_posts`) e dá uma nota a cada um.
   Salvamentos e compartilhamentos pesam mais. Com isso, escolhe o que testar hoje: pilar de conteúdo,
   fórmula do gancho, estilo viral, cor, fonte e horário. Repete o que funciona e continua testando
   o que tem pouca amostra (UCB1).
2. **Estrategista** (Claude): define o tema a partir do que performou, sem repetir capas recentes.
   Se houver um rascunho bom no estoque, pode usar esse rascunho.
3. **Redator**: usa a própria IA da Vitrine (`gerar-conteudo`), com as regras virais e os 3 ganchos de capa.
4. **Editor-chefe** (Claude): escolhe a capa mais forte, corrige o que quebrar as regras e escreve a
   legenda com o CTA da palavra-gatilho.
5. **Fotos reais**: vêm do `buscar-imagens`, a mesma busca do painel.
6. **Arte**: é desenhada com o código do `app.js`, baixado do site na hora. Fica idêntica ao painel
   e acompanha qualquer melhoria visual da plataforma.
7. **Agendamento**: sobe as imagens e agenda o post. O `publicar-agendados` publica.
8. **Aviso no WhatsApp**: quando o post sai, o Evandro recebe a capa, o link e o que estava sendo
   testado. Isso vem do trigger `whatsapp_post_vitrine`, via CallMeBot.

## Configuração (uma vez)

1. Em **Settings → Secrets and variables → Actions → New repository secret**, crie:
   - `SUPABASE_SERVICE_ROLE_KEY`: no Supabase, Project Settings → API → `service_role`.
   - `ANTHROPIC_API_KEY`: a mesma chave que a Vitrine usa.
2. Opcional: em **Variables**, `POSTS_POR_DIA` com 1, 2 ou 3. O padrão é 1.
3. Rode o SQL `supabase/migrations/20261022_agente_marketing.sql`.
4. WhatsApp (CallMeBot, grátis):
   1. Mande a mensagem de ativação para o número do CallMeBot (veja em callmebot.com → WhatsApp)
      e receba a apikey.
   2. No SQL Editor do Supabase, rode:
      `insert into agente_config (chave, valor) values ('callmebot_apikey','SUA_APIKEY') on conflict (chave) do update set valor = excluded.valor;`

## Testar sem publicar

Em **Actions → Agente de Marketing → Run workflow**, deixe o modo **simular** e clique em Run.
Quando terminar, baixe as imagens e o plano em **Artifacts → simulacao**. Nada é gravado no banco.

## Desligar

Em **Actions → Agente de Marketing → ⋯ → Disable workflow**.
