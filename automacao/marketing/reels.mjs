// Agente de Reels da Vitrine — transforma o carrossel que MAIS performou nas últimas semanas num Reels 9:16
// e publica no @vitrinecorretores (ter, qui e sáb). Reels é o formato que mais leva a conta para quem ainda não segue.
// Usa o desenho da própria Vitrine em 9:16 (render.mjs) + ffmpeg (transição suave, 3 s por slide).
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Opcional: MODO=simular (só gera o vídeo em ./saida).
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderizar } from "./render.mjs";

const UID = "f13c2703-8848-485a-ae60-97e139a2b0a6";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://qbfmozumntequvecttfs.supabase.co";
const ANON_KEY = "sb_publishable_xXZFK2Pzq7MHsMv2f_iISw_yriYjMvv";
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/^["']|["']$/g, "");
const SIMULAR = process.env.MODO === "simular";
const SEG_POR_SLIDE = 3, TRANSICAO = 0.4;
if (!SERVICE) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const log = (...a) => console.log("[reels]", ...a);

async function sessao() {
  const { data: u } = await db.auth.admin.getUserById(UID);
  const { data: link, error } = await db.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (error) throw error;
  const pub = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await pub.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (e2 || !s?.session) throw e2 || new Error("Sem sessão.");
  return s.session.access_token;
}
const pontos = (m) => {
  if (!m) return 0;
  const eng = (m.salvamentos || 0) * 4 + (m.compartilhamentos || 0) * 5 + (m.comentarios || 0) * 3 + (m.curtidas || 0);
  return m.alcance > 0 ? (eng / m.alcance) * 100 + Math.log10(m.alcance + 1) : eng;
};

// vídeo 1080x1920: cada slide 3 s, com fade entre eles; trilha silenciosa (o Instagram aceita e o usuário pode pôr música)
function montarVideo(jpgs, saida) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
  const args = ["-y"];
  jpgs.forEach((b, i) => { const f = path.join(dir, `s${i}.jpg`); fs.writeFileSync(f, b); args.push("-loop", "1", "-t", String(SEG_POR_SLIDE), "-i", f); });
  const total = jpgs.length * SEG_POR_SLIDE - (jpgs.length - 1) * TRANSICAO;
  args.push("-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=r=44100:cl=stereo");
  let filtro = jpgs.map((_, i) => `[${i}:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v${i}]`).join(";");
  let ultimo = "v0";
  for (let i = 1; i < jpgs.length; i++) {
    const off = (i * (SEG_POR_SLIDE - TRANSICAO)).toFixed(2);
    filtro += `;[${ultimo}][v${i}]xfade=transition=fade:duration=${TRANSICAO}:offset=${off}[x${i}]`;
    ultimo = `x${i}`;
  }
  args.push("-filter_complex", filtro, "-map", `[${ultimo}]`, "-map", `${jpgs.length}:a`,
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "30", "-b:v", "6M",
    "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", saida);
  execFileSync(process.env.FFMPEG || "ffmpeg", args, { stdio: ["ignore", "ignore", "inherit"] });
  fs.rmSync(dir, { recursive: true, force: true });
  return { segundos: total };
}

async function main() {
  const { error: eChave } = await db.from("templates").select("id").limit(1);
  if (eChave) throw new Error("SUPABASE_SERVICE_ROLE_KEY recusada: " + eChave.message);

  if (!SIMULAR) {   // repescagem do mesmo dia não publica um segundo Reels
    const { count } = await db.from("reels_feitos").select("carrossel_origem_id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 20 * 3600e3).toISOString());
    if ((count ?? 0) > 0) { log("o Reels de hoje já foi feito — nada a fazer."); return; }
  }
  const desde = new Date(Date.now() - 30 * 86400e3).toISOString();
  const [{ data: cars }, { data: feitos }, { data: tpls }, { data: profile }, { data: assin }, { data: conta }] = await Promise.all([
    db.from("carrosseis").select("*, slides(*)").eq("corretor_id", UID).eq("status", "publicado").gte("data_publicada", desde).order("data_publicada", { ascending: false }),
    db.from("reels_feitos").select("carrossel_origem_id, reel_carrossel_id"),
    db.from("templates").select("id, slug"),
    db.from("profiles").select("id, nome, logo_url, cor_marca, marca_ativa, creci").eq("id", UID).single(),
    db.from("assinaturas").select("status").eq("corretor_id", UID).in("status", ["trial", "ativa"]).maybeSingle(),
    db.from("instagram_contas").select("id, username").eq("corretor_id", UID).eq("status", "ativo").order("principal", { ascending: false }).order("connected_at").limit(1).maybeSingle(),
  ]);
  if (!conta) throw new Error("Instagram da Vitrine desconectado.");
  const usados = new Set((feitos || []).flatMap((f) => [f.carrossel_origem_id, f.reel_carrossel_id]));
  const candidatos = (cars || []).filter((c) => !usados.has(c.id) && (c.slides || []).length >= 3 && (c.slides || []).length <= 10);
  if (!candidatos.length) { log("nenhum carrossel novo para virar Reels."); return; }
  const { data: mets } = await db.from("ig_metricas_posts").select("*").in("carrossel_id", candidatos.map((c) => c.id));
  const nota = (c) => pontos((mets || []).find((m) => m.carrossel_id === c.id));
  candidatos.sort((a, b) => nota(b) - nota(a) || String(b.data_publicada).localeCompare(String(a.data_publicada)));
  const origem = candidatos[0];
  const slides = [...origem.slides].sort((a, b) => a.ordem - b.ordem).map((s) => ({ tag: s.tag, titulo: s.titulo, corpo: s.corpo, imagem_url: s.imagem_url, imagem_prompt: s.imagem_prompt }));
  const slug = ((tpls || []).find((t) => t.id === origem.template_id) || {}).slug || "minimalista";
  log(`origem: "${String(slides[0].titulo).replace(/\*/g, "")}" (nota ${nota(origem).toFixed(2)}, estilo ${slug})`);

  const jpgs = await renderizar(slides, { slug, fonte: origem.fonte, melhorar: origem.melhorar_fotos !== false, profile, assinaturaStatus: assin?.status || null, igUsername: conta.username, alto: true });
  const arquivo = path.join(os.tmpdir(), `reel-${Date.now()}.mp4`);
  const { segundos } = montarVideo(jpgs, arquivo);
  log(`vídeo pronto: ${segundos.toFixed(1)} s`);

  if (SIMULAR) {
    fs.mkdirSync("saida", { recursive: true });
    fs.copyFileSync(arquivo, "saida/reel.mp4");
    log("SIMULAÇÃO: vídeo salvo em ./saida/reel.mp4 (nada publicado).");
    return;
  }

  // o Reels vira um carrossel próprio (assim as métricas dele não se misturam com as do original)
  const { data: novo, error: eN } = await db.from("carrosseis").insert({
    corretor_id: UID, origem: origem.origem, topico_id: origem.topico_id, propriedade_id: origem.propriedade_id,
    assunto_custom: origem.assunto_custom, categoria: origem.categoria, template_id: origem.template_id, fonte: origem.fonte,
    melhorar_fotos: origem.melhorar_fotos, legenda: origem.legenda, status: "rascunho", instagram_contas_ids: [conta.id],
  }).select("id").single();
  if (eN) throw eN;
  const { error: eS } = await db.from("slides").insert(slides.map((s, i) => ({ carrossel_id: novo.id, ordem: i, tag: s.tag, titulo: s.titulo, corpo: s.corpo, imagem_url: s.imagem_url || null, imagem_prompt: s.imagem_prompt || null })));
  if (eS) throw eS;
  const caminho = `${UID}/${novo.id}/reel-${Date.now()}.mp4`;
  const { error: eU } = await db.storage.from("slides-render").upload(caminho, fs.readFileSync(arquivo), { contentType: "video/mp4", upsert: true });
  if (eU) throw new Error("Upload do vídeo: " + eU.message);
  const video_url = `${SUPABASE_URL}/storage/v1/object/public/slides-render/${caminho}`;
  await db.from("reels_feitos").insert({ carrossel_origem_id: origem.id, reel_carrossel_id: novo.id });

  const token = await sessao();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/instagram-publicar`, {
    method: "POST", headers: { "content-type": "application/json", apikey: ANON_KEY, authorization: `Bearer ${token}` },
    body: JSON.stringify({ carrossel_id: novo.id, formato: "reels", video_url, conta_ids: [conta.id] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("instagram-publicar: " + (j.error || r.status));
  const { data: expOrig } = await db.from("marketing_experimentos").select("*").eq("carrossel_id", origem.id).maybeSingle();
  const [fonte, cor] = String(origem.fonte || "").split("|");
  await db.from("marketing_experimentos").upsert({ carrossel_id: novo.id, corretor_id: UID, formato: "reels", pilar: expOrig?.pilar || null, formula: expOrig?.formula || null, estilo: slug, cor: cor || null, fonte: fonte || null, slot: "12:10", assunto: origem.assunto_custom, por_que: "Reels do carrossel com melhor desempenho recente" }, { onConflict: "carrossel_id" });
  log(`publicado: ${j.permalink || j.media_id}`);
}

main().catch(async (e) => {
  console.error(e);
  await db.rpc("registrar_alerta", { p_tipo: "agente_reels", p_mensagem: `Agente de Reels falhou: ${String(e.message || e).slice(0, 300)}`, p_origem: "agente-reels" }).then(() => {}, () => {});
  process.exit(1);
});
