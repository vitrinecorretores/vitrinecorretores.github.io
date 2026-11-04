// POST { plano_id, periodo: "mensal" | "anual" } → { url }
// Cria uma Checkout Session (assinatura recorrente em BRL) e devolve a URL hospedada do Stripe.
// O preço vem da tabela `planos` no servidor — o cliente nunca manda valor.
import Stripe from "npm:stripe@17";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---- utilitários (copiados de _shared/util.ts) ----
const APP_URL = Deno.env.get("APP_URL") ?? "https://evandrotorresrj-prog.github.io/vitrine/";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

/** Cliente com service role (ignora RLS) — só usar no servidor. */
function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Valida o JWT do usuário logado e devolve o id dele. */
async function requireUser(req: Request): Promise<string> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Não autenticado.");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sessão inválida.");
  return data.user.id;
}

class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try { return await fn(req); }
    catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      console.error(e);
      return json({ error: (e as Error).message ?? "Erro interno." }, status);
    }
  };
}
// ---- fim dos utilitários ----


const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

// ---- promoções ----
// Black Friday 2026 (horário de Fortaleza): de 04/11 até 30/11 23:59, para todos os planos pagos.
// Preço cerca de 69% menor (Vitrine R$ 97 → R$ 29,90), travado por 12 meses: no mensal, desconto
// nas 12 primeiras cobranças; no anual, desconto na 1ª cobrança (o 1º ano). Depois volta ao preço cheio.
// Limitada às primeiras BF_VAGAS assinaturas pagas (contadas em assinaturas.promo, gravado pelo webhook).
// Fora da Black Friday vale a oferta fixa: 30% no 1º mês do mensal, só na primeira assinatura.
// O app usa as mesmas datas e preços pra mostrar banner e preço riscado (app.js, BLACK_FRIDAY).
const BF_INICIO = Date.parse("2026-11-04T00:00:00-03:00");
const BF_FIM = Date.parse("2026-12-01T00:00:00-03:00");
const BF_VAGAS = 50;
const BF_PREFIXO = "BF26";
// preço promocional por plano (slug) — mensal / anual
const BF_PRECOS: Record<string, { mensal: number; anual: number }> = {
  "pro": { mensal: 29.90, anual: 299 },
  "starter": { mensal: 29.90, anual: 299 },
  "imob-5": { mensal: 137.90, anual: 1379 },
  "imob-10": { mensal: 245.90, anual: 2459 },
  "imob-30": { mensal: 615.90, anual: 6159 },
};

type Cupom = { id: string; name: string; duration: "once" | "repeating"; duration_in_months?: number; percent_off?: number; amount_off?: number; currency?: string };

function cupomBlackFriday(slug: string, periodo: string, valorCheio: number): Cupom | null {
  const bf = BF_PRECOS[slug];
  if (!bf) return null;
  const promo = periodo === "anual" ? bf.anual : bf.mensal;
  const off = Math.round((valorCheio - promo) * 100);
  if (off <= 0) return null;
  const precoTxt = promo.toFixed(2).replace(".", ",");
  return periodo === "anual"
    ? { id: `${BF_PREFIXO}_${slug}_anual_${off}`, amount_off: off, currency: "brl", duration: "once",
        name: `Black Friday: R$ ${precoTxt} no 1º ano` }
    : { id: `${BF_PREFIXO}_${slug}_mensal_${off}`, amount_off: off, currency: "brl", duration: "repeating", duration_in_months: 12,
        name: `Black Friday: R$ ${precoTxt}/mês por 12 meses` };
}

function naBlackFriday(agora: number) { return agora >= BF_INICIO && agora < BF_FIM; }

Deno.serve(handle(async (req) => {
  const uid = await requireUser(req);
  const body = await req.json().catch(() => ({}));

  const db = admin();

  // GET de status da promoção (o app usa pra mostrar as vagas restantes)
  if (body?.acao === "status_promo") {
    const { count } = await db.from("assinaturas").select("corretor_id", { count: "exact", head: true })
      .like("promo", `${BF_PREFIXO}%`);
    const usadas = count ?? 0;
    return json({ ativa: naBlackFriday(Date.now()) && usadas < BF_VAGAS, vagas_restantes: Math.max(0, BF_VAGAS - usadas), fim: new Date(BF_FIM).toISOString() });
  }

  const { plano_id, periodo } = body;
  if (!["mensal", "anual"].includes(periodo)) throw new HttpError(400, "Período inválido.");

  const { data: plano } = await db.from("planos").select("*").eq("id", plano_id).single();
  if (!plano) throw new HttpError(404, "Plano não encontrado.");
  const { data: perfil } = await db.from("profiles").select("id, email, nome, stripe_customer_id, created_at").eq("id", uid).single();
  if (!perfil) throw new HttpError(404, "Perfil não encontrado.");

  // já tem assinatura paga ativa? não deixa duplicar
  const { data: ativa } = await db.from("assinaturas").select("id")
    .eq("corretor_id", uid).eq("status", "ativa").not("stripe_subscription_id", "is", null).maybeSingle();
  if (ativa) throw new HttpError(409, "Você já tem uma assinatura ativa. Cancele antes de trocar de plano.");
  const { data: daEquipe } = await db.from("assinaturas").select("id")
    .eq("corretor_id", uid).eq("status", "ativa").not("equipe_id", "is", null).maybeSingle();
  if (daEquipe) throw new HttpError(409, "Você já tem acesso pela equipe da sua imobiliária. Para assinar sozinho, saia da equipe primeiro (aba Equipe).");

  let customer = perfil.stripe_customer_id as string | null;
  if (!customer) {
    const c = await stripe.customers.create({ email: perfil.email, name: perfil.nome ?? undefined, metadata: { corretor_id: uid } });
    customer = c.id;
    await db.from("profiles").update({ stripe_customer_id: customer }).eq("id", uid);
  }

  const valor = Number(periodo === "anual" ? plano.preco_anual : plano.preco_mensal);
  const meta: Record<string, string> = { corretor_id: uid, plano_id: String(plano.id), periodo };

  const { count: assinaturasAntes } = await db.from("assinaturas").select("id", { count: "exact", head: true })
    .eq("corretor_id", uid).not("stripe_subscription_id", "is", null);

  let promo: Cupom | null = null;
  if (naBlackFriday(Date.now())) {
    const { count: usadas } = await db.from("assinaturas").select("corretor_id", { count: "exact", head: true })
      .like("promo", `${BF_PREFIXO}%`);
    if ((usadas ?? 0) < BF_VAGAS) promo = cupomBlackFriday(String(plano.slug ?? ""), periodo, valor);
    // vagas esgotadas: segue sem desconto (a oferta de 30% fica pausada durante a Black Friday)
  } else if (periodo === "mensal" && (assinaturasAntes ?? 0) === 0) {
    promo = { id: "LANCAMENTO30", percent_off: 30, duration: "once", name: "Lançamento 30% off no 1º mês" };
  }

  let discounts: { coupon: string }[] | undefined;
  if (promo) {
    try { await stripe.coupons.retrieve(promo.id); }
    catch { await stripe.coupons.create(promo); }
    discounts = [{ coupon: promo.id }];
    meta.promo = promo.id;   // gravado em assinaturas.promo pelo webhook (conta as vagas)
  }

  const session = await stripe.checkout.sessions.create({
    ...(discounts ? { discounts } : {}),
    mode: "subscription",
    customer,
    locale: "pt-BR",
    payment_method_types: ["card"],          // assinatura recorrente no BR: cartão
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "brl",
        unit_amount: Math.round(valor * 100),
        recurring: { interval: periodo === "anual" ? "year" : "month" },
        product_data: { name: `Vitrine ${plano.nome} (${periodo})` },
      },
    }],
    metadata: meta,
    subscription_data: { metadata: meta },
    client_reference_id: uid,
    success_url: `${APP_URL}?checkout=sucesso&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}?checkout=cancelado`,
  });

  return json({ url: session.url });
}));
