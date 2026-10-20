// instagram-metricas — fotografa 1x por dia as métricas do Instagram de cada conta conectada na Vitrine
// (seguidores, alcance, visitas ao perfil, cliques no link e o desempenho de cada post: curtidas, comentários,
// salvamentos, compartilhamentos, alcance). Serve pra acompanhar o crescimento orgânico e decidir o que postar.
//
// Roda sozinha (pg_cron + pg_net, ver migração 20261014_metricas_instagram.sql) 1x por dia.
// Trava: não roda de novo antes de 6h (tabela lotes_ia), então chamá-la à toa não gasta cota da API.
// Os números de alcance/salvamentos exigem a permissão instagram_business_manage_insights (conta reconectada
// depois da mudança de 14/10/2026); sem ela, grava só o que a permissão básica dá (seguidores, curtidas, comentários).
// Configuração no painel: "Verify JWT" DESLIGADO (o pg_net chama sem login).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const GRAPH = "https://graph.instagram.com/v21.0";
const HORAS_ENTRE_RODADAS = 6;

function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
// deno-lint-ignore no-explicit-any
async function get(path: string, params: Record<string, string>): Promise<any> {
  const u = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error?.message ?? `HTTP ${r.status}`);
  return d;
}
// soma o total de uma métrica de insights (formato total_value ou values[])
// deno-lint-ignore no-explicit-any
function valor(d: any, nome: string): number | null {
  // deno-lint-ignore no-explicit-any
  const m = (d?.data ?? []).find((x: any) => x.name === nome);
  if (!m) return null;
  if (m.total_value?.value != null) return Number(m.total_value.value);
  // deno-lint-ignore no-explicit-any
  if (Array.isArray(m.values)) return m.values.reduce((s: number, v: any) => s + Number(v.value ?? 0), 0);
  return null;
}

// deno-lint-ignore no-explicit-any
async function coletar(db: SupabaseClient, conta: any, token: string) {
  const ig = conta.instagram_business_id as string;
  const uid = conta.corretor_id as string;
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Fortaleza" });
  const erros: string[] = [];

  const perfil = await get(ig, { fields: "followers_count,follows_count,media_count", access_token: token });
  const linhaConta: Record<string, unknown> = {
    corretor_id: uid, conta_id: conta.id, dia: hoje, seguidores: perfil.followers_count ?? null, seguindo: perfil.follows_count ?? null, posts: perfil.media_count ?? null,
  };
  // insights da conta (último dia): só com a permissão de insights
  try {
    const d = await get(`${ig}/insights`, { metric: "reach,profile_views,website_clicks,accounts_engaged,total_interactions", period: "day", metric_type: "total_value", access_token: token });
    linhaConta.alcance = valor(d, "reach");
    linhaConta.visitas_perfil = valor(d, "profile_views");
    linhaConta.cliques_link = valor(d, "website_clicks");
    linhaConta.contas_engajadas = valor(d, "accounts_engaged");
    linhaConta.interacoes = valor(d, "total_interactions");
  } catch (e) { erros.push("conta: " + (e as Error).message.slice(0, 120)); }
  await db.from("ig_metricas_conta").upsert(linhaConta, { onConflict: "conta_id,dia" });

  // posts: os 50 mais recentes
  const media = await get(`${ig}/media`, { fields: "id,caption,media_type,timestamp,permalink,like_count,comments_count", limit: "50", access_token: token });
  const ids = (media.data ?? []).map((m: { id: string }) => m.id);
  const { data: carros } = ids.length
    ? await db.from("carrosseis").select("id, instagram_media_id").in("instagram_media_id", ids)
    : { data: [] };
  const carroPorMidia = new Map((carros ?? []).map((c: { id: string; instagram_media_id: string }) => [c.instagram_media_id, c.id]));
  let semInsights = false;
  for (const m of media.data ?? []) {
    const linha: Record<string, unknown> = {
      media_id: m.id, corretor_id: uid, carrossel_id: carroPorMidia.get(m.id) ?? null, publicado_em: m.timestamp, tipo: m.media_type,
      legenda_inicio: String(m.caption ?? "").slice(0, 140), permalink: m.permalink,
      curtidas: m.like_count ?? null, comentarios: m.comments_count ?? null, atualizado_em: new Date().toISOString(),
    };
    if (!semInsights) {
      try {
        const d = await get(`${m.id}/insights`, { metric: "reach,saved,shares,total_interactions,views", access_token: token });
        linha.alcance = valor(d, "reach"); linha.salvamentos = valor(d, "saved"); linha.compartilhamentos = valor(d, "shares");
        linha.interacoes = valor(d, "total_interactions"); linha.visualizacoes = valor(d, "views");
      } catch (e) {
        const msg = (e as Error).message;
        // sem permissão de insights: não adianta tentar nos outros posts
        if (/permission|scope|authoriz/i.test(msg)) semInsights = true;
        erros.push("post: " + msg.slice(0, 120));
      }
    }
    await db.from("ig_metricas_posts").upsert(linha, { onConflict: "media_id" });
  }
  return { conta: perfil, posts: ids.length, sem_insights: semInsights, erros: [...new Set(erros)].slice(0, 3) };
}

Deno.serve(async () => {
  try {
    const db = admin();
    const { data: ultimo } = await db.from("lotes_ia").select("created_at").eq("tipo", "metricas_ig")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < HORAS_ENTRE_RODADAS * 3600_000) return json({ acao: "nada_a_fazer" });

    const { data: contas } = await db.from("instagram_contas").select("id, corretor_id, instagram_business_id, username").eq("status", "ativo");
    const resultado: Record<string, unknown> = {};
    for (const conta of contas ?? []) {
      const { data: tok } = await db.from("instagram_tokens").select("access_token").eq("conta_id", conta.id).maybeSingle();
      if (!tok?.access_token) continue;
      try { resultado[conta.username] = await coletar(db, conta, tok.access_token); }
      catch (e) { resultado[conta.username] = { erro: (e as Error).message.slice(0, 200) }; }
    }
    await db.from("lotes_ia").insert({ tipo: "metricas_ig", status: "processado", processado_em: new Date().toISOString(),
      detalhe: JSON.stringify(resultado).slice(0, 900) });
    return json({ acao: "coletado", resultado });
  } catch (e) {
    console.error("instagram-metricas:", e);
    return json({ error: "Erro interno." }, 500);
  }
});
