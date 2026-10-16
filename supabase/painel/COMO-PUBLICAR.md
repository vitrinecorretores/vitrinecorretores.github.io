# Publicar as funções pelo painel do Supabase (sem terminal)

## A. Sete funções novas
Para cada arquivo desta pasta:
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**
2. Nome da função = nome do arquivo sem `.ts` (ex.: `stripe-checkout`)
3. Apague o código de exemplo, cole o conteúdo inteiro do arquivo e clique **Deploy function**

Para a função `email-autoreply`, use o arquivo:

- `supabase/functions/email-autoreply/index.ts`

Depois, nestas 3 abra a função → **Details** → desligue **"Verify JWT with legacy secret"** (Enforce JWT) → Save:
- `stripe-webhook`
- `instagram-oauth-callback`
- `instagram-webhook`
- `email-autoreply`

## B. Corrigir a `gerenciar-assinatura` (falha de segurança)
Edge Functions → `gerenciar-assinatura` → **Code**. Logo ANTES da linha `if (acao === "cancelar") {` cole:

```ts
    // Fase 3: assinar/cancelar agora só pelo Stripe
    if (acao === "assinar" || acao === "cancelar") {
      return json({ error: "Use o checkout do Stripe para assinar ou cancelar." }, 410);
    }

```
Clique **Deploy updates**.

## C. Secrets (Edge Functions → Secrets → Add new secret)
| Nome | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Desenvolvedores → Chaves de API → chave secreta `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Workbench → Webhooks → vitrine-supabase → Segredo da assinatura `whsec_...` (ícone do olho) |
| `META_APP_ID` | `1021574807186068` |
| `META_APP_SECRET` | Meta → Casos de uso → API do Instagram → Configuração com login do Instagram → "Chave secreta do app do Instagram" → Mostrar |
| `META_WEBHOOK_VERIFY_TOKEN` | qualquer texto que você inventar (ex.: `vitrine-2026`) |
| `APP_URL` | `https://evandrotorresrj-prog.github.io/vitrine/` |
| `EMAIL_AUTOREPLY_WEBHOOK_SECRET` | texto secreto usado pelo n8n para chamar a função `email-autoreply` |
| `SUPORTE_OWNER_EMAIL` | e-mail que recebe o resumo da resposta quando não houver dono de equipe identificado |

## D. Autoresposta de e-mail

1. Rode a migration `supabase/migrations/20261016_email_autoreply.sql`
2. Publique a função `email-autoreply`
3. Configure o fluxo do n8n descrito em `supabase/EMAIL-AUTOREPLY-SETUP.md`
