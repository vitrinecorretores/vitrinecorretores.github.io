// POST { from_email, from_name?, subject?, body_text?, body_html?, message_id?, thread_id? }
//  -> { should_reply, category, confidence, reply_to, reply_subject, reply_text, reply_html, owner_email, owner_subject, owner_text, owner_html, sources }
// Função usada pelo n8n para responder e-mails com base nas informacoes ja publicadas no site.
import { admin, APP_URL, handle, HttpError, json } from "../_shared/util.ts";

type Source = { title: string; url: string };
type ReplyTopic = {
  id: string;
  score: number;
  title: string;
  text: string;
  html: string;
  sources: Source[];
};

type PlanRow = {
  id: string;
  nome: string;
  tipo?: string | null;
  preco_mensal?: number | null;
  preco_anual?: number | null;
  max_corretores?: number | null;
};

const OWNER_FALLBACK = Deno.env.get("SUPORTE_OWNER_EMAIL") ?? "evandrotorresrj@gmail.com";
const WEBHOOK_SECRET = Deno.env.get("EMAIL_AUTOREPLY_WEBHOOK_SECRET") ?? "";
const HOME_URL = "https://vitrinecorretores.github.io/";
const LINKS = {
  home: HOME_URL,
  termos: `${HOME_URL}termos.html`,
  privacidade: `${HOME_URL}privacidade.html`,
  cancelamento: `${HOME_URL}politica-de-cancelamento.html`,
  exclusao: `${HOME_URL}exclusao-de-dados.html`,
};

function esc(s: string) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function toText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalize(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstName(name: string, email: string) {
  const base = String(name || "").trim() || String(email || "").split("@")[0].replace(/[._-]+/g, " ");
  return base.split(/\s+/)[0] || "corretor";
}

function money(v?: number | null) {
  return "R$ " + Number(v || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function monthlyEquivalent(yearly?: number | null) {
  return "R$ " + (Number(yearly || 0) / 12).toFixed(2).replace(".", ",");
}

function replySubject(subject: string) {
  const clean = String(subject || "").trim();
  if (!clean) return "Re: Sua mensagem para a Vitrine";
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

function dedupeSources(list: Source[]) {
  const seen = new Set<string>();
  return list.filter((s) => {
    if (!s?.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

async function loadPlans(): Promise<PlanRow[]> {
  const { data } = await admin().from("planos").select("id,nome,tipo,preco_mensal,preco_anual,max_corretores").order("ordem");
  return (data || []) as PlanRow[];
}

async function resolveOwner(email: string) {
  const db = admin();
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return { owner_email: OWNER_FALLBACK, owner_tipo: "plataforma" };

  const { data: profileByEmail } = await db.from("profiles").select("id,email").ilike("email", normalized).maybeSingle();
  if (profileByEmail?.id) {
    const { data: ownedTeam } = await db.from("equipes").select("dono_id").eq("dono_id", profileByEmail.id).maybeSingle();
    if (ownedTeam?.dono_id) {
      return { owner_email: profileByEmail.email || OWNER_FALLBACK, owner_tipo: "dono_equipe" };
    }
    const { data: activeMembership } = await db.from("equipe_membros").select("equipes(dono_id)").eq("corretor_id", profileByEmail.id).eq("status", "ativo").maybeSingle();
    // deno-lint-ignore no-explicit-any
    const ownerId = (activeMembership?.equipes as any)?.dono_id as string | undefined;
    if (ownerId) {
      const { data: ownerProfile } = await db.from("profiles").select("email").eq("id", ownerId).maybeSingle();
      if (ownerProfile?.email) return { owner_email: ownerProfile.email, owner_tipo: "dono_equipe" };
    }
  }

  const { data: invitedMembership } = await db.from("equipe_membros").select("equipes(dono_id)").ilike("email", normalized).in("status", ["convidado", "ativo"]).maybeSingle();
  // deno-lint-ignore no-explicit-any
  const invitedOwnerId = (invitedMembership?.equipes as any)?.dono_id as string | undefined;
  if (invitedOwnerId) {
    const { data: invitedOwnerProfile } = await db.from("profiles").select("email").eq("id", invitedOwnerId).maybeSingle();
    if (invitedOwnerProfile?.email) return { owner_email: invitedOwnerProfile.email, owner_tipo: "dono_equipe" };
  }

  return { owner_email: OWNER_FALLBACK, owner_tipo: "plataforma" };
}

function buildPlansTopic(plans: PlanRow[], q: string): ReplyTopic {
  const regular = plans.filter((p) => p.tipo !== "equipe");
  const teams = plans.filter((p) => p.tipo === "equipe");
  const wantsTeam = /\bimobiliaria\b|\bequipe\b|\bcorretor(es)?\b|\bvagas\b|\btime\b/.test(q);
  const all = wantsTeam && teams.length ? teams : regular;
  const lines = all.slice(0, 4).map((p) => {
    if (!p.preco_mensal && !p.preco_anual) return `<li><b>${esc(p.nome)}</b></li>`;
    return `<li><b>${esc(p.nome)}</b>: ${esc(money(p.preco_mensal))}/mes ou ${esc(money(p.preco_anual))}/ano. No anual, o equivalente mensal fica em ${esc(monthlyEquivalent(p.preco_anual))}.</li>`;
  }).join("");
  const textLines = all.slice(0, 4).map((p) => {
    if (!p.preco_mensal && !p.preco_anual) return `- ${p.nome}`;
    return `- ${p.nome}: ${money(p.preco_mensal)}/mes ou ${money(p.preco_anual)}/ano. No anual, o equivalente mensal fica em ${monthlyEquivalent(p.preco_anual)}.`;
  }).join("\n");
  return {
    id: wantsTeam ? "planos_imobiliaria" : "planos",
    score: wantsTeam ? 6 : 5,
    title: wantsTeam ? "Planos para imobiliarias" : "Planos da Vitrine",
    html: `<p>A Vitrine trabalha com valores mensais e anuais. Na apresentacao publica, o anual aparece com <b>2 meses gratis</b> (voce paga 10 meses e usa 12).</p><ul>${lines}</ul><p>Voce pode comparar tudo aqui: <a href="${LINKS.home}#planos">${LINKS.home}#planos</a>.</p>`,
    text: `A Vitrine trabalha com valores mensais e anuais. Na apresentacao publica, o anual aparece com 2 meses gratis (voce paga 10 meses e usa 12).\n${textLines}\n\nComparativo completo: ${LINKS.home}#planos`,
    sources: [{ title: "Planos da Vitrine", url: `${LINKS.home}#planos` }],
  };
}

function topics(q: string, plans: PlanRow[]): ReplyTopic[] {
  const list: ReplyTopic[] = [];
  const add = (cond: boolean, item: ReplyTopic) => { if (cond) list.push(item); };

  add(/\bteste\b|\bgratis\b|\btrial\b|\b3 carrosseis\b|\bsem cartao\b/.test(q), {
    id: "teste_gratis",
    score: 7,
    title: "Teste gratis",
    html: `<p>Hoje a Vitrine oferece <b>3 carrosseis gratis</b>, sem exigir cartao de credito no cadastro.</p><p>Depois disso, voce pode escolher um plano diretamente na aba <b>Plano</b> dentro do app ou na apresentacao publica: <a href="${LINKS.home}#planos">${LINKS.home}#planos</a>.</p>`,
    text: `Hoje a Vitrine oferece 3 carrosseis gratis, sem exigir cartao de credito no cadastro.\nDepois disso, voce pode escolher um plano diretamente na aba Plano dentro do app ou na apresentacao publica: ${LINKS.home}#planos`,
    sources: [{ title: "Teste gratis e planos", url: `${LINKS.home}#planos` }],
  });

  add(/\bpreco\b|\bprecos\b|\bplano\b|\bplanos\b|\bvalor\b|\bvalores\b|\bmensal\b|\banual\b|\bassinatura\b/.test(q), buildPlansTopic(plans, q));

  add(/\banual\b|\bano\b|\b12 meses\b|\b2 meses gratis\b|\beconomia\b/.test(q), {
    id: "anual",
    score: 6,
    title: "Plano anual",
    html: `<p>Na apresentacao da Vitrine, o plano anual aparece com a logica de <b>2 meses gratis</b>: voce paga o equivalente a 10 meses e usa 12.</p><p>Os valores anuais ja estao mostrados na pagina publica e, dentro da plataforma, o checkout respeita a escolha entre mensal e anual.</p>`,
    text: `Na apresentacao da Vitrine, o plano anual aparece com a logica de 2 meses gratis: voce paga o equivalente a 10 meses e usa 12.\nOs valores anuais ja estao mostrados na pagina publica e, dentro da plataforma, o checkout respeita a escolha entre mensal e anual.`,
    sources: [{ title: "Apresentacao de planos", url: `${LINKS.home}#planos` }],
  });

  add(/\bcancel(ar|amento)?\b|\breembolso\b|\bmulta\b|\bcobran(ca|ça)\b|\bchargeback\b/.test(q), {
    id: "cancelamento",
    score: 8,
    title: "Cancelamento e reembolso",
    html: `<p>O cancelamento da assinatura pode ser feito <b>sem multa</b>. A politica publicada informa que o acesso segue ate o fim do periodo ja pago, e pedidos de reembolso so sao analisados em hipoteses excepcionais e justificadas.</p><p>Os detalhes estao aqui: <a href="${LINKS.cancelamento}">${LINKS.cancelamento}</a>.</p>`,
    text: `O cancelamento da assinatura pode ser feito sem multa. A politica publicada informa que o acesso segue ate o fim do periodo ja pago, e pedidos de reembolso so sao analisados em hipoteses excepcionais e justificadas.\n\nDetalhes: ${LINKS.cancelamento}`,
    sources: [{ title: "Politica de cancelamento", url: LINKS.cancelamento }],
  });

  add(/\bprivacidade\b|\bdados\b|\blgpd\b|\bexclusao\b|\bexcluir\b|\bconta\b/.test(q), {
    id: "privacidade",
    score: 8,
    title: "Privacidade e exclusao de dados",
    html: `<p>A Vitrine publica politica de privacidade, tratamento de dados e procedimento de exclusao de conta/dados.</p><ul><li><a href="${LINKS.privacidade}">Politica de Privacidade</a></li><li><a href="${LINKS.exclusao}">Exclusao de dados</a></li></ul><p>Essas paginas explicam dados tratados, compartilhamentos necessarios e como solicitar exclusao.</p>`,
    text: `A Vitrine publica politica de privacidade, tratamento de dados e procedimento de exclusao de conta/dados.\n- Politica de Privacidade: ${LINKS.privacidade}\n- Exclusao de dados: ${LINKS.exclusao}\n\nEssas paginas explicam dados tratados, compartilhamentos necessarios e como solicitar exclusao.`,
    sources: [
      { title: "Politica de Privacidade", url: LINKS.privacidade },
      { title: "Exclusao de dados", url: LINKS.exclusao },
    ],
  });

  add(/\binstagram\b|\bpublica(r|cao)\b|\breels\b|\bstories\b|\bfeed\b|\bconectar\b|\bprofissional\b/.test(q), {
    id: "instagram",
    score: 7,
    title: "Instagram",
    html: `<p>A Vitrine permite conectar uma conta do Instagram <b>Profissional</b> (Empresa ou Criador) e publicar no <b>feed, Reels e Stories</b>, sempre com previa antes.</p><p>Na pagina publica tambem esta explicado que a conexao acontece uma vez e depois os carrosseis podem ir direto para o Instagram.</p>`,
    text: `A Vitrine permite conectar uma conta do Instagram Profissional (Empresa ou Criador) e publicar no feed, Reels e Stories, sempre com previa antes.\nNa pagina publica tambem esta explicado que a conexao acontece uma vez e depois os carrosseis podem ir direto para o Instagram.`,
    sources: [{ title: "Vitrine e Instagram", url: LINKS.home }],
  });

  add(/\bfoto\b|\bfotos\b|\bimagem\b|\bimagens\b|\blicenca\b|\bcomercial\b|\bunsplash\b|\bpexels\b/.test(q), {
    id: "fotos",
    score: 6,
    title: "Fotos e licencas",
    html: `<p>O site informa que as imagens usadas nos carrosseis sao <b>fotos de banco de imagens profissional com licenca livre para uso comercial</b>. Se preferir, o corretor pode trocar por foto propria.</p>`,
    text: `O site informa que as imagens usadas nos carrosseis sao fotos de banco de imagens profissional com licenca livre para uso comercial. Se preferir, o corretor pode trocar por foto propria.`,
    sources: [{ title: "FAQ sobre fotos", url: `${LINKS.home}#duvidas` }],
  });

  add(/\bimobiliaria\b|\bequipe\b|\bcorretor(es)?\b|\bconvite\b|\bvaga\b|\bdono\b/.test(q), {
    id: "equipes",
    score: 7,
    title: "Planos de imobiliaria",
    html: `<p>A Vitrine tem planos para imobiliarias: o dono assina, convida a equipe por link e cada corretor usa a propria conta com tudo do plano Pro.</p><p>Na pagina publica tambem esta indicado que o dono da conta conta como 1 corretor nas vagas do plano.</p>`,
    text: `A Vitrine tem planos para imobiliarias: o dono assina, convida a equipe por link e cada corretor usa a propria conta com tudo do plano Pro.\nNa pagina publica tambem esta indicado que o dono da conta conta como 1 corretor nas vagas do plano.`,
    sources: [{ title: "Planos para imobiliarias", url: `${LINKS.home}#imobiliarias` }],
  });

  add(/\bcomo funciona\b|\bfunciona\b|\bcanva\b|\bdesign\b|\bcarrossel\b|\bpost\b/.test(q), {
    id: "como_funciona",
    score: 5,
    title: "Como a Vitrine funciona",
    html: `<p>A Vitrine foi feita para o corretor criar carrosseis sem depender de design manual: voce escolhe o assunto, revisa a previa, ajusta fonte/cor se quiser e pode publicar ou agendar.</p><p>Na FAQ publica tambem esta claro que nao precisa saber design nem usar Canva para operar o fluxo basico.</p>`,
    text: `A Vitrine foi feita para o corretor criar carrosseis sem depender de design manual: voce escolhe o assunto, revisa a previa, ajusta fonte/cor se quiser e pode publicar ou agendar.\nNa FAQ publica tambem esta claro que nao precisa saber design nem usar Canva para operar o fluxo basico.`,
    sources: [{ title: "Como funciona", url: LINKS.home }],
  });

  if (!list.length) {
    list.push({
      id: "geral",
      score: 2,
      title: "Links principais",
      html: `<p>Analisei sua mensagem e, como primeira resposta automatica, separei os links oficiais da Vitrine que costumam cobrir as duvidas mais comuns:</p><ul><li><a href="${LINKS.home}">Apresentacao e planos</a></li><li><a href="${LINKS.cancelamento}">Politica de cancelamento</a></li><li><a href="${LINKS.privacidade}">Politica de privacidade</a></li><li><a href="${LINKS.exclusao}">Exclusao de dados</a></li><li><a href="${LINKS.termos}">Termos de uso</a></li></ul><p>Se a sua solicitacao depender de analise manual ou dado especifico da sua conta, seguimos por este mesmo e-mail.</p>`,
      text: `Analisei sua mensagem e, como primeira resposta automatica, separei os links oficiais da Vitrine que costumam cobrir as duvidas mais comuns:\n- Apresentacao e planos: ${LINKS.home}\n- Politica de cancelamento: ${LINKS.cancelamento}\n- Politica de privacidade: ${LINKS.privacidade}\n- Exclusao de dados: ${LINKS.exclusao}\n- Termos de uso: ${LINKS.termos}\n\nSe a sua solicitacao depender de analise manual ou dado especifico da sua conta, seguimos por este mesmo e-mail.`,
      sources: [
        { title: "Home", url: LINKS.home },
        { title: "Termos", url: LINKS.termos },
        { title: "Privacidade", url: LINKS.privacidade },
        { title: "Cancelamento", url: LINKS.cancelamento },
        { title: "Exclusao de dados", url: LINKS.exclusao },
      ],
    });
  }

  return list.sort((a, b) => b.score - a.score);
}

function shouldIgnore(fromEmail: string, subject: string, body: string) {
  const joined = `${fromEmail} ${subject} ${body}`;
  return /mailer-daemon|postmaster|no-?reply|noreply|auto.?reply|delivery status notification|undeliverable/i.test(joined);
}

function buildReply(name: string, email: string, subject: string, items: ReplyTopic[]) {
  const saudacao = esc(firstName(name, email));
  const top = items.slice(0, 2);
  const sources = dedupeSources(top.flatMap((i) => i.sources));
  const confidence = Math.min(100, top.reduce((sum, i) => sum + i.score * 10, 0));
  const category = top.map((i) => i.id).join(",");
  const bodyHtml = top.map((i) => `<h3 style="font-size:16px;margin:18px 0 8px;color:#101225;">${esc(i.title)}</h3>${i.html}`).join("");
  const sourcesHtml = sources.length
    ? `<p style="margin:18px 0 6px;"><b>Links oficiais usados nesta resposta:</b></p><ul>${sources.map((s) => `<li><a href="${s.url}">${esc(s.title)}</a></li>`).join("")}</ul>`
    : "";
  const footerHtml = `<p style="margin-top:18px;">Se a sua solicitacao depender de analise manual da conta, faturamento ou algum caso fora do material publico, basta responder este mesmo e-mail.</p><p>Atenciosamente,<br>Equipe Vitrine<br><a href="${HOME_URL}">${HOME_URL}</a></p>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a2e"><p>Ola, ${saudacao}.</p><p>Analisei sua mensagem e abaixo esta a melhor resposta automatica com base nas informacoes oficiais ja publicadas pela Vitrine.</p>${bodyHtml}${sourcesHtml}${footerHtml}</div>`;
  return {
    category,
    confidence,
    reply_subject: replySubject(subject),
    reply_html: html,
    reply_text: toText(html),
    sources,
  };
}

async function logReply(payload: Record<string, unknown>) {
  try { await admin().from("email_auto_respostas").insert(payload); }
  catch (e) { console.error("email_auto_respostas:", e); }
}

Deno.serve(handle(async (req) => {
  if (WEBHOOK_SECRET) {
    const sent = req.headers.get("x-email-webhook-secret") ?? "";
    if (sent !== WEBHOOK_SECRET) throw new HttpError(401, "Webhook nao autorizado.");
  }

  const body = await req.json().catch(() => ({}));
  const from_email = String(body.from_email || "").trim().toLowerCase();
  const from_name = String(body.from_name || "").trim();
  const subject = String(body.subject || "").trim();
  const body_text = String(body.body_text || body.body_html || "").trim();
  const message_id = String(body.message_id || "").trim();
  const thread_id = String(body.thread_id || "").trim();

  if (!from_email) throw new HttpError(400, "from_email obrigatorio.");
  if (!body_text && !subject) throw new HttpError(400, "Mensagem vazia.");

  const owner = await resolveOwner(from_email);
  const normalized = normalize(`${subject} ${body_text}`);

  if (shouldIgnore(from_email, subject, body_text)) {
    const response = {
      should_reply: false,
      category: "ignorado",
      confidence: 100,
      reply_to: from_email,
      reply_subject: replySubject(subject),
      reply_text: "",
      reply_html: "",
      owner_email: owner.owner_email,
      owner_subject: `E-mail ignorado automaticamente - ${from_email}`,
      owner_text: `O remetente ${from_email} foi ignorado pela regra anti-loop.`,
      owner_html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a2e"><p>O remetente <b>${esc(from_email)}</b> foi ignorado pela regra anti-loop.</p></div>`,
      sources: [] as Source[],
    };
    await logReply({
      remetente_email: from_email,
      remetente_nome: from_name,
      assunto: subject,
      corpo_texto: body_text.slice(0, 10000),
      categoria: response.category,
      confianca: response.confidence,
      status: "ignorado",
      resposta_assunto: response.reply_subject,
      destinatario_resposta: from_email,
      owner_email: owner.owner_email,
      owner_tipo: owner.owner_tipo,
      message_id,
      thread_id,
      fontes: response.sources,
      meta: { motivo: "anti_loop" },
    });
    return json(response);
  }

  const plans = await loadPlans();
  const picked = topics(normalized, plans);
  const reply = buildReply(from_name, from_email, subject, picked);

  const ownerHtml = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a2e">
    <p>A Vitrine respondeu automaticamente um e-mail de suporte.</p>
    <p><b>Para:</b> ${esc(from_email)}<br><b>Assunto original:</b> ${esc(subject || "(sem assunto)")}<br><b>Categoria:</b> ${esc(reply.category)}<br><b>Confianca:</b> ${reply.confidence}%</p>
    <p><b>Trecho da solicitacao:</b><br>${esc(body_text.slice(0, 600) || "(sem corpo)")}</p>
    <p><b>Resposta enviada:</b></p>
    <div style="padding:12px 14px;border:1px solid #d9deff;border-radius:12px;background:#f8f9ff;">${reply.reply_html}</div>
  </div>`;
  const ownerText = [
    "A Vitrine respondeu automaticamente um e-mail de suporte.",
    `Para: ${from_email}`,
    `Assunto original: ${subject || "(sem assunto)"}`,
    `Categoria: ${reply.category}`,
    `Confianca: ${reply.confidence}%`,
    "",
    "Trecho da solicitacao:",
    body_text.slice(0, 600) || "(sem corpo)",
    "",
    "Resposta enviada:",
    reply.reply_text,
  ].join("\n");

  await logReply({
    remetente_email: from_email,
    remetente_nome: from_name,
    assunto: subject,
    corpo_texto: body_text.slice(0, 10000),
    categoria: reply.category,
    confianca: reply.confidence,
    status: "respondido",
    resposta_assunto: reply.reply_subject,
    resposta_texto: reply.reply_text,
    resposta_html: reply.reply_html,
    destinatario_resposta: from_email,
    owner_email: owner.owner_email,
    owner_tipo: owner.owner_tipo,
    message_id,
    thread_id,
    fontes: reply.sources,
    meta: { app_url: APP_URL },
  });

  return json({
    should_reply: true,
    category: reply.category,
    confidence: reply.confidence,
    reply_to: from_email,
    reply_subject: reply.reply_subject,
    reply_text: reply.reply_text,
    reply_html: reply.reply_html,
    owner_email: owner.owner_email,
    owner_subject: `Resumo da autoresposta - ${from_email}`,
    owner_text: ownerText,
    owner_html: ownerHtml,
    sources: reply.sources,
  });
}));
