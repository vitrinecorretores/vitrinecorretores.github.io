// manutencao-diaria — mantém a plataforma funcionando sozinha, sem ninguém mexer (roda 1x por dia via pg_cron):
//  1) renova o acesso ao Instagram de cada conta conectada antes de vencer (o token dura 60 dias; antes ele só era
//     renovado quando um post saía, então uma conta parada por ~50 dias perdia a conexão);
//  2) apaga do Storage as imagens já usadas de carrosséis publicados há mais de 30 dias (o plano grátis do Supabase
//     tem 1 GB). Se o corretor quiser publicar de novo, o app gera as imagens outra vez.
// Trava: no máximo 1 rodada a cada 20h (tabela lotes_ia). Não recebe nada do chamador.
// Configuração no painel: "Verify JWT" DESLIGADO (o pg_net chama sem login).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const RENOVAR_COM_DIAS = 20;      // renova quando faltar menos que isso pra vencer
const LIMPAR_APOS_DIAS = 30;
const LIMPAR_POR_RODADA = 60;     // carrosséis por dia (evita estourar o tempo da função)
const BUCKET = "slides-render";

function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function renovarTokens(db: SupabaseClient) {
  const limite = new Date(Date.now() + RENOVAR_COM_DIAS * 86_400_000).toISOString();
  const { data: toks } = await db.from("instagram_tokens").select("corretor_id, access_token, expires_at").lt("expires_at", limite);
  let renovados = 0; const falhas: string[] = [];
  for (const t of toks ?? []) {
    const { data: conta } = await db.from("instagram_contas").select("username, status").eq("corretor_id", t.corretor_id).maybeSingle();
    if (!conta || conta.status !== "ativo") continue;
    try {
      const u = new URL("https://graph.instagram.com/refresh_access_token");
      u.searchParams.set("grant_type", "ig_refresh_token");
      u.searchParams.set("access_token", t.access_token);
      const r = await fetch(u);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.access_token) throw new Error(d.error?.message ?? `HTTP ${r.status}`);
      const exp = new Date(Date.now() + Number(d.expires_in ?? 5_184_000) * 1000).toISOString();
      await db.from("instagram_tokens").update({ access_token: d.access_token, expires_at: exp, updated_at: new Date().toISOString() }).eq("corretor_id", t.corretor_id);
      await db.from("instagram_contas").update({ token_expires_at: exp }).eq("corretor_id", t.corretor_id);
      renovados++;
    } catch (e) {
      falhas.push(`${conta.username}: ${(e as Error).message.slice(0, 80)}`);
      // token já vencido/revogado: o corretor precisa reconectar — avisa no painel Admin
      if (t.expires_at && new Date(t.expires_at).getTime() < Date.now()) {
        await db.rpc("registrar_alerta", { p_tipo: "ig_token", p_mensagem: `O acesso ao Instagram de @${conta.username} venceu. O corretor precisa reconectar na aba Instagram.`, p_origem: "manutencao-diaria" });
      }
    }
  }
  return { renovados, falhas };
}

async function limparImagens(db: SupabaseClient) {
  const antes = new Date(Date.now() - LIMPAR_APOS_DIAS * 86_400_000).toISOString();
  const { data: carros } = await db.from("carrosseis").select("id, corretor_id, slides!inner(id)")
    .eq("status", "publicado").lt("data_publicada", antes).not("slides.render_url", "is", null).limit(LIMPAR_POR_RODADA);
  let carrosseis = 0, arquivos = 0;
  for (const c of carros ?? []) {
    const pasta = `${c.corretor_id}/${c.id}`;
    const { data: lista } = await db.storage.from(BUCKET).list(pasta, { limit: 1000 });
    const caminhos = (lista ?? []).map((f) => `${pasta}/${f.name}`);
    if (caminhos.length) {
      const { error } = await db.storage.from(BUCKET).remove(caminhos);
      if (error) { console.error("limpar:", pasta, error.message); continue; }
      arquivos += caminhos.length;
    }
    await db.from("slides").update({ render_url: null }).eq("carrossel_id", c.id);
    carrosseis++;
  }
  return { carrosseis, arquivos };
}

Deno.serve(async () => {
  try {
    const db = admin();
    const { data: ultimo } = await db.from("lotes_ia").select("created_at").eq("tipo", "manutencao")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < 20 * 3600_000) return json({ acao: "nada_a_fazer" });

    const tokens = await renovarTokens(db).catch((e) => ({ erro: (e as Error).message }));
    const imagens = await limparImagens(db).catch((e) => ({ erro: (e as Error).message }));
    const resultado = { tokens, imagens };
    await db.from("lotes_ia").insert({ tipo: "manutencao", status: "processado", processado_em: new Date().toISOString(), detalhe: JSON.stringify(resultado).slice(0, 900) });
    return json({ acao: "feito", resultado });
  } catch (e) {
    console.error("manutencao-diaria:", e);
    return json({ error: "Erro interno." }, 500);
  }
});
