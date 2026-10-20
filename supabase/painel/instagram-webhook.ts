// Webhook da Meta (comentários). Deploy com --no-verify-jwt.
// GET  = verificação do endpoint (hub.challenge) usando META_WEBHOOK_VERIFY_TOKEN (você inventa esse texto).
// POST = eventos; valida X-Hub-Signature-256 com META_APP_SECRET e grava em instagram_webhooks.
// Comentário vira lead: se o comentário tem a palavra-gatilho da regra da conta (tabela ig_comentario_regras),
// grava o lead (leads_instagram) e, com a regra ATIVA, manda Private Reply com o link do WhatsApp do corretor
// e (opcional) uma resposta pública. Só funciona depois que o dono habilitar as permissões de comentários e
// mensagens no app da Meta (instagram_business_manage_comments / instagram_business_manage_messages).
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


const SECRET = Deno.env.get("META_APP_SECRET")!;
const VERIFY = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN")!;

async function assinaturaValida(body: string, header: string | null) {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const recebido = header.slice(7);
  if (hex.length !== recebido.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diff === 0;
}

const GRAPH = "https://graph.instagram.com/v21.0";

/** minúsculas e sem acento, pra comparar a palavra-gatilho */
function normalizar(t: string): string {
  return (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** link wa.me/55<telefone do perfil>; vazio se o corretor não tem telefone */
function linkWhatsapp(tel: string | null | undefined): string {
  let d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 10) return "";
  if (!d.startsWith("55") || d.length < 12) d = "55" + d;
  return `https://wa.me/${d}`;
}

async function processarComentario(db: SupabaseClient, igId: string, c: any) {
  const commentId = String(c?.id ?? "");
  const texto = String(c?.text ?? "");
  const autorId = String(c?.from?.id ?? "");
  const username = String(c?.from?.username ?? "");
  const mediaId = String(c?.media?.id ?? "");
  if (!commentId || !texto) return;
  if (autorId && autorId === igId) return;                       // comentário da própria conta

  const { data: conta } = await db.from("instagram_contas").select("id, corretor_id, username")
    .eq("instagram_business_id", igId).eq("status", "ativo").maybeSingle();
  if (!conta) return;
  if (username && conta.username && username.toLowerCase() === String(conta.username).toLowerCase()) return;

  const { data: regra } = await db.from("ig_comentario_regras").select("*").eq("conta_id", conta.id).maybeSingle();
  if (!regra || !regra.palavra_gatilho) return;
  if (!normalizar(texto).includes(normalizar(regra.palavra_gatilho))) return;

  // trava: o comment_id é chave primária — se já existe, alguém já tratou esse comentário
  const { error: dup } = await db.from("ig_comentarios_log").insert({ comment_id: commentId, conta_id: conta.id, corretor_id: conta.corretor_id, status: "recebido" });
  if (dup) return;

  let carrosselId: string | null = null;
  if (mediaId) {
    const { data: car } = await db.from("carrosseis").select("id").eq("corretor_id", conta.corretor_id).eq("instagram_media_id", mediaId).maybeSingle();
    carrosselId = car?.id ?? null;
  }
  await db.from("leads_instagram").insert({
    corretor_id: conta.corretor_id, conta_id: conta.id, username: username || null,
    comentario: texto.slice(0, 500), media_id: mediaId || null, carrossel_id: carrosselId,
  });

  if (!regra.ativa) { await db.from("ig_comentarios_log").update({ status: "sem_regra", detalhe: "regra desligada" }).eq("comment_id", commentId); return; }

  const { data: tok } = await db.from("instagram_tokens").select("access_token").eq("conta_id", conta.id).maybeSingle();
  const { data: perfil } = await db.from("profiles").select("telefone").eq("id", conta.corretor_id).maybeSingle();
  const wa = linkWhatsapp(perfil?.telefone);
  if (!tok?.access_token) { await db.from("ig_comentarios_log").update({ status: "erro", detalhe: "sem token" }).eq("comment_id", commentId); return; }

  const primeiro = (username || "").trim() || "tudo bem";
  const preencher = (m: string) => String(m ?? "").replace(/\{nome\}/gi, primeiro).replace(/\{whatsapp\}/gi, wa || "(me chame por aqui mesmo)");
  const mensagem = preencher(regra.mensagem_direct).slice(0, 900);
  let detalhe = "";
  let ok = false;
  try {
    const r = await fetch(`${GRAPH}/${igId}/messages?access_token=${encodeURIComponent(tok.access_token)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: mensagem } }),
    });
    ok = r.ok;
    if (!r.ok) detalhe = `direct HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`;
  } catch (e) { detalhe = `direct: ${(e as Error).message}`; }

  if (ok && regra.resposta_publica) {
    try {
      const r = await fetch(`${GRAPH}/${commentId}/replies?access_token=${encodeURIComponent(tok.access_token)}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: preencher(regra.resposta_publica).slice(0, 300) }),
      });
      if (!r.ok) detalhe = `resposta pública HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`;
    } catch (e) { detalhe = `resposta pública: ${(e as Error).message}`; }
  }
  await db.from("ig_comentarios_log").update({ status: ok ? "respondido" : "erro", detalhe: detalhe || null }).eq("comment_id", commentId);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === VERIFY)
      return new Response(url.searchParams.get("hub.challenge") ?? "");
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.text();
  if (!(await assinaturaValida(body, req.headers.get("x-hub-signature-256"))))
    return new Response("assinatura inválida", { status: 401 });
  const payload = JSON.parse(body);
  const db = admin();
  await db.from("instagram_webhooks").insert({ objeto: payload.object, payload });
  // comentários: um erro aqui nunca derruba a resposta (a Meta reenviaria o evento)
  try {
    for (const entry of payload.entry ?? []) {
      for (const ch of entry.changes ?? []) {
        if (ch.field === "comments" && ch.value) await processarComentario(db, String(entry.id), ch.value);
      }
    }
  } catch (e) { console.error("webhook comentários:", e); }
  return new Response("ok");
});
