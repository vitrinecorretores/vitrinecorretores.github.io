// abastecer-fotos — enche o banco próprio de fotos reais de imóveis (tabela banco_fotos) aos poucos,
// respeitando o limite gratuito das APIs (Unsplash: 50 buscas/hora; Pexels: 200/hora, se houver chave).
// O buscar-imagens tira fotos deste banco primeiro: o carrossel sai com foto mesmo quando a API está no limite.
//
// Roda sozinha (pg_cron + pg_net, ver migração 20261014_banco_fotos.sql) a cada 20 min. Cada execução:
//   - pega as CATEGORIAS com menos fotos (até POR_RODADA), faz 1 busca em cada banco de fotos e grava as novas;
//   - nunca roda duas vezes em menos de 15 min (trava na tabela lotes_ia), então chamá-la à toa não gasta cota;
//   - para de buscar uma categoria quando ela chega em META_POR_CATEGORIA fotos.
// Configuração no painel: "Verify JWT" DESLIGADO (o pg_net chama sem login).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const UNSPLASH = Deno.env.get("UNSPLASH_ACCESS_KEY");
const PEXELS = Deno.env.get("PEXELS_API_KEY");
const POR_RODADA = 3;
const META_POR_CATEGORIA = 160;
const MINUTOS_ENTRE_RODADAS = 15;

// categoria → buscas em inglês (bancos de foto respondem melhor em inglês). Mesmas categorias do buscar-imagens.
export const CATEGORIAS: Record<string, string[]> = {
  sala: ["modern living room", "bright living room apartment", "cozy living room interior", "living room large windows"],
  cozinha: ["modern kitchen interior", "kitchen island marble", "minimalist kitchen", "luxury kitchen"],
  quarto: ["modern bedroom interior", "master bedroom", "bedroom natural light", "minimalist bedroom"],
  banheiro: ["modern bathroom interior", "luxury bathroom", "bathroom marble"],
  varanda: ["apartment balcony view", "balcony plants sunset", "terrace city view", "balcony ocean view"],
  piscina: ["swimming pool house", "rooftop pool", "luxury villa pool", "condominium pool"],
  fachada: ["modern house exterior", "house facade", "luxury home exterior", "contemporary house architecture"],
  predios: ["residential building", "apartment towers", "high rise residential", "modern apartment building facade"],
  cidade: ["city skyline sunset", "aerial view city buildings", "drone view residential neighborhood", "city at night buildings"],
  chaves: ["house keys", "keys handover", "key new home", "hand holding keys"],
  contrato: ["signing contract", "real estate contract", "documents desk pen", "business handshake"],
  financas: ["calculator coins", "mortgage paperwork", "piggy bank house", "financial planning desk"],
  mudanca: ["moving boxes new home", "couple moving in", "family new house", "unpacking boxes apartment"],
  obra: ["construction site crane", "building under construction", "architect blueprint", "construction workers building"],
  trabalho: ["real estate agent showing house", "business meeting office", "laptop coffee work", "agent clients meeting"],
  celular: ["smartphone social media", "person using phone", "phone photo interior", "hands smartphone"],
  fortaleza: ["Fortaleza Brazil", "Fortaleza beach", "Fortaleza skyline", "Ceara beach", "Fortaleza Ceara"],
  condominio: ["gated community houses", "condominium garden", "residential complex", "suburban houses street"],
  decoracao: ["interior design details", "home decor plants", "dining room interior", "home interior styling"],
  praia: ["beach apartment view", "ocean view balcony", "beach house", "tropical beach houses"],
  graficos: ["stock market chart", "business growth chart", "economy graph screen", "financial data screen"],
};

function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const pagina = () => 1 + Math.floor(Math.random() * 5);
type Linha = { id: string; categoria: string; url: string; credito: string; link: string; download_location: string | null };

async function doUnsplash(q: string, categoria: string): Promise<Linha[]> {
  const u = new URL("https://api.unsplash.com/search/photos");
  u.searchParams.set("query", q);
  u.searchParams.set("page", String(pagina()));
  u.searchParams.set("per_page", "30");
  u.searchParams.set("content_filter", "high");
  if (categoria !== "fortaleza") u.searchParams.set("orientation", "portrait");
  const r = await fetch(u, { headers: { Authorization: `Client-ID ${UNSPLASH}`, "Accept-Version": "v1" } });
  if (!r.ok) throw new Error("unsplash " + r.status);
  const d = await r.json();
  // deno-lint-ignore no-explicit-any
  return (d.results ?? []).filter((p: any) => p.width >= 1080).map((p: any) => ({
    id: "u" + p.id, categoria,
    url: `${p.urls.raw}&w=1080&h=1350&fit=crop&crop=entropy&q=85&fm=jpg`,
    credito: `Foto: ${p.user?.name ?? "Unsplash"} / Unsplash`,
    link: `${p.user?.links?.html ?? "https://unsplash.com"}?utm_source=vitrine&utm_medium=referral`,
    download_location: p.links?.download_location ?? null,
  }));
}

async function doPexels(q: string, categoria: string): Promise<Linha[]> {
  const u = new URL("https://api.pexels.com/v1/search");
  u.searchParams.set("query", q);
  u.searchParams.set("page", String(pagina()));
  u.searchParams.set("per_page", "80");
  u.searchParams.set("size", "large");
  if (categoria !== "fortaleza") u.searchParams.set("orientation", "portrait");
  const r = await fetch(u, { headers: { Authorization: PEXELS! } });
  if (!r.ok) throw new Error("pexels " + r.status);
  const d = await r.json();
  // deno-lint-ignore no-explicit-any
  return (d.photos ?? []).filter((p: any) => p.width >= 1080).map((p: any) => ({
    id: "p" + p.id, categoria,
    url: p.src.large2x || p.src.original,
    credito: `Foto: ${p.photographer} / Pexels`,
    link: p.url,
    download_location: null,
  }));
}

Deno.serve(async () => {
  try {
    const db = admin();
    if (!UNSPLASH && !PEXELS) return json({ acao: "sem_chave" });
    // trava: no máximo 1 rodada a cada MINUTOS_ENTRE_RODADAS
    const { data: ultimo } = await db.from("lotes_ia").select("created_at").eq("tipo", "fotos")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < MINUTOS_ENTRE_RODADAS * 60_000) return json({ acao: "nada_a_fazer" });

    // quantas fotos cada categoria já tem
    const { data: contagem } = await db.rpc("banco_fotos_contagem");
    const tem: Record<string, number> = {};
    for (const r of contagem ?? []) tem[r.categoria] = Number(r.n);
    const fila = Object.keys(CATEGORIAS).filter((c) => (tem[c] ?? 0) < META_POR_CATEGORIA)
      .sort((a, b) => (tem[a] ?? 0) - (tem[b] ?? 0)).slice(0, POR_RODADA);
    if (!fila.length) {
      await db.from("lotes_ia").insert({ tipo: "fotos", status: "processado", detalhe: "banco cheio" });
      return json({ acao: "banco_cheio" });
    }

    let novas = 0; const erros: string[] = [];
    for (const cat of fila) {
      const buscas = CATEGORIAS[cat];
      const q = buscas[Math.floor(Math.random() * buscas.length)];
      const linhas: Linha[] = [];
      if (PEXELS) { try { linhas.push(...await doPexels(q, cat)); } catch (e) { erros.push((e as Error).message); } }
      if (UNSPLASH) { try { linhas.push(...await doUnsplash(q, cat)); } catch (e) { erros.push((e as Error).message); } }
      if (!linhas.length) continue;
      // ignora as que já existem (mesmo id) — a foto fica na 1ª categoria em que entrou
      const { data: gravadas, error } = await db.from("banco_fotos").upsert(linhas, { onConflict: "id", ignoreDuplicates: true }).select("id");
      if (error) { erros.push(error.message); continue; }
      novas += gravadas?.length ?? 0;
    }
    await db.from("lotes_ia").insert({ tipo: "fotos", status: "processado", processado_em: new Date().toISOString(),
      detalhe: `${novas} fotos novas em ${fila.join(", ")}${erros.length ? " · erros: " + erros.join("; ").slice(0, 200) : ""}` });
    return json({ acao: "abastecido", categorias: fila, novas, erros });
  } catch (e) {
    console.error("abastecer-fotos:", e);
    return json({ error: "Erro interno." }, 500);
  }
});
