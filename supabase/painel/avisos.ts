// avisos — e-mails automáticos da Vitrine (boas-vindas, teste grátis acabou, post publicado, falha ao publicar).
// O banco chama esta função (avisar_n8n → pg_net) com { evento, corretor_id, extra }.
//  - Com BREVO_API_KEY + AVISOS_REMETENTE configurados: envia direto pelo Brevo (grátis até 300 e-mails/dia),
//    sem depender do n8n.
//  - Sem essas chaves: repassa pro fluxo do n8n, como antes.
// Segurança (a função não exige login porque quem chama é o banco): ela NÃO aceita e-mail nem texto de fora —
// busca o destinatário no banco, só manda se o evento for verdadeiro (ex.: o teste acabou mesmo) e nunca manda
// o mesmo aviso duas vezes (tabela avisos_enviados).
// Configuração no painel: "Verify JWT" DESLIGADO.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const BREVO = Deno.env.get("BREVO_API_KEY");
const REMETENTE = Deno.env.get("AVISOS_REMETENTE");               // e-mail verificado no Brevo
const ADMIN_EMAIL = Deno.env.get("AVISOS_ADMIN_EMAIL") ?? "evandrotorresrj@gmail.com";
const N8N = "https://vitrinecorretores.app.n8n.cloud/webhook/vitrine-570f8da3-d6fa-4cd6-b690-2420cfa19e0e";
const SITE = "https://vitrinecorretores.github.io/";

function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const caixa = (html: string) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a2e">${html}</div>`;

type Email = { para: string; nome?: string; assunto: string; html: string };

function montar(evento: string, nome: string, email: string, extra: Record<string, unknown>): Email | null {
  const n = esc(nome || "corretor");
  if (evento === "novo_corretor") return { para: email, nome, assunto: `Bem-vindo à Vitrine, ${nome || "corretor"}! Seu 1º carrossel em 2 minutos`, html: caixa(
    `<p>Olá, ${n}!</p><p>Que bom ter você na <b>Vitrine</b>. Seu primeiro carrossel sai em 2 minutos:</p><ol><li>Entre em <a href="${SITE}">vitrinecorretores.github.io</a>;</li><li>Na caixa <b>“Sobre o que você quer postar hoje?”</b>, escreva sua ideia (ou escolha uma sugestão);</li><li>Confira a prévia, escolha fonte e cor, e toque em <b>📲 Postar no Instagram</b> ou <b>📅 Agendar</b>.</li></ol><p>Seu teste grátis inclui 3 carrosséis. Qualquer dúvida, é só responder este e-mail.</p><p>Bons posts!<br>Equipe Vitrine</p>`) };
  if (evento === "teste_esgotado") return { para: email, nome, assunto: "Seus 3 carrosséis grátis acabaram — continue postando", html: caixa(
    `<p>Olá, ${n}!</p><p>Você já usou os <b>3 carrosséis do teste grátis</b> da Vitrine. 👏</p><p>Pra continuar criando carrosséis e agendando posts no Instagram, escolha um plano na aba <b>Plano</b>: <a href="${SITE}">vitrinecorretores.github.io</a></p><p>Ficou com alguma dúvida? Responda este e-mail.</p><p>Equipe Vitrine</p>`) };
  if (evento === "publicado") return { para: ADMIN_EMAIL, assunto: `✅ Post publicado — ${extra.titulo ?? ""}`, html: caixa(
    `<p>Um carrossel acabou de ser publicado no Instagram.</p><p><b>Corretor:</b> ${n} (${esc(email)})<br><b>Carrossel:</b> ${esc(extra.titulo)}<br><b>Link:</b> ${esc(extra.permalink || "—")}</p>`) };
  if (evento === "erro_publicacao") return { para: ADMIN_EMAIL, assunto: `⚠️ Falha ao publicar — ${extra.titulo ?? ""}`, html: caixa(
    `<p>Um carrossel agendado <b>não foi publicado</b>.</p><p><b>Corretor:</b> ${n} (${esc(email)})<br><b>Carrossel:</b> ${esc(extra.titulo)}<br><b>Erro:</b> ${esc(extra.erro)}</p><p>Abra o painel Admin da Vitrine para ver a conta.</p>`) };
  return null;
}

// confere no banco se o evento aconteceu mesmo (ninguém de fora consegue disparar e-mail à toa)
async function verdadeiro(db: SupabaseClient, evento: string, uid: string, carrosselId: string | null): Promise<boolean> {
  if (evento === "novo_corretor") {
    const { data } = await db.from("profiles").select("created_at").eq("id", uid).maybeSingle();
    return !!data && Date.now() - new Date(data.created_at).getTime() < 86_400_000;
  }
  if (evento === "teste_esgotado") {
    const { data } = await db.from("profiles").select("trial_usado, trial_limite").eq("id", uid).maybeSingle();
    return !!data && (data.trial_usado ?? 0) >= (data.trial_limite ?? 3);
  }
  if (!carrosselId) return false;
  const { data } = await db.from("carrosseis").select("status, erro_publicacao").eq("id", carrosselId).eq("corretor_id", uid).maybeSingle();
  if (!data) return false;
  return evento === "publicado" ? data.status === "publicado" : !!data.erro_publicacao;
}

Deno.serve(async (req) => {
  try {
    const { evento, corretor_id, extra = {} } = await req.json().catch(() => ({}));
    if (!["novo_corretor", "teste_esgotado", "publicado", "erro_publicacao"].includes(evento) || typeof corretor_id !== "string") return json({ ok: false }, 400);
    const db = admin();
    const carrosselId = typeof extra.carrossel_id === "string" ? extra.carrossel_id : null;
    if (!(await verdadeiro(db, evento, corretor_id, carrosselId))) return json({ ok: false, motivo: "evento não confere" });

    // 1 aviso por evento (por carrossel, nos de publicação)
    const chave = `${evento}:${corretor_id}:${carrosselId ?? ""}:${evento === "erro_publicacao" ? String(extra.erro ?? "").slice(0, 60) : ""}`;
    const { error: dup } = await db.from("avisos_enviados").insert({ chave, evento, corretor_id });
    if (dup) return json({ ok: true, repetido: true });

    const { data: u } = await db.auth.admin.getUserById(corretor_id);
    const { data: p } = await db.from("profiles").select("nome").eq("id", corretor_id).maybeSingle();
    const email = u?.user?.email ?? "";
    const nome = p?.nome ?? "";
    const titulo = String(extra.titulo ?? "").slice(0, 140), permalink = String(extra.permalink ?? ""), erro = String(extra.erro ?? "").slice(0, 300);

    if (BREVO && REMETENTE) {
      const msg = montar(evento, nome, email, { titulo, permalink, erro });
      if (!msg || !msg.para) return json({ ok: false, motivo: "sem destinatário" });
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: "Vitrine", email: REMETENTE }, replyTo: { email: REMETENTE }, to: [{ email: msg.para, name: msg.nome || undefined }], subject: msg.assunto, htmlContent: msg.html }),
      });
      if (!r.ok) { console.error("brevo", r.status, (await r.text()).slice(0, 300)); await db.from("avisos_enviados").delete().eq("chave", chave); return json({ ok: false }, 502); }
      return json({ ok: true, via: "brevo" });
    }
    // sem Brevo: repassa pro n8n no formato antigo
    const r = await fetch(N8N, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ evento, email, nome, titulo, permalink, erro }) });
    return json({ ok: r.ok, via: "n8n" });
  } catch (e) {
    console.error("avisos:", e);
    return json({ error: "Erro interno." }, 500);
  }
});
