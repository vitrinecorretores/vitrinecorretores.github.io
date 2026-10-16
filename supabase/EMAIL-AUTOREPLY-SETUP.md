# Vitrine · autoresposta de e-mail

## O que este fluxo faz

Quando um e-mail chega em `vitrinecorretor@gmail.com`, o `n8n`:

1. captura remetente, assunto e corpo;
2. chama a Edge Function `email-autoreply`;
3. recebe uma resposta pronta, baseada apenas nas informacoes oficiais da Vitrine;
4. envia a resposta automatica para quem escreveu;
5. envia um segundo e-mail de confirmacao para o dono responsavel, com:
   - para quem a resposta foi enviada;
   - o que foi respondido;
   - categoria e confianca da resposta.

## Backend novo no repositório

- Edge Function: `supabase/functions/email-autoreply/index.ts`
- Migration de log: `supabase/migrations/20261016_email_autoreply.sql`

## Secrets novos no Supabase

Cadastre em **Supabase -> Edge Functions -> Secrets**:

- `EMAIL_AUTOREPLY_WEBHOOK_SECRET`
  - um texto secreto qualquer so para o `n8n` conseguir chamar a funcao
- `SUPORTE_OWNER_EMAIL`
  - e-mail que recebe o resumo da resposta quando nao houver dono de equipe resolvido automaticamente

## Deploy

1. Rode a migration `20261016_email_autoreply.sql`
2. Publique a funcao `email-autoreply`
3. Configure os secrets acima
4. Abra a funcao `email-autoreply` no painel e desligue **Enforce JWT**

URL da funcao:

```txt
https://qbfmozumntequvecttfs.supabase.co/functions/v1/email-autoreply
```

## Payload que o n8n deve enviar

```json
{
  "from_email": "cliente@exemplo.com",
  "from_name": "Cliente Exemplo",
  "subject": "Como funciona o plano anual?",
  "body_text": "Queria entender se o anual tem desconto e como cancela.",
  "message_id": "<abc123@gmail.com>",
  "thread_id": "189273981273"
}
```

Header obrigatorio:

```txt
x-email-webhook-secret: SEU_SECRET
```

## Resposta da Edge Function

Ela devolve:

- `should_reply`
- `reply_to`
- `reply_subject`
- `reply_text`
- `reply_html`
- `owner_email`
- `owner_subject`
- `owner_text`
- `owner_html`
- `category`
- `confidence`
- `sources`

## Fluxo recomendado no n8n

### 1. Gmail Trigger

- Conta: `vitrinecorretor@gmail.com`
- Pasta: `INBOX`
- Preferencia: ignorar rascunhos/enviados

### 2. Set / Code

Monte um objeto com:

- `from_email`
- `from_name`
- `subject`
- `body_text`
- `message_id`
- `thread_id`

### 3. HTTP Request

- Metodo: `POST`
- URL: `https://qbfmozumntequvecttfs.supabase.co/functions/v1/email-autoreply`
- Header: `x-email-webhook-secret`
- Body JSON: o payload acima

### 4. If

Condição:

- `{{$json["should_reply"]}}` igual a `true`

### 5. Gmail Send

Enviar para o cliente:

- `To`: `{{$json["reply_to"]}}`
- `Subject`: `{{$json["reply_subject"]}}`
- `HTML`: `{{$json["reply_html"]}}`

### 6. Gmail Send

Enviar resumo ao dono:

- `To`: `{{$json["owner_email"]}}`
- `Subject`: `{{$json["owner_subject"]}}`
- `HTML`: `{{$json["owner_html"]}}`

## Regras do resolvedor

A funcao responde automaticamente com base no que ja existe no site e nas paginas legais:

- planos e valores
- plano anual
- teste gratis
- cancelamento e reembolso
- privacidade e exclusao de dados
- Instagram
- fotos e licencas
- planos de imobiliaria
- funcionamento geral da plataforma

Se nao encontrar um encaixe forte, responde com os links oficiais principais e indica continuidade por este mesmo e-mail.

## Log interno

Toda resposta fica gravada em `public.email_auto_respostas`, incluindo:

- remetente
- assunto
- categoria
- confianca
- resposta gerada
- owner avisado
- fontes usadas
