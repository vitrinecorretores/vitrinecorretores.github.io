// Agente de Marketing da Vitrine — cria, desenha e agenda sozinho os carrosséis do @vitrinecorretores.
// Roda no GitHub Actions (grátis). Custo: só os tokens da API da Anthropic (~3 chamadas por post).
//
// Usa as funcionalidades da própria plataforma, como um corretor usaria:
//   gerar-conteudo (IA viral da Vitrine + 3 ganchos de capa) · buscar-imagens (fotos reais) ·
//   estilos virais / fontes / cores (desenho do app.js, igual ao painel) · publicar-agendados (publica no horário)
// E aprende sozinho: cada post vira um experimento (pilar, estilo, cor, fonte, horário, fórmula do gancho);
// as métricas do Instagram (ig_metricas_posts) decidem o que repetir e o que testar (bandit UCB1).
//
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
// Opcionais: POSTS_POR_DIA (1), MODO=simular (não grava nada; só mostra o plano), VITRINE_SITE
import { createClient } from "@supabase/supabase-js";
import { renderizar } from "./render.mjs";

const UID = "f13c2703-8848-485a-ae60-97e139a2b0a6";          // conta @vitrinecorretores
const SUPABASE_URL = process.env.SUPABASE_URL || "https://qbfmozumntequvecttfs.supabase.co";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_xXZFK2Pzq7MHsMv2f_iISw_yriYjMvv";   // chave pública do app
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/^["']|["']$/g, "");
const ANTHROPIC = (process.env.ANTHROPIC_API_KEY || "").trim().replace(/^["']|["']$/g, "");
const MODELO = process.env.MODELO_IA || "claude-sonnet-4-5";
const WORKSPACE = (process.env.ANTHROPIC_WORKSPACE_ID || "").trim();   // só para chaves criadas fora de um workspace
const POSTS_POR_DIA = Math.max(1, Math.min(3, +(process.env.POSTS_POR_DIA || 1)));
const SIMULAR = process.env.MODO === "simular";
const TZ_OFFSET = -3;                                           // Fortaleza (sem horário de verão)

if (!SERVICE || !ANTHROPIC) throw new Error("Faltam SUPABASE_SERVICE_ROLE_KEY e/ou ANTHROPIC_API_KEY.");
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

// ---------------- opções que o agente testa ----------------
const PILARES = [
  { id: "instagram", nome: "Instagram pro corretor", desc: "perfil, bio, alcance, stories, algoritmo, o que postar" },
  { id: "captacao", nome: "Captação", desc: "conseguir imóveis, exclusividade, abordagem de proprietário, avaliação" },
  { id: "vendas", nome: "Vendas e negociação", desc: "visita, follow-up, objeções, comissão, fechamento" },
  { id: "produtividade", nome: "Produtividade e IA", desc: "rotina, ferramentas, automação, ganhar tempo (onde a Vitrine entra natural)" },
  { id: "bastidores", nome: "Bastidores e humor do corretor", desc: "dores e situações do dia a dia que todo corretor reconhece e marca o colega" },
  { id: "mercado", nome: "Mercado com fonte", desc: "dados reais e verificáveis do mercado imobiliário (nunca inventar número)" },
];
const ESTILOS = ["manchete", "post-social", "checklist", "bloco-cor", "minimalista", "editorial", "vibrante"];
const CORES = ["limao", "amarelo", "laranja", "rosa", "ciano", "menta", "vermelho"];
const FONTES = ["impacto", "moderna", "futurista", "classica", "amigavel"];
const SLOTS = ["07:40", "12:10", "18:40", "21:10"];             // horário de Fortaleza
const FORMULAS = ["numero", "erro", "segredo", "polemica", "promessa", "pergunta"];

// ---------------- utilitários ----------------
const log = (...a) => console.log("[agente]", ...a);
const horaLocal = (iso) => { const d = new Date(new Date(iso).getTime() + TZ_OFFSET * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const slotDe = (iso) => { const m = horaLocal(iso); let best = SLOTS[0], dif = 1e9; for (const s of SLOTS) { const [h, mm] = s.split(":").map(Number); const d = Math.abs(h * 60 + mm - m); if (d < dif) { dif = d; best = s; } } return best; };
const semMarcas = (t) => String(t || "").replace(/\*/g, "");

async function ia(system, user, maxTokens = 3000) {
  for (let t = 0; t < 3; t++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", ...(WORKSPACE ? { "anthropic-workspace-id": WORKSPACE } : {}) },
      body: JSON.stringify({ model: MODELO, max_tokens: maxTokens, system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: user }] }),
    });
    if (r.ok) {
      const j = await r.json();
      const txt = j.content?.[0]?.text ?? "";
      const m = txt.match(/\{[\s\S]*\}/);
      try { return JSON.parse(m ? m[0] : txt); } catch { log("IA devolveu JSON inválido, tentando de novo"); continue; }
    }
    if (r.status < 500 && r.status !== 429) throw new Error(`API Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
    await new Promise((ok) => setTimeout(ok, 5000 * (t + 1)));
  }
  throw new Error("A IA não respondeu depois de 3 tentativas.");
}

// sessão do próprio usuário da Vitrine (sem senha): link mágico gerado pelo admin e confirmado na hora.
// Assim as funções da plataforma rodam exatamente como quando o Evandro usa o painel (limites e logs inclusos).
async function sessaoDoUsuario() {
  const { data: u, error: eu } = await db.auth.admin.getUserById(UID);
  if (eu || !u?.user?.email) throw new Error("Não achei o usuário da Vitrine.");
  const { data: link, error: el } = await db.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (el) throw el;
  const pub = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error: es } = await pub.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (es || !s?.session) throw es || new Error("Não consegui abrir a sessão.");
  return s.session.access_token;
}
async function funcao(token, nome, corpo) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${nome}`, {
    method: "POST", headers: { "content-type": "application/json", apikey: ANON_KEY, authorization: `Bearer ${token}` }, body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${nome}: ${j.error || r.status}`);
  return j;
}

// ---------------- aprendizado: o que funciona no @vitrinecorretores ----------------
// pontuação de um post: salvamentos e compartilhamentos valem mais (é o que o algoritmo mais premia)
function pontos(m) {
  const eng = (m.salvamentos || 0) * 4 + (m.compartilhamentos || 0) * 5 + (m.comentarios || 0) * 3 + (m.curtidas || 0);
  return m.alcance > 0 ? (eng / m.alcance) * 100 + Math.log10(m.alcance + 1) : eng;
}
async function historico() {
  const desde = new Date(Date.now() - 90 * 86400e3).toISOString();
  const limite = new Date(Date.now() - 36 * 3600e3).toISOString();     // post precisa de ~36h pra ter número estável
  const [{ data: posts }, { data: exps }, { data: tpls }] = await Promise.all([
    db.from("carrosseis").select("id, template_id, fonte, data_publicada, slides(ordem, titulo)").eq("corretor_id", UID).eq("status", "publicado").gte("data_publicada", desde).lte("data_publicada", limite),
    db.from("marketing_experimentos").select("*").eq("corretor_id", UID),
    db.from("templates").select("id, slug"),
  ]);
  const ids = (posts || []).map((p) => p.id);
  const { data: mets } = ids.length ? await db.from("ig_metricas_posts").select("*").eq("corretor_id", UID).in("carrossel_id", ids) : { data: [] };
  const slug = Object.fromEntries((tpls || []).map((t) => [t.id, t.slug]));
  const exp = Object.fromEntries((exps || []).map((e) => [e.carrossel_id, e]));
  const obs = [];
  for (const p of posts || []) {
    const m = (mets || []).find((x) => x.carrossel_id === p.id);
    if (!m) continue;
    const [fonte, cor] = String(p.fonte || "").split("|");
    const e = exp[p.id] || {};
    const capa = semMarcas(((p.slides || []).sort((a, b) => a.ordem - b.ordem)[0] || {}).titulo);
    obs.push({ id: p.id, capa, estilo: slug[p.template_id] || "minimalista", fonte: fonte || "moderna", cor: cor || "amarelo", slot: slotDe(p.data_publicada), pilar: e.pilar, formula: e.formula, m, score: pontos(m) });
  }
  // normaliza 0..1 por posição (robusto a outliers e a contas pequenas)
  const ord = [...obs].sort((a, b) => a.score - b.score);
  ord.forEach((o, i) => { o.nota = ord.length > 1 ? i / (ord.length - 1) : 0.5; });
  return obs;
}
// UCB1: repete o que funciona, mas sempre testa o que tem pouca amostra
function escolher(obs, campo, opcoes, evitar = []) {
  const N = Math.max(1, obs.filter((o) => o[campo]).length);
  let melhor = null, mv = -1;
  for (const op of opcoes) {
    const amostra = obs.filter((o) => o[campo] === op);
    const media = amostra.length ? amostra.reduce((s, o) => s + o.nota, 0) / amostra.length : 0.5;
    const bonus = Math.sqrt((2 * Math.log(N + 1)) / (amostra.length + 1));
    const v = media + 0.6 * bonus - (evitar.includes(op) ? 0.5 : 0) + Math.random() * 0.05;
    if (v > mv) { mv = v; melhor = op; }
  }
  return melhor;
}
function resumoPorCampo(obs, campo) {
  const g = {};
  for (const o of obs) { if (!o[campo]) continue; (g[o[campo]] ||= []).push(o.nota); }
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { posts: v.length, nota_media: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) }]));
}

// ---------------- estrategista + editor-chefe ----------------
const SISTEMA_ESTRATEGISTA = `Você é o head de conteúdo do @vitrinecorretores, o Instagram da Vitrine (SaaS brasileiro que cria carrosséis virais com IA para corretores de imóveis). Você pensa como os melhores estrategistas de Instagram do Brasil: conteúdo que o corretor SALVA, COMPARTILHA com colegas e COMENTA, porque resolve uma dor real ou é identificação pura.
Público: corretores de imóveis autônomos e pequenas imobiliárias no Brasil (não é o cliente final que compra imóvel).
Objetivo de negócio: crescer seguidores corretores, alcance e cliques no link da bio (teste grátis). A Vitrine aparece de forma natural, nunca como anúncio: no máximo 1 slide fala dela, e só quando fizer sentido (o CTA final pode convidar a testar).
Regras: nunca invente estatística, lei, taxa ou número como se fosse dado oficial. Nada de tema repetido. Prefira temas específicos e acionáveis a temas genéricos. Responda APENAS com JSON válido.`;

async function planejar(obs, pilar, formula, recentes, rascunhos, palavraGatilho) {
  const top = [...obs].sort((a, b) => b.score - a.score).slice(0, 5).map((o) => ({ capa: o.capa, estilo: o.estilo, horario: o.slot, metricas: o.m && { alcance: o.m.alcance, salvos: o.m.salvamentos, compart: o.m.compartilhamentos, coment: o.m.comentarios, curtidas: o.m.curtidas } }));
  const piores = [...obs].sort((a, b) => a.score - b.score).slice(0, 5).map((o) => o.capa);
  const hoje = new Date(Date.now() + TZ_OFFSET * 3600e3).toISOString().slice(0, 10);
  const p = PILARES.find((x) => x.id === pilar);
  return ia(SISTEMA_ESTRATEGISTA, `Hoje é ${hoje} (Fortaleza-CE). Planeje o próximo carrossel.
Pilar escolhido pelo sistema de testes: ${p.nome} — ${p.desc}
Fórmula de gancho a testar na capa: ${formula}
Posts que MAIS performaram (copie o que os faz funcionar, não o tema): ${JSON.stringify(top)}
Posts que MENOS performaram (evite esse tipo de abordagem): ${JSON.stringify(piores)}
Capas recentes (NÃO repita tema nem ângulo): ${JSON.stringify(recentes)}
Rascunhos prontos no estoque (pode usar UM se for claramente o melhor tema para hoje e o pilar; senão ignore): ${JSON.stringify(rascunhos)}
Palavra-gatilho de comentário configurada na conta: "${palavraGatilho}" (use no CTA para gerar comentários).
Responda no formato:
{"rascunho_id": null ou "id do rascunho escolhido",
 "assunto": "tema específico em 1 frase (o que o carrossel ensina/provoca)",
 "categoria": "categoria curta",
 "direcionamento": "instruções para o redator, até 280 caracteres: ângulo, exemplo concreto, tom, fórmula da capa, CTA com a palavra-gatilho",
 "por_que": "1 frase: por que esse tema deve performar com corretores agora"}`, 1200);
}

const SISTEMA_EDITOR = `Você é o editor-chefe de um perfil de Instagram que viraliza com corretores de imóveis no Brasil. Recebe um carrossel já escrito pela IA da Vitrine e o deixa pronto para publicar.
Regras do formato (inegociáveis): título da capa com 4 a 6 palavras; demais títulos com 3 a 5 palavras; 1 ou 2 palavras de impacto entre *asteriscos* em cada título (nunca o título inteiro); corpo com no máximo 2 frases curtas; capa termina o corpo com "Arrasta pro lado →"; penúltimo slide salvável; último slide é CTA específico. Nunca invente dados. Português do Brasil, tom de corretor experiente falando com colega.
Responda APENAS com JSON válido.`;

async function editar(slides, capasAlt, plano, palavraGatilho) {
  return ia(SISTEMA_EDITOR, `Tema: ${plano.assunto}
Carrossel (JSON): ${JSON.stringify(slides)}
Capas alternativas sugeridas: ${JSON.stringify(capasAlt)}
Palavra-gatilho para o CTA: "${palavraGatilho}"
Tarefas:
1. Escolha a capa mais forte para PARAR O SCROLL de um corretor: 0 = a capa atual do slide 1, 1 e 2 = as alternativas.
2. Corrija só o que quebrar as regras (tamanho dos títulos, asteriscos, CTA sem a palavra-gatilho). Não reescreva o que já está bom.
3. Escreva a legenda: 1ª linha = gancho forte (diferente da capa, até 12 palavras); 2–4 linhas curtas de valor; pedido para salvar e mandar para um corretor amigo; CTA para comentar "${palavraGatilho}"; convite para testar grátis no link da bio; 6 a 8 hashtags de nicho de corretor (#corretordeimoveis #corretor #mercadoimobiliario ...). Até 1.200 caracteres.
Formato: {"capa_idx": 0, "slides": [{"tag":"...","titulo":"...","corpo":"..."}], "legenda": "..."}`, 3500);
}

function validarSlides(sl) {
  if (!Array.isArray(sl) || sl.length < 4 || sl.length > 10) throw new Error("Carrossel com quantidade de slides inválida.");
  for (const s of sl) if (!s || !String(s.titulo || "").trim() || typeof s.corpo !== "string") throw new Error("Slide sem título/corpo.");
  return sl.map((s) => ({ tag: String(s.tag || "").slice(0, 24), titulo: String(s.titulo).slice(0, 90), corpo: String(s.corpo).slice(0, 320) }));
}

// ---------------- horários ----------------
function proximosHorarios(qtd, slotsPreferidos, ocupados) {
  const out = [];
  for (let dia = 0; dia < 3 && out.length < qtd; dia++) {
    for (const s of slotsPreferidos) {
      const [h, m] = s.split(":").map(Number);
      const base = new Date(); base.setUTCHours(h - TZ_OFFSET, m, 0, 0); base.setUTCDate(base.getUTCDate() + dia);
      if (base.getTime() < Date.now() + 30 * 60e3) continue;
      if (ocupados.some((o) => Math.abs(new Date(o).getTime() - base.getTime()) < 3 * 3600e3)) continue;
      out.push({ iso: base.toISOString(), slot: s });
      if (out.length >= qtd) break;
    }
  }
  return out;
}

// ---------------- execução ----------------
async function criarUmPost(ctx, horario) {
  const { obs, token, templates, profile, assinaturaStatus, palavraGatilho, ultimos } = ctx;
  const pilar = escolher(obs, "pilar", PILARES.map((p) => p.id), ultimos.pilares);
  const formula = escolher(obs, "formula", FORMULAS, ultimos.formulas);
  const estilo = escolher(obs, "estilo", ESTILOS, ultimos.estilos.slice(0, 1));
  const cor = escolher(obs, "cor", CORES, ultimos.cores.slice(0, 1));
  const fonte = escolher(obs, "fonte", FONTES);
  log("teste escolhido:", { pilar, formula, estilo, cor, fonte, horario: horario.slot });

  const plano = await planejar(obs, pilar, formula, ctx.recentes, ctx.rascunhos, palavraGatilho);
  log("plano:", plano);

  let slides, capasAlt = [], carrosselId = null;
  if (plano.rascunho_id && ctx.rascunhos.some((r) => r.id === plano.rascunho_id)) {
    const { data: sl } = await db.from("slides").select("tag, titulo, corpo, ordem").eq("carrossel_id", plano.rascunho_id).order("ordem");
    slides = sl;   // reaproveita o texto do rascunho; o post sai como carrossel novo (o rascunho fica intacto)
  } else {
    const g = await funcao(token, "gerar-conteudo", { origem: "custom", dados: { assunto: plano.assunto, categoria: plano.categoria }, direcionamento: String(plano.direcionamento || "").slice(0, 300) });
    slides = g.slides; capasAlt = g.capas_alternativas || [];
  }
  const ed = await editar(validarSlides(slides), capasAlt, plano, palavraGatilho);
  slides = validarSlides(ed.slides || slides);
  const capaIdx = [0, 1, 2].includes(ed.capa_idx) ? ed.capa_idx : 0;
  if (capaIdx > 0 && capasAlt[capaIdx - 1]) slides[0].titulo = capasAlt[capaIdx - 1];
  const legenda = String(ed.legenda || "").slice(0, 2100);

  // fotos reais pela função da plataforma (estilo bloco-cor não usa foto)
  if (estilo !== "bloco-cor") {
    try {
      const f = await funcao(token, "buscar-imagens", { contexto: `corretor de imóveis no Brasil, ${plano.categoria}: ${plano.assunto}`, slides: slides.map((s) => ({ titulo: semMarcas(s.titulo), corpo: s.corpo })) });
      (f.imagens || []).forEach((foto, i) => { if (foto && slides[i]) { slides[i].imagem_url = foto.url; slides[i].imagem_prompt = (foto.credito || "") + "||" + (foto.link || ""); } });
    } catch (e) { log("sem fotos (segue sem):", e.message); }
  }

  const fonteCor = `${fonte}|${cor}`;
  const jpgs = await renderizar(slides, { slug: estilo, fonte: fonteCor, melhorar: true, profile, assinaturaStatus, igUsername: "vitrinecorretores" });
  if (jpgs.length !== slides.length) throw new Error("Render não gerou todas as imagens.");

  if (SIMULAR) {
    const fs = await import("node:fs");
    fs.mkdirSync("saida", { recursive: true });
    jpgs.forEach((b, i) => fs.writeFileSync(`saida/${horario.slot.replace(":", "")}-${i + 1}.jpg`, b));
    fs.writeFileSync(`saida/${horario.slot.replace(":", "")}-plano.json`, JSON.stringify({ pilar, formula, estilo, cor, fonte, horario, plano, slides, legenda }, null, 2));
    log("SIMULAÇÃO: imagens e plano salvos em ./saida (nada foi gravado no banco).");
    return { simulado: true, capa: semMarcas(slides[0].titulo) };
  }

  // grava o carrossel (novo ou o rascunho escolhido) como rascunho até as imagens subirem
  const template_id = templates[estilo];
  const dadosCar = { template_id, fonte: fonteCor, melhorar_fotos: true, legenda, gancho_idx: capasAlt.length ? capaIdx : null, direcionamento: String(plano.direcionamento || "").slice(0, 300) };
  {
    const { data: car, error } = await db.from("carrosseis").insert({ ...dadosCar, corretor_id: UID, origem: "custom", assunto_custom: plano.assunto, categoria: plano.categoria, status: "rascunho" }).select("id").single();
    if (error) throw error;
    carrosselId = car.id;
  }
  const stamp = Date.now();
  const linhas = [];
  for (let i = 0; i < slides.length; i++) {
    const path = `${UID}/${carrosselId}/${stamp}-${i + 1}.jpg`;
    const { error } = await db.storage.from("slides-render").upload(path, jpgs[i], { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error("Upload: " + error.message);
    linhas.push({ carrossel_id: carrosselId, ordem: i, tag: slides[i].tag, titulo: slides[i].titulo, corpo: slides[i].corpo,
      imagem_url: slides[i].imagem_url || null, imagem_prompt: slides[i].imagem_prompt || null,
      render_url: `${SUPABASE_URL}/storage/v1/object/public/slides-render/${path}` });
  }
  const { error: es } = await db.from("slides").insert(linhas);
  if (es) throw es;
  const { error: ea } = await db.from("carrosseis").update({ status: "agendado", data_agendada: horario.iso, erro_publicacao: null, instagram_contas_ids: [ctx.contaId] }).eq("id", carrosselId);
  if (ea) throw ea;
  await db.from("marketing_experimentos").upsert({ carrossel_id: carrosselId, corretor_id: UID, pilar, formula, estilo, cor, fonte, slot: horario.slot, assunto: plano.assunto, por_que: plano.por_que }, { onConflict: "carrossel_id" });
  log(`agendado ${carrosselId} para ${horario.iso} — "${semMarcas(slides[0].titulo)}"`);
  return { carrosselId, capa: semMarcas(slides[0].titulo) };
}

async function main() {
  // confere a chave antes de tudo: erro claro em vez de vários 401
  const { error: eChave } = await db.from("templates").select("id").limit(1);
  if (eChave) throw new Error(`O Supabase recusou a SUPABASE_SERVICE_ROLE_KEY (${eChave.message}). Cole de novo a chave "service_role" (ou a "Secret key" sb_secret_...) usando o botão de copiar.`);
  const [obs, token, { data: tpls }, { data: profile }, { data: assin }, { data: conta }, { data: recentesCar }, { data: agendados }] = await Promise.all([
    historico(),
    sessaoDoUsuario(),
    db.from("templates").select("id, slug").eq("ativo", true),
    db.from("profiles").select("id, nome, logo_url, cor_marca, marca_ativa, creci").eq("id", UID).single(),
    db.from("assinaturas").select("status").eq("corretor_id", UID).in("status", ["trial", "ativa"]).maybeSingle(),
    db.from("instagram_contas").select("id, status").eq("corretor_id", UID).eq("status", "ativo").order("principal", { ascending: false }).order("connected_at").limit(1).maybeSingle(),
    db.from("carrosseis").select("id, status, created_at, slides(ordem, titulo)").eq("corretor_id", UID).order("created_at", { ascending: false }).limit(80),
    db.from("carrosseis").select("data_agendada").eq("corretor_id", UID).eq("status", "agendado"),
  ]);
  if (!conta) throw new Error("Instagram da Vitrine desconectado — reconecte no painel antes de o agente publicar.");
  const { data: regra } = await db.from("ig_comentario_regras").select("palavra_gatilho").eq("conta_id", conta.id).maybeSingle();
  const { data: exps } = await db.from("marketing_experimentos").select("pilar, formula, estilo, cor, created_at").eq("corretor_id", UID).order("created_at", { ascending: false }).limit(3);

  const capa = (c) => semMarcas(((c.slides || []).sort((a, b) => a.ordem - b.ordem)[0] || {}).titulo);
  const ctx = {
    obs, token, profile, assinaturaStatus: assin?.status || null, contaId: conta.id,
    templates: Object.fromEntries((tpls || []).map((t) => [t.slug, t.id])),
    palavraGatilho: regra?.palavra_gatilho || "QUERO",
    recentes: (recentesCar || []).filter((c) => c.status !== "rascunho").slice(0, 40).map(capa),
    rascunhos: (recentesCar || []).filter((c) => c.status === "rascunho").slice(0, 30).map((c) => ({ id: c.id, capa: capa(c) })),
    ultimos: { pilares: (exps || []).map((e) => e.pilar).slice(0, 2), formulas: (exps || []).map((e) => e.formula).slice(0, 1), estilos: (exps || []).map((e) => e.estilo), cores: (exps || []).map((e) => e.cor) },
  };
  log(`histórico: ${obs.length} posts com métricas`, { estilo: resumoPorCampo(obs, "estilo"), horario: resumoPorCampo(obs, "slot") });

  // horários: o bandit ordena os slots pelo desempenho e testa os pouco usados
  const slotsOrdem = [];
  const restantes = [...SLOTS];
  while (restantes.length) { const s = escolher(obs, "slot", restantes); slotsOrdem.push(s); restantes.splice(restantes.indexOf(s), 1); }
  const horarios = proximosHorarios(POSTS_POR_DIA, slotsOrdem, (agendados || []).map((a) => a.data_agendada));
  if (!horarios.length) { log("já há posts agendados nos próximos horários — nada a fazer hoje."); return; }

  const feitos = [];
  for (const h of horarios) {
    try {
      const r = await criarUmPost(ctx, h);
      feitos.push(r);
      ctx.recentes.unshift(r.capa);
    } catch (e) {
      console.error("[agente] falhou um post:", e);
      await db.rpc("registrar_alerta", { p_tipo: "agente_marketing", p_mensagem: `Agente de marketing falhou: ${String(e.message || e).slice(0, 300)}`, p_origem: "agente-marketing" }).then(() => {}, () => {});
    }
  }
  if (!feitos.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
