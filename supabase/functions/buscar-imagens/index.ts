// POST (logado) { contexto?, slides: [{ titulo, corpo }], termos?: string[], excluir?: string[] }
//   → { imagens: [{ url, credito, link } | null] }
// termos  = busca escolhida pelo corretor (pula a IA); excluir = URLs de fotos que ele já viu (pra "trocar foto")
// Busca FOTOS REAIS em alta resolução em bancos de fotos profissionais com licença livre pra uso comercial:
// Unsplash (principal) e Pexels (reserva, se houver chave). Guardamos o nome do fotógrafo como crédito.
// A IA só escolhe as palavras de busca de cada slide.
// Secrets: UNSPLASH_ACCESS_KEY (grátis em unsplash.com/developers) e/ou PEXELS_API_KEY;
// ANTHROPIC_API_KEY e/ou OPENAI_API_KEY e/ou GEMINI_API_KEY
import { admin, handle, HttpError, json, requireUser } from "../_shared/util.ts";

const UNSPLASH = Deno.env.get("UNSPLASH_ACCESS_KEY");
const PEXELS = Deno.env.get("PEXELS_API_KEY");
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI = Deno.env.get("OPENAI_API_KEY");
const GEMINI = Deno.env.get("GEMINI_API_KEY");
const BUSCAS_POR_HORA = 60;

type Slide = { titulo?: string; corpo?: string };

// consultas locais continuam úteis, mas agora priorizamos imóveis, fachadas e interiores
// em vez de pontos turísticos genéricos que deixam o carrossel menos imobiliário.
const LUGARES_FORTALEZA = [
  "Fortaleza apartment building facade",
  "Fortaleza condo exterior",
  "Fortaleza apartment balcony view",
  "Meireles apartment living room",
  "Aldeota apartment exterior",
  "Mucuripe condo facade",
  "Praia do Futuro apartment balcony",
  "Fortaleza real estate street view",
];
const ehFortaleza = (q: string) => /fortaleza|cear[aá]|iracema|meireles|mucuripe|aldeota/i.test(q);
// escolhe uma foto aleatória entre as boas (não sempre a 1ª) pra não repetir as mesmas imagens
// deno-lint-ignore no-explicit-any
function sortear<T>(lista: T[]): T | undefined { return lista.length ? lista[Math.floor(Math.random() * Math.min(lista.length, 6))] : undefined; }

function textoSlide(s: Slide) {
  return `${s.titulo ?? ""} ${s.corpo ?? ""}`.trim().toLowerCase();
}

function temLocalizacao(txt: string) {
  return /fortaleza|cear[aá]|bairro|regi[aã]o|meireles|aldeota|mucuripe|praia do futuro|iracema|localiza[cç][aã]o|vista|orla/.test(txt);
}

function buscaFallbackPorSlide(contexto: string, slide: Slide, i: number): string {
  const txt = textoSlide(slide);
  const ctx = String(contexto || "").toLowerCase();
  const local = temLocalizacao(txt) || temLocalizacao(ctx);
  if (/foto|fotos|fachada|an[uú]ncio|primeira impress[aã]o|visita|tour|apresenta[cç][aã]o/.test(txt)) {
    return local ? "Fortaleza apartment building facade" : "modern apartment building facade brazil";
  }
  if (/financ|juros|parcela|fgts|banco|cr[eé]dito|entrada|contrato|documenta[cç][aã]o|an[aá]lise/.test(txt)) {
    return local ? "Fortaleza real estate contract signing" : "couple signing home purchase contract brazil";
  }
  if (/comprador|comprar|compra|cliente|atendimento|corretor|venda|vender|propriet[aá]rio|capta[cç][aã]o/.test(txt)) {
    return local ? "Fortaleza real estate agent showing apartment" : "real estate agent showing apartment brazil";
  }
  if (/alto padr[aã]o|luxo|sofistic|premium/.test(txt)) {
    return local ? "Fortaleza luxury apartment interior" : "luxury apartment interior brazil";
  }
  if (/invest|aluguel|loca[cç][aã]o|renda/.test(txt)) {
    return local ? "Fortaleza apartment for rent exterior" : "apartment for rent exterior brazil";
  }
  if (local) {
    return LUGARES_FORTALEZA[(i + Math.floor(Math.random() * LUGARES_FORTALEZA.length)) % LUGARES_FORTALEZA.length];
  }
  return i % 2 === 0 ? "modern apartment living room brazil" : "real estate agent with house keys brazil";
}

function promptBuscaImagens(contexto: string, slides: Slide[]) {
  const lista = slides.map((s, i) => `${i + 1}. ${s.titulo ?? ""} — ${(s.corpo ?? "").slice(0, 160)}`).join("\n");
  return `Você escolhe fotos REAIS de banco de imagens para um carrossel de Instagram de um corretor de imóveis no Brasil.
Contexto: ${contexto || "mercado imobiliário"}
Slides:
${lista}

Para cada slide, escreva UMA busca curta (2 a 5 palavras) que traga uma foto real, bonita e relacionada ao assunto do slide.
Priorize fotos diretamente ligadas a imóveis e ao trabalho do corretor: fachada de prédio, sala, cozinha, varanda, quarto, condomínio,
corretor mostrando imóvel, visita, entrega de chaves, assinatura de contrato, casal comprando imóvel, detalhes de casa/apartamento.
Use Fortaleza só quando o slide falar de bairro, localização, vista, região, mercado local ou quando uma foto local realmente ajudar.
Evite transformar metade do carrossel em paisagem da cidade. Fortaleza deve aparecer mais como contexto imobiliário
(ex.: "Fortaleza apartment building facade", "Meireles apartment balcony", "Fortaleza real estate street view")
do que como ponto turístico genérico.
As buscas devem ser em INGLÊS e curtas, sempre ligadas ao assunto do slide (ex.: "modern apartment living room", "real estate agent showing apartment",
"couple signing home contract", "apartment building facade", "house keys handover").
Não repita a mesma busca em dois slides. Evite pessoas olhando pra câmera, skyline genérico, praia sem relação com imóvel e qualquer coisa com texto.
Responda SÓ com um array JSON de strings, na mesma ordem dos slides.`;
}

function extrairTermos(txt: string, slides: Slide[], fallback: string[]) {
  const inicio = txt.indexOf("[");
  const fim = txt.lastIndexOf("]");
  if (inicio < 0 || fim < inicio) return null;
  const arr = JSON.parse(txt.slice(inicio, fim + 1));
  if (!Array.isArray(arr) || arr.length !== slides.length) return null;
  return arr.map((q: unknown, i: number) => String(q || fallback[i]));
}

async function termosAnthropic(prompt: string, slides: Slide[], fallback: string[]) {
  if (!ANTHROPIC) return null;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error("Anthropic " + r.status);
  const d = await r.json() as { content?: Array<{ text?: string }> };
  return extrairTermos(d?.content?.[0]?.text ?? "", slides, fallback);
}

async function termosOpenAI(prompt: string, slides: Slide[], fallback: string[]) {
  if (!OPENAI) return null;
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error("OpenAI " + r.status);
  const d = await r.json() as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> };
  const content = d?.choices?.[0]?.message?.content;
  const txt = typeof content === "string" ? content : (content ?? []).map((p) => p.text ?? "").join("\n");
  return extrairTermos(txt, slides, fallback);
}

async function termosGemini(prompt: string, slides: Slide[], fallback: string[]) {
  if (!GEMINI) return null;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(GEMINI)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4 },
    }),
  });
  if (!r.ok) throw new Error("Gemini " + r.status);
  const d = await r.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const txt = d?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
  return extrairTermos(txt, slides, fallback);
}

// pede à IA 1 busca curta em inglês por slide (fotos de banco de imagem respondem melhor em inglês)
async function termosDeBusca(contexto: string, slides: Slide[]): Promise<string[]> {
  const fallback = slides.map((s, i) => buscaFallbackPorSlide(contexto, s, i));
  const prompt = promptBuscaImagens(contexto, slides);
  const provedores = [
    ["anthropic", termosAnthropic],
    ["openai", termosOpenAI],
    ["gemini", termosGemini],
  ] as const;
  try {
    for (const [nome, fn] of provedores) {
      try {
        const termos = await fn(prompt, slides, fallback);
        if (termos) return termos;
      } catch (e) {
        console.error("termos:" + nome, e);
      }
    }
  } catch (e) { console.error("termos:", e); }
  return fallback;
}

const base = (u: string) => (u || "").split("?")[0];

async function buscarUnsplash(q: string, usados: Set<string>) {
  const u = new URL("https://api.unsplash.com/search/photos");
  u.searchParams.set("query", q);
  if (!ehFortaleza(q)) u.searchParams.set("orientation", "portrait");   // Fortaleza tem menos fotos: aceita horizontal (o recorte 4:5 é feito pela CDN)
  u.searchParams.set("content_filter", "high");
  u.searchParams.set("per_page", "20");
  const r = await fetch(u, { headers: { Authorization: `Client-ID ${UNSPLASH}`, "Accept-Version": "v1" } });
  if (!r.ok) throw new HttpError(502, "Banco de fotos indisponível (" + r.status + ").");
  const d = await r.json();
  // deno-lint-ignore no-explicit-any
  const foto = sortear((d.results ?? []).filter((p: any) => !usados.has("u" + p.id) && !usados.has(base(p.urls.raw)) && p.width >= 1080));
  if (!foto) return null;
  usados.add("u" + foto.id);
  // regra da API do Unsplash: avisar o "download" quando a foto é escolhida pra uso
  fetch(foto.links.download_location, { headers: { Authorization: `Client-ID ${UNSPLASH}` } }).catch(() => {});
  // já recortada em 4:5 e 1080x1350 (alta resolução, tamanho exato do Instagram) pela CDN do Unsplash
  return {
    url: `${foto.urls.raw}&w=1080&h=1350&fit=crop&crop=entropy&q=85&fm=jpg`,
    credito: `Foto: ${foto.user?.name ?? "Unsplash"} / Unsplash`,
    // regra de atribuição do Unsplash: link pro perfil do fotógrafo com utm do app
    link: `${foto.user?.links?.html ?? "https://unsplash.com"}?utm_source=vitrine&utm_medium=referral`,
  };
}

async function buscarFoto(q: string, usados: Set<string>) {
  if (UNSPLASH) {
    const f = await buscarUnsplash(q, usados);
    if (f || !PEXELS) return f;
  }
  return await buscarPexels(q, usados);
}

async function buscarPexels(q: string, usados: Set<string>) {
  const u = new URL("https://api.pexels.com/v1/search");
  u.searchParams.set("query", q);
  if (!ehFortaleza(q)) u.searchParams.set("orientation", "portrait");
  u.searchParams.set("size", "large");          // só fotos grandes (alta resolução)
  u.searchParams.set("per_page", "20");
  const r = await fetch(u, { headers: { Authorization: PEXELS! } });
  if (!r.ok) throw new HttpError(502, "Banco de fotos indisponível (" + r.status + ").");
  const d = await r.json();
  // deno-lint-ignore no-explicit-any
  const foto = sortear((d.photos ?? []).filter((p: any) => !usados.has("p" + p.id) && !usados.has(base(p.src.original)) && p.width >= 1080));
  if (!foto) return null;
  usados.add("p" + foto.id);
  // "large2x" = ~1880px de largura, comprimida pra web; recortamos 4:5 no app
  return { url: foto.src.large2x || foto.src.original, credito: `Foto: ${foto.photographer} / Pexels`, link: foto.url };
}

Deno.serve(handle(async (req) => {
  const uid = await requireUser(req);
  // segurança/custo: só quem tem teste grátis ou plano ativo, e no máximo BUSCAS_POR_HORA chamadas por hora
  const db = admin();
  const { data: plano } = await db.from("assinaturas").select("status").eq("corretor_id", uid).in("status", ["trial", "ativa"]).maybeSingle();
  if (!plano) throw new HttpError(402, "Você não tem um plano ativo.");
  const umaHora = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db.from("buscas_imagens_log").select("id", { count: "exact", head: true }).eq("corretor_id", uid).gte("created_at", umaHora);
  if ((count ?? 0) >= BUSCAS_POR_HORA) throw new HttpError(429, "Muitas buscas de foto em pouco tempo. Espere um pouco e tente de novo.");
  await db.from("buscas_imagens_log").insert({ corretor_id: uid });
  if (!UNSPLASH && !PEXELS) throw new HttpError(500, "Chave do banco de fotos (UNSPLASH_ACCESS_KEY) não configurada no servidor.");
  const { contexto = "", slides, termos: termosDoCorretor, excluir = [] } = await req.json();
  if (!Array.isArray(slides) || !slides.length || slides.length > 10) throw new HttpError(400, "Envie de 1 a 10 slides.");

  const termos: string[] = Array.isArray(termosDoCorretor) && termosDoCorretor.length === slides.length
    ? termosDoCorretor.map((t: unknown) => String(t).slice(0, 80))
    : await termosDeBusca(String(contexto), slides);
  const usados = new Set<string>((Array.isArray(excluir) ? excluir : []).map((u: unknown) => base(String(u))));
  const imagens = [];
  for (const q of termos) {
    let foto = await buscarFoto(q, usados);
    if (!foto && ehFortaleza(q)) foto = await buscarFoto("Fortaleza apartment building", usados);
    if (!foto) foto = await buscarFoto(q.split(" ").slice(0, 3).join(" ") || "real estate property", usados);
    if (!foto) foto = await buscarFoto("real estate apartment interior", usados);
    imagens.push(foto ? { ...foto, termo: q } : null);
  }
  return json({ imagens });
}));
