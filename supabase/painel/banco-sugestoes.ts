// banco-sugestoes — enche o banco de assuntos (tabela topicos) 1x por dia usando a Batch API da Anthropic
// (metade do preço de uma chamada normal) + cache do prompt fixo. Durante o dia o botão "Gerar novas sugestões"
// do app tira assuntos inéditos deste banco, sem chamar a IA.
//
// Roda sozinha (pg_cron + pg_net, ver migração 20261013_banco_sugestoes.sql), de hora em hora:
//   - se existe um lote enviado e ainda não processado: confere se a Anthropic terminou; se sim, grava os assuntos;
//   - senão, se o último lote tem mais de 20h: envia um lote novo.
// Não recebe nada do chamador e nunca envia mais de 1 lote a cada 20h, então chamá-la à toa não gasta crédito.
// Configuração no painel: "Verify JWT" DESLIGADO (o pg_net chama sem login).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const API = "https://api.anthropic.com/v1/messages/batches";
const KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODELO = "claude-sonnet-4-5";
const PEDIDOS = 5;                 // 5 pedidos × 6 assuntos = 30 assuntos novos por dia
const HORAS_ENTRE_LOTES = 20;
const CATEGORIAS = ["Dicas", "Financiamento", "Vendas", "Mercado"];
const FOCOS = [
  "Foque em Financiamento e documentação (sem citar taxas, valores ou regras específicas).",
  "Foque em Vendas: como o corretor conquista, negocia e fecha com o cliente.",
  "Foque em Dicas práticas pra quem compra, vende ou aluga imóvel.",
  "Foque em Mercado: comportamento do comprador, tendências gerais e mitos (sem números inventados).",
  "Misture as 4 categorias com ângulos inesperados: bastidores da profissão, erros comuns, comparações.",
];

const SYSTEM = `Você é um estrategista de conteúdo especializado em carrosséis virais de Instagram para o mercado imobiliário brasileiro.
Sua tarefa é sugerir NOVOS TEMAS/ASSUNTOS (não o carrossel inteiro) pra um banco de ideias que corretores de imóveis usam como ponto de partida.

Regras:
1. Gere exatamente 6 assuntos diferentes entre si. Categoria de cada um: Dicas, Financiamento, Vendas ou Mercado.
2. Cada assunto tem: categoria, um "gancho" (título curto, forte, que gera curiosidade — nunca genérico tipo "Dicas de imóveis") e 2 "ideias" (pontos que podem virar slides), cada uma com "titulo" curto (até 6 palavras) e "corpo" de UMA frase curta.
3. Temas de mercado imobiliário brasileiro real: financiamento, aluguel, venda, investimento, documentação, valorização, erros comuns, negociação, bastidores do corretor.
4. Tom: direto, conversacional, brasileiro, sem jargão técnico.
5. NUNCA INVENTE FATOS. O corretor vai postar isso com o nome dele — informação falsa queima a reputação dele. Proibido: valores em reais, percentuais e estatísticas ("80% dos compradores", "7 em cada 10"), "nova regra"/"nova lei", prazos exatos, taxas de juros específicas, programas/benefícios com condições que você não tem certeza absoluta de que estão em vigor, e afirmações sobre bairros específicos valorizando. Prefira ganchos de curiosidade, erro comum, comparação, checklist e bastidores. Na dúvida se algo é verdade, não use.
6. Não repita nenhum dos ganchos que já existem (lista enviada pelo usuário) nem ideias muito parecidas com eles.
7. Responda APENAS com JSON válido, sem markdown, no formato:
{"topicos":[{"categoria":"Dicas","gancho":"...","ideias":[{"titulo":"...","corpo":"..."},{"titulo":"...","corpo":"..."}]}]}`;

function admin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const headers = () => ({ "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" });

async function alertarSeSemCredito(db: SupabaseClient, status: number, corpo: string) {
  if (corpo.toLowerCase().includes("credit balance")) {
    await db.rpc("registrar_alerta", { p_tipo: "ia_sem_credito", p_mensagem: "A conta da Anthropic está sem créditos: a IA da Vitrine parou. Recarregue em console.anthropic.com > Plans & Billing.", p_origem: "banco-sugestoes" });
  } else if (status === 401 || status === 403) {
    await db.rpc("registrar_alerta", { p_tipo: "ia_config", p_mensagem: "A chave da API da Anthropic foi recusada (401/403). Confira o secret ANTHROPIC_API_KEY no Supabase.", p_origem: "banco-sugestoes" });
  }
}

async function enviarLote(db: SupabaseClient) {
  const { data: recentes } = await db.from("topicos").select("gancho").order("created_at", { ascending: false }).limit(80);
  const existentes = (recentes ?? []).map((t) => "- " + t.gancho).join("\n");
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
  const requests = FOCOS.slice(0, PEDIDOS).map((foco, i) => ({
    custom_id: "assuntos-" + i,
    params: {
      model: MODELO,
      max_tokens: 1800,
      // cache: o texto fixo de instruções é o mesmo nos 5 pedidos
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Hoje é ${hoje}. ${foco}\n\nGanchos que já existem (não repita):\n${existentes}\n\nGere 6 assuntos novos.` }],
    },
  }));
  const res = await fetch(API, { method: "POST", headers: headers(), body: JSON.stringify({ requests }) });
  const txt = await res.text();
  if (!res.ok) {
    console.error("banco-sugestoes: erro ao criar lote:", res.status, txt.slice(0, 500));
    await alertarSeSemCredito(db, res.status, txt);
    await db.from("lotes_ia").insert({ tipo: "assuntos", status: "erro", detalhe: `HTTP ${res.status}` });
    return { acao: "erro_ao_enviar", status: res.status };
  }
  const lote = JSON.parse(txt);
  await db.from("lotes_ia").insert({ tipo: "assuntos", batch_id: lote.id, status: "enviado" });
  return { acao: "lote_enviado", batch_id: lote.id };
}

async function processarLote(db: SupabaseClient, row: { id: number; batch_id: string }) {
  const res = await fetch(`${API}/${row.batch_id}`, { headers: headers() });
  if (!res.ok) { console.error("banco-sugestoes: consulta do lote", res.status); return { acao: "aguardando" }; }
  const lote = await res.json();
  if (lote.processing_status !== "ended" || !lote.results_url) return { acao: "aguardando", status: lote.processing_status };

  const r = await fetch(lote.results_url, { headers: headers() });
  const linhas = (await r.text()).split("\n").filter(Boolean);
  const { data: recentes } = await db.from("topicos").select("gancho").order("created_at", { ascending: false }).limit(400);
  const vistos = new Set((recentes ?? []).map((t) => String(t.gancho).toLowerCase().trim()));
  const novos: Record<string, unknown>[] = [];
  let falhas = 0;
  for (const l of linhas) {
    try {
      const item = JSON.parse(l);
      if (item.result?.type !== "succeeded") { falhas++; continue; }
      const texto = item.result.message?.content?.[0]?.text ?? "";
      const m = texto.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : texto);
      for (const t of parsed.topicos ?? []) {
        const gancho = String(t.gancho ?? "").replace(/\*/g, "").trim().slice(0, 140);
        if (!gancho || vistos.has(gancho.toLowerCase())) continue;
        // trava extra contra número inventado que tenha escapado do prompt
        const ideias = (Array.isArray(t.ideias) ? t.ideias : []).slice(0, 3)
          .map((x: { titulo?: unknown; corpo?: unknown }) => ({ titulo: String(x.titulo ?? "").slice(0, 80), corpo: String(x.corpo ?? "").slice(0, 200) }));
        const tudo = gancho + " " + ideias.map((x: { titulo: string; corpo: string }) => x.titulo + " " + x.corpo).join(" ");
        if (/R\$|\d+ ?%|\d+ em cada \d+|nova regra|nova lei|mudou a regra/i.test(tudo)) continue;
        vistos.add(gancho.toLowerCase());
        novos.push({ categoria: CATEGORIAS.includes(t.categoria) ? t.categoria : "Dicas", titulo: gancho, gancho, ideias, ativo: true });
      }
    } catch (e) { falhas++; console.error("banco-sugestoes: linha inválida:", (e as Error).message); }
  }
  if (novos.length) {
    const { error } = await db.from("topicos").insert(novos);
    if (error) throw error;
  }
  await db.from("lotes_ia").update({ status: "processado", processado_em: new Date().toISOString(), detalhe: `${novos.length} assuntos, ${falhas} falhas` }).eq("id", row.id);
  return { acao: "lote_processado", inseridos: novos.length, falhas };
}

Deno.serve(async () => {
  try {
    const db = admin();
    const { data: pendente } = await db.from("lotes_ia").select("id, batch_id").eq("tipo", "assuntos").eq("status", "enviado")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (pendente) return json(await processarLote(db, pendente));

    const { data: ultimo } = await db.from("lotes_ia").select("created_at").eq("tipo", "assuntos")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < HORAS_ENTRE_LOTES * 3600_000) return json({ acao: "nada_a_fazer" });
    return json(await enviarLote(db));
  } catch (e) {
    console.error("banco-sugestoes: erro inesperado:", e);
    return json({ error: "Erro interno." }, 500);
  }
});
