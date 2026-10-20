// relatorio-semanal — e-mail de segunda-feira com o resumo da semana de cada corretor (Instagram).
// Chamada por pg_cron + pg_net (modelo em supabase/migrations/20261021_cron_relatorio_ATIVAR.sql — DESATIVADO até o dono ligar).
// Configuração: "Verify JWT" DESLIGADO. Secrets: BREVO_API_KEY, AVISOS_REMETENTE (os mesmos da função avisos).
// Segurança: não aceita destinatário nem texto de fora; busca tudo no banco. Trava em lotes_ia ('relatorio_semanal', >= 6 dias)
// e dedupe por corretor/semana em avisos_enviados (`relatorio:<uid>:<semana ISO>`).
// Quem não postou nos últimos 7 dias recebe só um lembrete curto, no máximo a cada 14 dias.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const BREVO = Deno.env.get("BREVO_API_KEY");
const REMETENTE = Deno.env.get("AVISOS_REMETENTE");
const SITE = "https://vitrinecorretores.github.io/";
const DIA = 86_400_000;
const MAX_CORRETORES = 300;

function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const caixa = (html: string) => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a2e">${html}</div>`;

/** semana ISO, ex.: 2026-W43 */
function semanaIso(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const n = Math.ceil(((t.getTime() - ini.getTime()) / DIA + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(n).padStart(2, "0")}`;
}

/** mesma conta do app: salvamentos + compartilhamentos*2 + comentários; sem isso, curtidas */
function pontos(p: any): number {
  const base = (p.salvamentos ?? 0) + (p.compartilhamentos ?? 0) * 2 + (p.comentarios ?? 0);
  return base > 0 ? base : (p.curtidas ?? 0);
}

async function enviar(para: string, nome: string, assunto: string, html: string): Promise<boolean> {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: "Vitrine", email: REMETENTE }, replyTo: { email: REMETENTE }, to: [{ email: para, name: nome || undefined }], subject: assunto, htmlContent: html }),
  });
  if (!r.ok) console.error("brevo", r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

function cartao(titulo: string, valor: string, sub = "") {
  return `<td style="padding:6px"><div style="background:#f4f6fb;border-radius:10px;padding:12px 14px;text-align:center"><div style="font-size:22px;font-weight:700">${valor}</div><div style="font-size:12px;color:#555">${titulo}</div>${sub ? `<div style="font-size:11px;color:#888">${sub}</div>` : ""}</div></td>`;
}

async function dadosDoCorretor(db: SupabaseClient, uid: string) {
  const agora = Date.now();
  const desde = new Date(agora - 7 * DIA).toISOString();
  const [{ data: posts }, { data: conta }, { count: leads }, { count: agendados }, { count: publicados }] = await Promise.all([
    db.from("ig_metricas_posts").select("*").eq("corretor_id", uid).gte("publicado_em", desde).limit(100),
    db.from("ig_metricas_conta").select("dia, seguidores").eq("corretor_id", uid).gte("dia", new Date(agora - 8 * DIA).toISOString().slice(0, 10)).order("dia", { ascending: true }),
    db.from("leads_instagram").select("id", { count: "exact", head: true }).eq("corretor_id", uid).gte("created_at", desde),
    db.from("carrosseis").select("id", { count: "exact", head: true }).eq("corretor_id", uid).eq("status", "agendado").gte("data_agendada", new Date(agora).toISOString()).lte("data_agendada", new Date(agora + 7 * DIA).toISOString()),
    db.from("carrosseis").select("id", { count: "exact", head: true }).eq("corretor_id", uid).eq("status", "publicado").gte("data_publicada", desde),
  ]);
  const top = (posts ?? []).slice().sort((a, b) => pontos(b) - pontos(a)).slice(0, 3);
  // seguidores: soma das contas por dia; compara o primeiro e o último dia da janela
  const porDia = new Map<string, number>();
  for (const r of conta ?? []) porDia.set(r.dia, (porDia.get(r.dia) ?? 0) + (r.seguidores ?? 0));
  const dias = [...porDia.keys()].sort();
  const seguidoresAgora = dias.length ? porDia.get(dias[dias.length - 1])! : null;
  const variacao = dias.length >= 2 ? porDia.get(dias[dias.length - 1])! - porDia.get(dias[0])! : null;
  return { top, nPosts: Math.max((posts ?? []).length, publicados ?? 0), seguidoresAgora, variacao, leads: leads ?? 0, agendados: agendados ?? 0 };
}

function emailRelatorio(nome: string, d: Awaited<ReturnType<typeof dadosDoCorretor>>, temas: { titulo: string; gancho: string }[]) {
  const n = esc(nome || "corretor");
  const v = d.variacao;
  const seg = d.seguidoresAgora == null ? "—" : String(d.seguidoresAgora);
  const varTxt = v == null ? "" : `${v >= 0 ? "+" : ""}${v} na semana`;
  const topo = d.top.length
    ? `<ol style="padding-left:20px">${d.top.map((p) => `<li>${p.permalink ? `<a href="${esc(p.permalink)}">` : ""}${esc((p.legenda_inicio || "Post").slice(0, 70))}${p.permalink ? "</a>" : ""} — ${p.curtidas ?? 0} curtidas, ${p.comentarios ?? 0} comentários, ${p.salvamentos ?? 0} salvamentos, ${p.compartilhamentos ?? 0} envios</li>`).join("")}</ol>`
    : `<p>Os números dos seus posts ainda estão chegando.</p>`;
  const sug = temas.length
    ? `<p><b>Ideias de tema para esta semana</b></p><ul style="padding-left:20px">${temas.map((t) => `<li><b>${esc(t.titulo)}</b>${t.gancho ? ` — ${esc(t.gancho)}` : ""}</li>`).join("")}</ul>` : "";
  return {
    assunto: `Seu resumo da semana na Vitrine: ${d.nPosts} post${d.nPosts === 1 ? "" : "s"}, ${d.leads} lead${d.leads === 1 ? "" : "s"}`,
    html: caixa(
      `<p>Olá, ${n}! Veja como foi sua semana no Instagram:</p>` +
      `<table role="presentation" width="100%" style="border-collapse:collapse"><tr>${cartao("posts", String(d.nPosts))}${cartao("seguidores", seg, varTxt)}${cartao("leads dos comentários", String(d.leads))}${cartao("agendados na próxima semana", String(d.agendados))}</tr></table>` +
      `<p><b>Seus 3 posts que mais engajaram</b></p>${topo}${sug}` +
      `<p><a href="${SITE}" style="display:inline-block;background:#d4ff3f;color:#0a0a0a;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">Criar o carrossel da semana</a></p><p>Equipe Vitrine</p>`),
  };
}

function emailLembrete(nome: string, temas: { titulo: string }[]) {
  const ideia = temas[0] ? `<p>Uma ideia: <b>${esc(temas[0].titulo)}</b>.</p>` : "";
  return {
    assunto: "Faz uma semana que você não posta — vamos de carrossel?",
    html: caixa(`<p>Olá, ${esc(nome || "corretor")}! Percebi que você não publicou nos últimos 7 dias. Quem posta toda semana cresce mais rápido.</p>${ideia}<p><a href="${SITE}">Criar um carrossel em 2 minutos</a></p><p>Equipe Vitrine</p>`),
  };
}

Deno.serve(async (_req) => {
  try {
    if (!BREVO || !REMETENTE) return json({ ok: false, motivo: "BREVO_API_KEY/AVISOS_REMETENTE não configurados" });
    const db = admin();

    // trava: no máximo 1 rodada a cada 6 dias
    const { data: ult } = await db.from("lotes_ia").select("created_at").eq("tipo", "relatorio_semanal").neq("status", "erro")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (ult && Date.now() - new Date(ult.created_at).getTime() < 6 * DIA) return json({ ok: true, acao: "aguardando" });
    const { data: lote } = await db.from("lotes_ia").insert({ tipo: "relatorio_semanal", status: "enviado" }).select("id").single();

    // corretores ativos/trial que têm Instagram conectado
    const { data: ass } = await db.from("assinaturas").select("corretor_id").in("status", ["trial", "ativa"]);
    const { data: contas } = await db.from("instagram_contas").select("corretor_id").eq("status", "ativo");
    const comIg = new Set((contas ?? []).map((c) => c.corretor_id));
    const uids = [...new Set((ass ?? []).map((a) => a.corretor_id))].filter((u) => comIg.has(u)).slice(0, MAX_CORRETORES);

    const { data: topicos } = await db.from("topicos").select("titulo, gancho").eq("ativo", true).order("created_at", { ascending: false }).limit(60);
    const semana = semanaIso(new Date());
    let relatorios = 0, lembretes = 0, falhas = 0;

    for (const uid of uids) {
      try {
        const d = await dadosDoCorretor(db, uid);
        const { data: u } = await db.auth.admin.getUserById(uid);
        const email = u?.user?.email;
        if (!email) continue;
        const { data: p } = await db.from("profiles").select("nome").eq("id", uid).maybeSingle();
        // até 3 temas, escolhidos de forma diferente para cada corretor
        const base = [...(topicos ?? [])];
        const ini = base.length ? Math.abs([...uid].reduce((a, c) => a + c.charCodeAt(0), 0)) % base.length : 0;
        const temas = [0, 1, 2].map((i) => base[(ini + i) % (base.length || 1)]).filter(Boolean).slice(0, base.length >= 3 ? 3 : base.length);

        if (d.nPosts === 0) {
          // lembrete curto, no máximo a cada 14 dias
          const { data: rec } = await db.from("avisos_enviados").select("created_at").eq("corretor_id", uid).eq("evento", "relatorio_lembrete")
            .gte("created_at", new Date(Date.now() - 14 * DIA).toISOString()).limit(1);
          if (rec && rec.length) continue;
          const chave = `lembrete:${uid}:${semana}`;
          const { error: dup } = await db.from("avisos_enviados").insert({ chave, evento: "relatorio_lembrete", corretor_id: uid });
          if (dup) continue;
          const m = emailLembrete(p?.nome ?? "", temas);
          if (await enviar(email, p?.nome ?? "", m.assunto, m.html)) lembretes++;
          else { await db.from("avisos_enviados").delete().eq("chave", chave); falhas++; }
          continue;
        }

        const chave = `relatorio:${uid}:${semana}`;
        const { error: dup } = await db.from("avisos_enviados").insert({ chave, evento: "relatorio_semanal", corretor_id: uid });
        if (dup) continue;
        const m = emailRelatorio(p?.nome ?? "", d, temas);
        if (await enviar(email, p?.nome ?? "", m.assunto, m.html)) relatorios++;
        else { await db.from("avisos_enviados").delete().eq("chave", chave); falhas++; }
      } catch (e) { falhas++; console.error("relatorio-semanal corretor", uid, (e as Error).message); }
    }

    if (lote) await db.from("lotes_ia").update({ status: "processado", processado_em: new Date().toISOString(), detalhe: `${relatorios} relatórios, ${lembretes} lembretes, ${falhas} falhas` }).eq("id", lote.id);
    return json({ ok: true, relatorios, lembretes, falhas });
  } catch (e) {
    console.error("relatorio-semanal:", e);
    return json({ error: "Erro interno." }, 500);
  }
});
