(function () {
  "use strict";

  /* ============================================================
     CONFIG
  ============================================================ */
  var SUPABASE_URL = "https://qbfmozumntequvecttfs.supabase.co";
  var SUPABASE_KEY = "sb_publishable_xXZFK2Pzq7MHsMv2f_iISw_yriYjMvv";
  var FN_URL = SUPABASE_URL + "/functions/v1/gerar-conteudo";

  /* ============================================================
     HELPERS
  ============================================================ */
  function fmtBRL(v) { v = Number(v) || 0; return "R$ " + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function fmtDate(d) { if (!d) return "—"; d = new Date(d); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  function fmtDateTime(d) { if (!d) return "—"; d = new Date(d); return fmtDate(d) + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return d; }
  // escapa também aspas simples/duplas: o valor às vezes é inserido dentro de atributos HTML
  // (src="...", value="...", data-*="..."), não só entre tags — sem isso um valor com aspas
  // quebraria o atributo e permitiria injetar HTML/JS (XSS). Ver revisão de segurança de 09/09/2026.
  function escapeHtml(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  // só aceita links http(s) — bloqueia "javascript:", "data:" etc. em href/src vindos do banco ou de APIs
  function safeUrl(u) { try { var x = new URL(String(u || ""), location.href); return (x.protocol === "https:" || x.protocol === "http:") ? x.href : ""; } catch (e) { return ""; } }
  // redireciona só pra hosts conhecidos (Stripe Checkout, Instagram OAuth)
  function irPara(u, hostsOk) { var x = safeUrl(u); var h = x ? new URL(x).hostname : ""; if (!x || hostsOk.indexOf(h) < 0 || x.indexOf("https:") !== 0) throw new Error("Endereço de redirecionamento inválido."); window.location.href = x; }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var ICONS = {
    bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/><path d="M3 18v2M21 18v2M3 13h18"/><path d="M7 13V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4"/></svg>',
    car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l1.6-4.8A2 2 0 0 1 6.5 7h11a2 2 0 0 1 1.9 1.2L21 13"/><rect x="2.5" y="13" width="19" height="5.5" rx="1.5"/><circle cx="7" cy="18.5" r="1.4"/><circle cx="17" cy="18.5" r="1.4"/></svg>',
    ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v3M15 8v3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l10-10"/><path d="M14 10l6-6"/><path d="M17 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M6 15l.7 1.5L8 17l-1.3.7L6 19l-.7-1.3L4 17l1.3-.5z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="0.7" fill="currentColor" stroke="none"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5 11-11"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5"/></svg>'
  };

  function propCoverSvg(tipo) {
    var grads = { apartamento: ["#4F7BFF", "#8B5CFF"], terreno: ["#0B1B3A", "#8B5CFF"], casa: ["#8B5CFF", "#00E0FF"] };
    var g = grads[tipo] || grads.apartamento;
    var shape = tipo === "terreno"
      ? '<path d="M20 78 L44 30 L60 52 L74 26 L100 78 Z" fill="rgba(255,255,255,0.9)"/><circle cx="86" cy="24" r="7" fill="rgba(255,255,255,0.9)"/>'
      : '<path d="M20 80 V44 L60 20 L100 44 V80 Z" fill="rgba(255,255,255,0.92)"/><rect x="52" y="58" width="16" height="22" fill="' + g[0] + '"/><rect x="30" y="52" width="12" height="12" fill="' + g[0] + '"/><rect x="78" y="52" width="12" height="12" fill="' + g[0] + '"/>';
    return '<svg viewBox="0 0 120 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')">' + shape + '</svg>';
  }
  function topicCoverSvg(categoria) {
    var g = { Dicas: ["#8B5CFF", "#00E0FF"], Financiamento: ["#0B1B3A", "#8B5CFF"], Vendas: ["#4F7BFF", "#00E0FF"], Mercado: ["#080A10", "#8B5CFF"] }[categoria] || ["#8B5CFF", "#00E0FF"];
    var shape;
    if (categoria === "Financiamento") shape = '<circle cx="40" cy="66" r="16" fill="rgba(255,255,255,0.92)"/><circle cx="62" cy="52" r="16" fill="rgba(255,255,255,0.75)"/><circle cx="86" cy="66" r="16" fill="rgba(255,255,255,0.92)"/>';
    else if (categoria === "Vendas") shape = '<path d="M18 74 L40 54 L56 66 L96 24" stroke="rgba(255,255,255,0.95)" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M78 24 H96 V42" stroke="rgba(255,255,255,0.95)" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    else if (categoria === "Mercado") shape = '<rect x="18" y="46" width="14" height="34" fill="rgba(255,255,255,0.85)"/><rect x="38" y="30" width="14" height="50" fill="rgba(255,255,255,0.95)"/><rect x="58" y="52" width="14" height="28" fill="rgba(255,255,255,0.8)"/><rect x="78" y="20" width="14" height="60" fill="rgba(255,255,255,0.92)"/>';
    else shape = '<circle cx="60" cy="48" r="20" fill="rgba(255,255,255,0.92)"/><path d="M60 76v8M40 88h40" stroke="rgba(255,255,255,0.92)" stroke-width="6" stroke-linecap="round"/><path d="M52 48l6 6 10-12" stroke="' + g[0] + '" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    return '<svg viewBox="0 0 120 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="background:linear-gradient(135deg,' + g[0] + ',' + g[1] + ')">' + shape + '</svg>';
  }
  function customCoverSvg() {
    return '<svg viewBox="0 0 120 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="background:linear-gradient(135deg,#0B1B3A,#00E0FF)">' +
      '<circle cx="60" cy="50" r="6" fill="rgba(255,255,255,0.95)"/>' +
      '<path d="M60 50L30 20M60 50L90 20M60 50L24 60M60 50L96 60M60 50L34 84M60 50L86 84" stroke="rgba(255,255,255,0.65)" stroke-width="4" stroke-linecap="round"/></svg>';
  }

  // capa gerada por IA de verdade (Pollinations.ai — grátis, sem chave): monta o <img>, com o SVG como fallback caso a imagem falhe.
  function imgWithFallback(url, fallbackSvg) {
    var id = "img" + Math.random().toString(36).slice(2, 9);
    window.__vitrineFallback = window.__vitrineFallback || {};
    window.__vitrineFallback[id] = fallbackSvg;
    // sem onerror inline (permite CSP sem 'unsafe-inline'); o fallback é tratado por um listener global de "error"
    return '<img src="' + escapeHtml(safeUrl(url)) + '" alt="" loading="lazy" data-fb="' + id + '">';
  }
  function pollinationsUrl(prompt, w, h) {
    return "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=" + (w || 480) + "&height=" + (h || 600) + "&nologo=true";
  }
  // foto REAL de fundo de cada slide (banco de fotos Pexels, alta resolução) — nunca imagem gerada por IA.
  function isFotoReal(url) { return !!url && !/pollinations\.ai/.test(url); }
  function slideImageUrl(slide) { return isFotoReal(slide.imagem_url) ? slide.imagem_url : null; }

  // busca no servidor fotos reais pros slides que ainda não têm; grava no próprio objeto (e no banco, se já salvos)
  // termosFixos (opcional): buscas de foto já decididas (ex.: data comemorativa → "mother playing with child"), sem IA
  async function garantirFotosReais(slides, contexto, salvarNoBanco, termosFixos) {
    var faltando = slides.map(function (s, i) { return { s: s, i: i }; }).filter(function (x) { return !isFotoReal(x.s.imagem_url); });
    if (!faltando.length) return;
    var corpoReq = {
      contexto: contexto || "",
      slides: faltando.map(function (x) { return { titulo: x.s.titulo, corpo: x.s.corpo }; })
    };
    if (termosFixos && termosFixos.length) corpoReq.termos = faltando.map(function (x) { return termosFixos[x.i % termosFixos.length]; });
    var resp = await callFunction("buscar-imagens", corpoReq);
    for (var k = 0; k < faltando.length; k++) {
      var foto = (resp.imagens || [])[k];
      if (!foto) continue;
      aplicarFoto(faltando[k].s, foto);
      if (salvarNoBanco) await salvarFotoDoSlide(faltando[k].s);
    }
  }
  // imagem_prompt guarda "crédito||link do fotógrafo" (o Unsplash exige crédito com link sempre que a foto aparece)
  function aplicarFoto(slide, foto) {
    slide._vistas = (slide._vistas || []).concat(slide.imagem_url ? [slide.imagem_url] : []);
    slide.imagem_url = foto.url;
    if (foto.termo) slide._termo = foto.termo;   // reaproveitado no "Trocar" (pula a IA)
    slide.imagem_prompt = (foto.credito || "") + "||" + (foto.link || "");
  }
  async function salvarFotoDoSlide(slide) {
    if (!slide.id) return;
    try { await DB.update("slides", "id=eq." + slide.id, { imagem_url: slide.imagem_url, imagem_prompt: slide.imagem_prompt }); } catch (e) { }
  }
  function igLink(u) { var x = safeUrl(u); return /^https:\/\/(www\.)?instagram\.com\//.test(x) ? x : ""; }
  function creditoDe(slide) {
    if (!isFotoReal(slide.imagem_url)) return null;
    var partes = String(slide.imagem_prompt || "").split("||");
    return { texto: partes[0] || "Foto", link: partes[1] || "" };
  }

  // ✨ Melhorar fotos: auto-ajuste no canvas (fotos.js); guardado por carrossel (carrosseis.melhorar_fotos)
  function melhorarToggleHtml(ligado) {
    return '<label class="melhorar-toggle" title="Níveis automáticos, sombras mais claras, cores mais vivas e céu mais azul"><input type="checkbox" data-melhorar' + (ligado !== false ? " checked" : "") + '> <span>✨ Melhorar fotos</span> <em>ajuste automático de luz e cor</em></label>';
  }

  // controles de foto por slide: trocar (outra foto do banco), buscar por termo, ou enviar a própria foto
  function fotoControlsHtml(slides) {
    return '<div class="fotos-ctl">' + slides.map(function (s, i) {
      var cr = creditoDe(s);
      var crLink = cr ? safeUrl(cr.link) : "";
      var credHtml = cr ? (crLink ? '<a href="' + escapeHtml(crLink) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(cr.texto) + '</a>' : escapeHtml(cr.texto)) : '<span class="sem">sem foto</span>';
      return '<div class="foto-ctl"><div class="foto-top"><span class="mono">' + (i + 1) + '</span><span class="cred">' + credHtml + '</span></div>' +
        '<div class="foto-btns">' +
        '<button type="button" class="btn btn-ghost btn-xs" data-foto-trocar="' + i + '">Trocar</button>' +
        '<button type="button" class="btn btn-ghost btn-xs" data-foto-buscar="' + i + '">Buscar…</button>' +
        '<label class="btn btn-ghost btn-xs">Minha foto<input type="file" accept="image/jpeg,image/png,image/webp" data-foto-up="' + i + '" hidden></label>' +
        '</div></div>';
    }).join("") + '</div>';
  }
  function wireFotoControls(root, slides, contexto, persistir, redesenhar) {
    async function trocar(i, termo, btn) {
      var s = slides[i], orig = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = '<div class="spin"></div>';
      try {
        var body = { contexto: contexto, slides: [{ titulo: s.titulo, corpo: s.corpo }], excluir: (s._vistas || []).concat(s.imagem_url ? [s.imagem_url] : []) };
        if (termo || s._termo) body.termos = [termo || s._termo];   // sem chamar a IA de novo quando já sabemos o termo
        var resp = await callFunction("buscar-imagens", body);
        var foto = (resp.imagens || [])[0];
        if (!foto) { toast("Não achei outra foto pra esse slide — tente “Buscar…” com outras palavras."); return; }
        aplicarFoto(s, foto);
        if (persistir) await salvarFotoDoSlide(s);
        redesenhar();
      } catch (err) { toast("Erro ao buscar foto: " + err.message); }
      finally { btn.disabled = false; btn.innerHTML = orig; }
    }
    qsa("[data-foto-trocar]", root).forEach(function (b) { b.onclick = function () { trocar(+b.dataset.fotoTrocar, null, b); }; });
    qsa("[data-foto-buscar]", root).forEach(function (b) {
      b.onclick = function () {
        var t = window.prompt("Buscar foto por (ex.: varanda com vista para o mar, casal recebendo as chaves):");
        if (t && t.trim()) trocar(+b.dataset.fotoBuscar, t.trim(), b);
      };
    });
    qsa("[data-foto-up]", root).forEach(function (inp) {
      inp.onchange = async function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        if (f.size > 15 * 1024 * 1024) { toast("Foto muito grande (máx. 15 MB)."); return; }
        if (["image/jpeg", "image/png", "image/webp"].indexOf(f.type) < 0) { toast("Envie a foto em JPG, PNG ou WEBP."); return; }
        try {
          toast("Enviando sua foto…");
          var ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
          var url = await uploadArquivo(f, state.profile.id + "/fotos/" + Date.now() + "." + ext, f.type);
          var s = slides[+inp.dataset.fotoUp];
          aplicarFoto(s, { url: url, credito: "Foto do corretor", link: "" });
          if (persistir) await salvarFotoDoSlide(s);
          redesenhar();
        } catch (err) { toast("Erro ao enviar a foto: " + err.message); }
      };
    });
  }

  function contextoDoCarrossel(c) {
    if (c.origem === "imovel") { var p = findProp(c.propriedade_id); return p ? (p.tipo || "imóvel") + " em " + (p.bairro || "") + ", " + (p.cidade || "") : ""; }
    if (c.origem === "topico") { var t = findTopic(c.topico_id); return t ? "mercado imobiliário, " + t.categoria + ": " + t.gancho : ""; }
    return "mercado imobiliário, " + (c.categoria || "") + ": " + (c.assunto_custom || "");
  }

  function aiCoverImg(prompt, fallbackSvg) {
    return imgWithFallback(pollinationsUrl(prompt), fallbackSvg);
  }
  function coverPromptFor(kind, data) {
    var base = "professional real estate instagram photo, ";
    if (kind === "property") {
      return base + (data.tipo || "apartamento") + " interior, " + (data.bairro || "") + " brazil, bright natural light, editorial photography, no text, no watermark";
    }
    if (kind === "topic") {
      return base + "brazilian real estate market concept for '" + (data.categoria || "") + "', modern minimal composition, no text, no watermark";
    }
    return base + "brazilian real estate, modern minimal composition, no text, no watermark";
  }

  /* ============================================================
     AUTH — GoTrue REST, sessão persistida em localStorage
  ============================================================ */
  var Auth = (function () {
    var session = null;
    function load() {
      try { var raw = localStorage.getItem("vitrine-session"); if (raw) session = JSON.parse(raw); } catch (e) { }
      return session;
    }
    function persist() {
      try {
        if (session) localStorage.setItem("vitrine-session", JSON.stringify(session));
        else localStorage.removeItem("vitrine-session");
      } catch (e) { }
    }
    function setSession(s) { session = s; persist(); }
    function get() { return session; }
    function isExpired() {
      if (!session || !session.expires_at) return true;
      return Date.now() / 1000 > (session.expires_at - 30);
    }
    async function authFetch(path, body) {
      var res = await fetch(SUPABASE_URL + "/auth/v1/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify(body)
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error_description || data.msg || data.error || "Falha na autenticação.");
      return data;
    }
    async function signUp(email, password, nome, telefone) {
      var data = await authFetch("signup", { email: email, password: password, data: { nome: nome, telefone: telefone || "" } });
      if (data.access_token) setSession(data);
      return data;
    }
    async function signIn(email, password) {
      var data = await authFetch("token?grant_type=password", { email: email, password: password });
      setSession(data);
      return data;
    }
    async function refresh() {
      if (!session || !session.refresh_token) throw new Error("Sem sessão.");
      var data = await authFetch("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
      setSession(data);
      return data;
    }
    async function signOut() {
      if (session && session.access_token) {
        try {
          await fetch(SUPABASE_URL + "/auth/v1/logout", {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + session.access_token }
          });
        } catch (e) { }
      }
      setSession(null);
    }
    async function ensureValidToken() {
      if (!session) return null;
      if (isExpired()) { try { await refresh(); } catch (e) { setSession(null); } }
      return session ? session.access_token : null;
    }
    return { load: load, get: get, setSession: setSession, signUp: signUp, signIn: signIn, signOut: signOut, refresh: refresh, ensureValidToken: ensureValidToken };
  })();

  /* ============================================================
     DB — PostgREST helper
  ============================================================ */
  var DB = {
    async rest(path, opts) {
      opts = opts || {};
      await Auth.ensureValidToken();
      var s = Auth.get();
      var headers = Object.assign({
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + (s && s.access_token ? s.access_token : SUPABASE_KEY),
        "Content-Type": "application/json"
      }, opts.headers || {});
      var res = await fetch(SUPABASE_URL + "/rest/v1/" + path, { method: opts.method || "GET", headers: headers, body: opts.body });
      if (!res.ok) {
        var errText = await res.text().catch(function () { return res.statusText; });
        // mensagens do banco (ex.: limite do teste grátis) vêm em JSON: mostra só o texto
        try { var ej = JSON.parse(errText); if (ej && ej.code === "P0001" && ej.message) errText = ej.message; } catch (e) { }
        throw new Error(errText || ("Erro " + res.status));
      }
      if (res.status === 204) return null;
      var text = await res.text();
      return text ? JSON.parse(text) : null;
    },
    select(table, query) { return this.rest(table + "?" + (query || "select=*"), { method: "GET" }); },
    insert(table, data, opts) {
      opts = opts || {};
      return this.rest(table, { method: "POST", body: JSON.stringify(data), headers: { Prefer: (opts.minimal ? "return=minimal" : "return=representation") } });
    },
    update(table, query, data) {
      return this.rest(table + "?" + query, { method: "PATCH", body: JSON.stringify(data), headers: { Prefer: "return=representation" } });
    },
    upsert(table, data, onConflict) {
      return this.rest(table + "?on_conflict=" + onConflict, { method: "POST", body: JSON.stringify(data), headers: { Prefer: "resolution=merge-duplicates,return=representation" } });
    },
    del(table, query) { return this.rest(table + "?" + query, { method: "DELETE" }); }
  };

  async function callFunction(name, payload) {
    await Auth.ensureValidToken();
    var s = Auth.get();
    var res = await fetch(SUPABASE_URL + "/functions/v1/" + name, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + (s && s.access_token ? s.access_token : SUPABASE_KEY) },
      body: JSON.stringify(payload)
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || "Erro ao chamar o servidor.");
    return data;
  }

  /* ============================================================
     ESTADO EM MEMÓRIA (carregado do Supabase)
  ============================================================ */
  var state = {
    profile: null,
    assinatura: null,
    plano: null,
    planos: [],
    propriedades: [],
    carrosseis: [],
    topicos: [],
    templates: [],
    igConta: null, igContas: [],
    autoReply: null
  };

  function findProp(id) { return state.propriedades.find(function (p) { return p.id === id; }); }
  function findTopic(id) { return state.topicos.find(function (t) { return t.id === id; }); }
  function findTemplateBySlug(slug) { return state.templates.find(function (t) { return t.slug === slug; }); }
  function findTemplateById(id) { return state.templates.find(function (t) { return t.id === id; }); }
  function findPlano(id) { return state.planos.find(function (p) { return p.id === id; }); }

  function getSubjectMeta(c) {
    var meta;
    var slide0 = (c.slides && c.slides[0]) || null;
    var tituloSalvo = slide0 && slide0.titulo ? String(slide0.titulo).trim() : "";
    var corpoSalvo = slide0 && slide0.corpo ? String(slide0.corpo).trim() : "";
    if (c.origem === "topico") {
      var t = findTopic(c.topico_id);
      meta = {
        titulo: t ? t.gancho : (tituloSalvo || c.assunto_custom || "Assunto do mercado"),
        sub: t ? t.categoria + " · sugestão da Vitrine" : (corpoSalvo || "Sugestão da Vitrine"),
        art: topicCoverSvg(t ? t.categoria : (c.categoria || "Dicas"))
      };
    } else if (c.origem === "custom") {
      meta = { titulo: c.assunto_custom || "Assunto personalizado", sub: (c.categoria || "Mercado") + " · assunto próprio", art: customCoverSvg() };
    } else {
      var p = findProp(c.propriedade_id);
      meta = p ? { titulo: p.titulo, sub: (p.bairro || "") + " · " + (p.cidade || ""), art: propCoverSvg(p.tipo) } : { titulo: "Imóvel removido", sub: "—", art: customCoverSvg() };
    }
    // se o carrossel já foi salvo com uma imagem de capa real (Pollinations.ai), usa ela — com o SVG acima como fallback.
    // imagem_url passa por escapeHtml() porque é um valor gravado no banco (RLS permite o dono escrever nos próprios
    // slides) e vai direto num atributo HTML — sem isso, um valor malicioso ali quebraria o atributo (XSS).
    if (slide0 && isFotoReal(slide0.imagem_url)) meta.art = imgWithFallback(slide0.imagem_url, meta.art);
    return meta;
  }

  /* ---------------- toast ---------------- */
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  /* ---------------- promoção de lançamento ---------------- */
  // 30% off no 1º mês do plano mensal para NOVOS assinantes — desconto fixo, sem prazo nem contagem regressiva
  // (escolha do dono: nada de "acaba hoje" falso). O desconto real é aplicado no servidor (stripe-checkout).
  // Pra fazer uma rodada com prazo de verdade no futuro, é só colocar uma data aqui (e a mesma no stripe-checkout).
  var PROMO_FIM = null;
  var SUPORTE_EMAIL = "vitrinecorretor@gmail.com";
  function promoAtiva() { return !PROMO_FIM || Date.now() < PROMO_FIM.getTime(); }
  function iniciarContadoresPromo() {
    if (!PROMO_FIM) {   // desconto fixo: mostra a oferta, sem relógio
      qsa("[data-promo]").forEach(function (el) { el.hidden = false; });
      qsa("[data-countdown]").forEach(function (el) { el.hidden = true; });
      return;
    }
    function tick() {
      var ms = PROMO_FIM.getTime() - Date.now();
      qsa("[data-promo]").forEach(function (el) { el.hidden = ms <= 0; });
      if (ms <= 0) return;
      // contagem em HORAS corridas (sem dias): ex. 585h 12m 30s
      var h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, sg = Math.floor(ms / 1e3) % 60;
      qsa("[data-countdown]").forEach(function (el) {
        el.innerHTML = '<span><b>' + h + '</b>h</span><span><b>' + pad2(m) + '</b>m</span><span><b>' + pad2(sg) + '</b>s</span>';
      });
    }
    tick(); setInterval(tick, 1000);
  }
  qsa("[data-suporte]").forEach(function (a) { a.href = "mailto:" + SUPORTE_EMAIL; if (!a.textContent.trim()) a.textContent = SUPORTE_EMAIL; });
  iniciarContadoresPromo();

  /* ---------------- fontes das postagens ---------------- */
  // cada carrossel guarda a fonte escolhida (coluna carrosseis.fonte); o mesmo par vale pra prévia, JPEG e vídeo
  var FONTES = {
    moderna: { nome: "Moderna", titulo: '"Space Grotesk", sans-serif', tPeso: 700, corpo: '"Manrope", sans-serif' },
    impacto: { nome: "Impacto", titulo: '"Anton", sans-serif', tPeso: 400, corpo: '"Manrope", sans-serif' },
    elegante: { nome: "Elegante", titulo: '"Playfair Display", serif', tPeso: 800, corpo: '"Manrope", sans-serif' },
    amigavel: { nome: "Amigável", titulo: '"Poppins", sans-serif', tPeso: 800, corpo: '"Poppins", sans-serif' },
    futurista: { nome: "Futurista", titulo: '"Unbounded", sans-serif', tPeso: 700, corpo: '"Manrope", sans-serif' },
    classica: { nome: "Clássica", titulo: '"Bricolage Grotesque", sans-serif', tPeso: 800, corpo: '"Plus Jakarta Sans", sans-serif' }
  };
  // a coluna carrosseis.fonte guarda "fonte|cor" (ex.: "impacto|limao"); sem "|cor" = amarelo (padrão antigo)
  function fonteDe(id) { id = String(id || "").split("|")[0]; return FONTES[id] ? id : "moderna"; }

  /* ---------------- paleta de cores do título ----------------
     Combinações de alto contraste sobre foto escurecida — o padrão dos carrosséis que mais retêm no feed:
     título claro + 1 palavra-chave numa cor saturada que "salta" (amarelo, verde-limão, laranja, rosa, ciano...).
     Dourado/creme pra imóveis de alto padrão; "invertido" pra variar o feed sem perder contraste. */
  var CORES = {
    amarelo:   { nome: "Amarelo",      titulo: "#FFFFFF", destaque: "#FFD60A" },
    limao:     { nome: "Verde-limão",  titulo: "#FFFFFF", destaque: "#C6FF00" },
    laranja:   { nome: "Laranja",      titulo: "#FFFFFF", destaque: "#FF9F1C" },
    rosa:      { nome: "Rosa choque",  titulo: "#FFFFFF", destaque: "#FF4D9D" },
    ciano:     { nome: "Ciano",        titulo: "#FFFFFF", destaque: "#00E5FF" },
    vermelho:  { nome: "Vermelho",     titulo: "#FFFFFF", destaque: "#FF4538" },
    menta:     { nome: "Menta",        titulo: "#FFFFFF", destaque: "#3DFFB0" },
    coral:     { nome: "Coral",        titulo: "#FFFFFF", destaque: "#FF7A66" },
    lilas:     { nome: "Lilás",        titulo: "#FFFFFF", destaque: "#C29BFF" },
    dourado:   { nome: "Dourado",      titulo: "#FFF6E5", destaque: "#E9C46A" },
    creme:     { nome: "Creme + laranja", titulo: "#FFF1D6", destaque: "#FF8A3D" },
    invertido: { nome: "Amarelo invertido", titulo: "#FFD60A", destaque: "#FFFFFF" },
    marca:     { nome: "Cor da marca", titulo: "#FFFFFF", destaque: "#FFD60A" }   // destaque vem de profiles.cor_marca (syncMarcaCor)
  };
  // kit da marca: cor_marca vira a cor de destaque padrão quando o corretor não escolheu outra
  function marcaCorAtiva() { var p = (typeof state !== "undefined" && state.profile) || {}; return p.marca_ativa !== false && /^#[0-9a-f]{6}$/i.test(p.cor_marca || ""); }
  function syncMarcaCor() { var p = (typeof state !== "undefined" && state.profile) || {}; if (/^#[0-9a-f]{6}$/i.test(p.cor_marca || "")) CORES.marca.destaque = p.cor_marca; }
  function corDe(f) {
    var k = String(f || "").split("|")[1];
    if (k === "marca") return marcaCorAtiva() ? "marca" : "amarelo";
    if (CORES[k]) return k;
    return marcaCorAtiva() ? "marca" : "amarelo";
  }
  function comCor(f, cor) { return fonteDe(f) + (cor && CORES[cor] && (cor !== "amarelo" || marcaCorAtiva()) ? "|" + cor : ""); }
  function corPickerHtml(atual) {
    var on = corDe(atual);
    return '<div class="fonts-titulo">Cor do título</div><div class="cor-grid">' + Object.keys(CORES).filter(function (k) { return k !== "marca" || marcaCorAtiva(); }).map(function (k) {
      var c = CORES[k];
      return '<button type="button" class="cor-opt' + (k === on ? " on" : "") + '" data-cor="' + k + '" title="' + c.nome + '">' +
        '<span class="cor-amostra"><b style="color:' + c.titulo + '">Aa</b><b style="color:' + c.destaque + '">Aa</b></span><span class="nm">' + c.nome + '</span></button>';
    }).join("") + '</div>';
  }
  function fontPickerHtml(atual) {
    return '<div class="fonts-titulo">Fonte do carrossel</div><div class="font-grid">' + Object.keys(FONTES).map(function (k) {
      var f = FONTES[k];
      return '<button type="button" class="font-opt' + (k === fonteDe(atual) ? " on" : "") + '" data-fonte="' + k + '">' +
        '<span class="aa" style="font-family:' + f.titulo.replace(/"/g, "&quot;") + ';font-weight:' + f.tPeso + '">Aa</span><span class="nm">' + f.nome + '</span></button>';
    }).join("") + '</div>' + corPickerHtml(atual);
  }
  async function carregarFonte(id) {
    var f = FONTES[fonteDe(id)];
    try { await Promise.all([document.fonts.load(f.tPeso + " 80px " + f.titulo), document.fonts.load("500 44px " + f.corpo), document.fonts.load("700 34px " + f.corpo)]); } catch (e) { }
  }

  /* ---------------- slide tile renderer ---------------- */
  function slideTile(slide, tplSlug, mini, index, total, art, fonte, melhorar) {
    var ev = ESTILOS_VIRAIS[tplSlug];
    var cor = CORES[corDe(fonte)];
    var foto = mini ? null : slideImageUrl(slide);
    if (tplSlug === "bloco-cor") foto = null;                  // bloco de cor: sem foto
    var fotoCard = tplSlug === "post-social" && foto;           // post-social: foto vira imagem dentro do "post"
    var artHtml = foto && !fotoCard ? '<div class="tile-bg">' + imgWithFallback(foto, "") + '</div>' : "";
    var extra = "";
    if (tplSlug === "post-social") {
      var a = nomeAutor();
      extra = '<div class="ps-head"><i class="ps-av">' + escapeHtml(a.user.slice(0, 1).toUpperCase()) + '</i><span class="ps-nm"><b>@' + escapeHtml(a.user) + '</b><u>✓</u>' + (slide.tag ? '<em>' + escapeHtml(String(slide.tag).toLowerCase()) + '</em>' : '') + '</span></div>';
    } else if (tplSlug === "checklist") {
      extra = '<div class="ck-num">' + (index === 1 ? "✓" : (index - 1)) + '</div>';
    }
    var tit = ev ? ' style="color:' + ev.tit + '"' : ' style="color:' + cor.titulo + '"';
    return '<div class="slide-tile fnt-' + fonteDe(fonte) + ' ' + (mini ? "mini " : "") + (foto && !fotoCard ? "has-bg " : "") + (melhorar !== false ? "melhor " : "") + 'tpl-' + (tplSlug || "minimalista") + '" style="--hl:' + cor.destaque + '">' + artHtml + extra +
      '<div class="stag">' + escapeHtml(slide.tag || (tplSlug === "manchete" ? (index === 1 ? "Urgente" : "Atenção") : "")) + '</div>' +
      '<div class="stitle"' + tit + '>' + tituloHtml(slide.titulo) + '</div>' +
      (fotoCard ? '<div class="ps-foto">' + imgWithFallback(foto, "") + '</div>' : "") +
      '<div class="sbody">' + escapeHtml(slide.corpo) + '</div>' +
      (mini ? "" : '<div class="sindex">' + index + "/" + total + "</div>") +
      "</div>";
  }
  function slideStrip(slides, tplSlug, mini, art, fonte, melhorar) {
    return (slides || []).map(function (s, i) { return slideTile(s, tplSlug, mini, i + 1, slides.length, i === 0 ? art : null, fonte, melhorar); }).join("");
  }


  /* ============================================================
     RENDER DOS SLIDES EM JPEG (1080×1350, 4:5) — o Instagram só aceita imagem
  ============================================================ */
  var SLIDE_W = 1080, SLIDE_H = 1350;
  var SLIDE_THEMES = {
    minimalista: { bg: ["#0E1022", "#0E1022"], ink: "#F3F4FF", tag: "#A78BFF", border: "#252A50" },
    vibrante: { bg: ["#8B5CFF", "#00B8E6"], ink: "#FFFFFF", tag: "rgba(255,255,255,0.9)", border: "#8B5CFF" },
    editorial: { bg: ["#080A10", "#0F1B33"], ink: "#EEF0F6", tag: "#00E0FF", border: "#00E0FF" }
  };

  // melhorar=true: devolve um canvas com auto-ajuste (fotos.js), em cache por url
  function loadImage(url, melhorar) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      var img = new Image();
      img.crossOrigin = "anonymous";            // sem isso o canvas fica "contaminado" e não exporta
      var t = setTimeout(function () { resolve(null); }, 20000);
      img.onload = function () { clearTimeout(t); resolve(melhorar && window.VitrineFotos ? window.VitrineFotos.melhorar(img, url) : img); };
      img.onerror = function () { clearTimeout(t); resolve(null); };
      img.src = url;
    });
  }

  /* ---------- destaque de palavras: a IA marca *palavra* no título e ela sai em amarelo ---------- */
  var COR_DESTAQUE = "#FFD60A";
  function semMarcas(t) { return String(t || "").replace(/\*/g, ""); }
  function normPalavra(w) { return String(w || "").toLowerCase().replace(/[^\p{L}\p{N}%$]/gu, ""); }
  function palavrasDestaque(t) {
    var set = {}, m, re = /\*([^*]+)\*/g;
    while ((m = re.exec(String(t || "")))) m[1].split(/\s+/).forEach(function (w) { var n = normPalavra(w); if (n) set[n] = 1; });
    return set;
  }
  function tituloHtml(t) {
    return escapeHtml(String(t || "")).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>').replace(/\*/g, "");
  }

  function wrapLines(ctx, text, maxW) {
    var out = [];
    String(text || "").split(/\n/).forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = "";
      if (!words.length) { out.push(""); return; }
      words.forEach(function (w) {
        var test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
      });
      out.push(line);
    });
    return out;
  }

  // escreve o texto reduzindo a fonte até caber na altura disponível
  function fitText(ctx, text, opts) {
    var size = opts.size, lines;
    for (; size >= opts.min; size -= 2) {
      ctx.font = opts.weight + " " + size + "px " + opts.family;
      lines = wrapLines(ctx, text, opts.maxW);
      // cabe na altura E nenhuma palavra longa estoura a largura (ex.: "FINANCIAMENTO" em fonte grande)
      var larga = lines.some(function (l) { return ctx.measureText(l).width > opts.maxW; });
      if (!larga && lines.length * size * opts.lh <= opts.maxH) break;
    }
    return { size: size, lines: lines, height: lines.length * size * opts.lh };
  }

  /* ============================================================
     ESTILOS VIRAIS — formatos que costumam viralizar no feed (tabela templates, slugs abaixo).
     Todos usam texto principal BEM GRANDE, *destaque* colorido, numeração e a faixa com o link da Vitrine.
       manchete    — notícia: selo vermelho, foto escurecida e manchete em caixa-alta
       post-social — print de post (avatar, selo verificado, texto grande, curtir/salvar)
       checklist   — número gigante por item (a capa vira um "check")
       bloco-cor   — fundo sólido saturado (a cor escolhida), texto gigante, sem foto
  ============================================================ */
  var ESTILOS_VIRAIS = {
    "manchete": { tit: "#FFFFFF" },
    "post-social": { tit: "#14171A" },
    "checklist": { tit: "#FFFFFF" },
    "bloco-cor": { tit: "#111111" },
    "ficha-imovel": { tit: "#0F1419" },
    "isso-ou-aquilo": { tit: "#FFFFFF" },
    "notas": { tit: "#1C1C1E" },
    "mito-verdade": { tit: "#FFFFFF" },
    "antes-depois": { tit: "#FFFFFF" },
    "explicador": { tit: "#1A1A1A" }
  };
  // modelos em teste: só a conta dona vê até serem liberados para todos
  var TPL_BETA = [];   // 28/10/2026: os 6 modelos novos foram liberados para todos
  // quebra o corpo em itens de lista (linhas, ";" ou frases)
  function itensDoCorpo(t) {
    var s = String(t || "").replace(/Arrasta pro lado\s*→?/i, "").trim();
    var l = s.split(/\n+|;\s*/).map(function (x) { return x.replace(/^[-•✓✔\d.)\s]+/, "").trim(); }).filter(Boolean);
    if (l.length < 2) l = s.split(/(?<=[.!?])\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
    return l.slice(0, 6);
  }
  function tplVisivel(t) { return TPL_BETA.indexOf(t.slug) < 0 || ehAdmin(); }
  /* ficha-imovel: dados SÓ do cadastro do imóvel (nada estimado). isso-ou-aquilo: usa a foto do slide seguinte. */
  var FICHA = null, VIZINHOS = [];
  function chipsFicha() {
    var p = FICHA; if (!p) return [];
    var l = [], n = function (v) { return Number(v) > 0 ? Number(v) : 0; };
    if (n(p.preco)) l.push({ t: "R$ " + n(p.preco).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + (p.finalidade === "aluguel" ? "/mês" : ""), forte: true });
    if (n(p.area_m2)) l.push({ t: Math.round(n(p.area_m2)).toLocaleString("pt-BR") + " m²" });
    if (n(p.quartos)) l.push({ t: n(p.quartos) + (n(p.quartos) === 1 ? " quarto" : " quartos") });
    if (n(p.suites)) l.push({ t: n(p.suites) + (n(p.suites) === 1 ? " suíte" : " suítes") });
    if (n(p.vagas)) l.push({ t: n(p.vagas) + (n(p.vagas) === 1 ? " vaga" : " vagas") });
    if (p.bairro && String(p.bairro).trim()) l.push({ t: String(p.bairro).trim() });
    return l;
  }
  function desenharChips(ctx, chips, x0, y0, maxW, fam, COR) {
    var x = x0, y = y0, h = 70, gap = 14;
    chips.forEach(function (c) {
      ctx.font = (c.forte ? "800" : "700") + " 34px " + fam;
      var w = ctx.measureText(c.t).width + 52;
      if (x + w > x0 + maxW && x > x0) { x = x0; y += h + gap; }
      ctx.fillStyle = c.forte ? COR.destaque : "#FFFFFF"; rrect(ctx, x, y, w, h, 35); ctx.fill();
      if (!c.forte) { ctx.strokeStyle = "#D9DDE1"; ctx.lineWidth = 2; rrect(ctx, x, y, w, h, 35); ctx.stroke(); }
      ctx.fillStyle = "#0F1419"; ctx.textBaseline = "top"; ctx.fillText(c.t, x + 26, y + 17);
      x += w + gap;
    });
    return y + h;
  }
  var AUTOR_IG = null;   // @ do Instagram onde ESTE carrossel vai sair (definido antes de gerar as imagens)
  function nomeAutor() {
    var p = (typeof state !== "undefined" && state.profile) || {};
    var sel = (typeof state !== "undefined" && state.igContas && state.igContas[0]) || null;
    var ig = AUTOR_IG || (sel && sel.username) || (typeof state !== "undefined" && state.igConta && state.igConta.status === "ativo" && state.igConta.username) || "";
    var nome = p.nome || "Seu Nome";
    return { nome: nome, user: ig || nome.toLowerCase().replace(/[^a-z0-9]+/g, "") || "seuperfil" };
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function coverImg(ctx, img, x, y, w, h) {
    var r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }
  // título com palavras *destacadas*: cor (marca:"cor") ou "marca-texto" (marca:{bg,fg}); devolve a altura usada
  function tituloViral(ctx, slide, o) {
    var padX = o.pill ? 14 : 0;
    var t = fitText(ctx, o.upper ? semMarcas(slide.titulo).toUpperCase() : semMarcas(slide.titulo),
      { size: o.size, min: o.min || 56, weight: o.weight, family: o.family, maxW: o.maxW - padX * 2, maxH: o.maxH, lh: o.lh });
    ctx.font = o.weight + " " + t.size + "px " + o.family;
    var hl = palavrasDestaque(slide.titulo), esp = ctx.measureText(" ").width, y0 = o.bottom ? o.y - t.height : o.y;
    ctx.textBaseline = "top";
    t.lines.forEach(function (l, k) {
      var x = o.x, y = y0 + k * t.size * o.lh;
      l.split(" ").forEach(function (w) {
        var ww = ctx.measureText(w).width, on = hl[normPalavra(w)];
        if (on && o.pill) {
          ctx.fillStyle = o.pill.bg; rrect(ctx, x, y + t.size * 0.02, ww + padX * 2, t.size * 1.04, 12); ctx.fill();
          ctx.fillStyle = o.pill.fg; ctx.fillText(w, x + padX, y); x += ww + padX * 2 + esp;
        } else {
          ctx.fillStyle = on ? o.hl : o.cor; ctx.fillText(w, x, y); x += ww + esp;
        }
      });
    });
    return { size: t.size, height: t.height, y: y0 };
  }
  function corpoViral(ctx, slide, o) {   // corpo alinhado embaixo (termina em o.bottom)
    var b = fitText(ctx, slide.corpo, { size: o.size, min: 26, weight: o.weight || 500, family: o.family, maxW: o.maxW, maxH: o.maxH, lh: 1.36 });
    ctx.font = (o.weight || 500) + " " + b.size + "px " + o.family; ctx.fillStyle = o.cor; ctx.textBaseline = "top"; ctx.textAlign = "left";
    var y = o.bottom - b.height;
    b.lines.forEach(function (l, k) { ctx.fillText(l, o.x, y + k * b.size * 1.36); });
    return { height: b.height, y: y };
  }
  function rodapeViral(ctx, i, total, W, pad, yBase, cor, corCapa, family) {
    ctx.textAlign = "right"; ctx.textBaseline = "top";
    if (i === 0 && total > 1) { ctx.fillStyle = corCapa; ctx.font = "800 34px " + family; ctx.fillText("ARRASTA  →", W - pad, yBase); }
    else { ctx.fillStyle = cor; ctx.globalAlpha = 0.75; ctx.font = '500 30px "JetBrains Mono", monospace'; ctx.fillText((i + 1) + "/" + total, W - pad, yBase + 2); ctx.globalAlpha = 1; }
    ctx.textAlign = "left";
  }
  /* ---------- kit da marca: rodapé pequeno com logo + nome + CRECI (profiles.logo_url/nome/creci) ---------- */
  var MARCA = null;   // { img, nome, creci } — preparado por prepararMarca() antes de desenhar
  async function prepararMarca() {
    var p = (typeof state !== "undefined" && state.profile) || {};
    if (p.marca_ativa === false || !(p.nome || p.logo_url)) { MARCA = null; return; }
    var img = p.logo_url ? await loadImage(p.logo_url, false) : null;
    MARCA = { img: img, nome: String(p.nome || "").trim(), creci: String(p.creci || "").trim() };
  }
  // desenha o selo da marca à esquerda; yc = centro vertical; cor = cor do texto. Logo ≤ 56px de altura.
  function rodapeMarca(ctx, x, yc, maxW, cor, family) {
    if (!MARCA) return;
    var lh = 0, lw = 0, gap = 14, pad = 6;
    if (MARCA.img) {
      var r = MARCA.img.width / MARCA.img.height;
      lh = 44; lw = lh * r;
      if (lw > 200) { lw = 200; lh = lw / r; }
      ctx.fillStyle = "rgba(255,255,255,0.94)"; rrect(ctx, x, yc - (lh + pad * 2) / 2, lw + pad * 2, lh + pad * 2, 12); ctx.fill();   // fundo claro: logo escuro/transparente continua legível
      ctx.drawImage(MARCA.img, x + pad, yc - lh / 2, lw, lh);
      lw += pad * 2;
    }
    var tx = x + (lw ? lw + gap : 0), tw = maxW - (tx - x);
    var l1 = MARCA.nome, l2 = MARCA.creci ? "CRECI " + MARCA.creci : "";
    if (!l1 && !l2) return;
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = cor;
    function corta(t, fonte) { ctx.font = fonte; while (t.length > 3 && ctx.measureText(t).width > tw) t = t.slice(0, -2) + "…"; return t; }
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = cor === "#fff" || cor === "#FFFFFF" ? 6 : 0;
    if (l1 && l2) {
      ctx.globalAlpha = 0.95; ctx.fillText(corta(l1, "700 28px " + family), tx, yc - 15);
      ctx.globalAlpha = 0.8; ctx.fillText(corta(l2, "500 23px " + family), tx, yc + 15);
    } else { ctx.globalAlpha = 0.95; ctx.fillText(corta(l1 || l2, "700 28px " + family), tx, yc); }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.shadowColor = "transparent"; ctx.textBaseline = "top";
  }
  // linha do rodapé: à esquerda do contador "1/7" (yBase = topo do contador)
  function rodapeMarcaLinha(ctx, W, pad, yBase, cor, family) { rodapeMarca(ctx, pad, yBase + 17, W - pad * 2 - 300, cor, family); }

  function faixaLinkVitrine(ctx, W, H, alto) {
    if (!comLinkVitrine()) return;
    var faixaH = 64, faixaY = H - (alto ? 250 : 0) - faixaH;
    ctx.fillStyle = "rgba(5,6,13,0.78)"; ctx.fillRect(0, faixaY, W, faixaH);
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = "600 26px Manrope, Arial, sans-serif";
    ctx.fillText("Criado com Vitrine  ·  " + LINK_VITRINE, W / 2, faixaY + 20);
    ctx.textAlign = "left";
  }

  function desenharEstiloViral(ctx, slug, slide, i, total, bgImg, alto, fonte, W, H) {
    var F = FONTES[fonteDe(fonte)], COR = CORES[corDe(fonte)];
    var fam = F.corpo, disp = F.titulo, tp = F.tPeso;
    var pad = 96, top = alto ? 250 : pad, botLimit = H - (alto ? 340 : pad) - 60, maxW = W - pad * 2;
    ctx.textBaseline = "top"; ctx.textAlign = "left";

    if (slug === "manchete") {
      var g = ctx.createLinearGradient(0, 0, W * 0.6, H); g.addColorStop(0, "#1c1c26"); g.addColorStop(1, "#050507");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (bgImg) {
        coverImg(ctx, bgImg, 0, 0, W, H);
        var v = ctx.createLinearGradient(0, 0, 0, H);
        v.addColorStop(0, "rgba(0,0,0,0.45)"); v.addColorStop(0.35, "rgba(0,0,0,0.40)"); v.addColorStop(0.65, "rgba(0,0,0,0.82)"); v.addColorStop(1, "rgba(0,0,0,0.96)");
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }
      // selo vermelho de "plantão" no topo
      var selo = "●  " + String(slide.tag || (i === 0 ? "URGENTE" : "ATENÇÃO")).toUpperCase();
      ctx.font = "800 40px " + fam; var sw = ctx.measureText(selo).width + 80;
      ctx.fillStyle = "#E10600"; ctx.fillRect(0, top, sw, 84); ctx.fillStyle = "#fff"; ctx.fillText(selo, 40, top + 20);
      var yB = botLimit;
      var b = corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 38, maxH: 230, bottom: yB, cor: "rgba(255,255,255,0.92)", family: fam });
      var tBottom = b.y - 44;
      ctx.fillStyle = "#E10600"; var t = tituloViral(ctx, slide, { x: pad, y: tBottom, bottom: true, maxW: maxW, maxH: tBottom - (top + 84 + 70), size: i === 0 ? 150 : 124, weight: tp, family: disp, lh: 1.1, upper: true, cor: "#fff", pill: { bg: COR.destaque, fg: "#111" } });
      ctx.fillStyle = "#E10600"; ctx.fillRect(pad, t.y - 34, 190, 14);
      rodapeViral(ctx, i, total, W, pad, botLimit + 26, "#fff", COR.destaque, fam);
      rodapeMarcaLinha(ctx, W, pad, botLimit + 26, "#fff", fam);
    }

    else if (slug === "post-social") {
      ctx.fillStyle = "#E6EAEE"; ctx.fillRect(0, 0, W, H);
      var cardT = alto ? 210 : 56, cardB = botLimit + 84, cx = 48, cw = W - 96;
      ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#fff"; rrect(ctx, cx, cardT, cw, cardB - cardT, 44); ctx.fill();
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      var x0 = cx + 56, w0 = cw - 112, a = nomeAutor(), y = cardT + 52;
      var ag = ctx.createLinearGradient(x0, y, x0 + 110, y + 110); ag.addColorStop(0, "#8B5CFF"); ag.addColorStop(1, COR.destaque);
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(x0 + 55, y + 55, 55, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "800 56px " + fam; ctx.fillText(a.user.slice(0, 1).toUpperCase(), x0 + 55, y + 28); ctx.textAlign = "left";
      var arroba = "@" + a.user;   // só o Instagram onde o post sai (sem o nome completo do corretor)
      ctx.fillStyle = "#0F1419"; ctx.font = "800 40px " + fam; ctx.fillText(arroba, x0 + 134, y + 6);
      var nw = ctx.measureText(arroba).width;
      ctx.fillStyle = "#1D9BF0"; ctx.beginPath(); ctx.arc(x0 + 134 + nw + 30, y + 30, 18, 0, 7); ctx.fill();   // selo verificado
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      ctx.moveTo(x0 + 134 + nw + 21, y + 30); ctx.lineTo(x0 + 134 + nw + 28, y + 37); ctx.lineTo(x0 + 134 + nw + 40, y + 22); ctx.stroke();
      if (slide.tag) { ctx.fillStyle = "#536471"; ctx.font = "500 32px " + fam; ctx.fillText(String(slide.tag).toLowerCase(), x0 + 134, y + 58); }
      var yTxt = y + 150, acaoY = cardB - 92, fotoH = bgImg ? (alto ? 560 : 360) : 0, fotoY = acaoY - 28 - fotoH;
      var area = (bgImg ? fotoY - 28 : acaoY - 20) - yTxt;
      var bodyH = Math.min(area * 0.34, 260);
      var t2 = tituloViral(ctx, slide, { x: x0, y: yTxt, maxW: w0, maxH: area - bodyH - 24, size: i === 0 ? 104 : 88, weight: tp, family: disp, lh: 1.14, cor: "#0F1419", hl: "#0F1419", pill: { bg: COR.destaque, fg: "#111" } });
      var bd = fitText(ctx, slide.corpo, { size: 40, min: 26, weight: 500, family: fam, maxW: w0, maxH: Math.max(60, area - t2.height - 28), lh: 1.36 });
      ctx.font = "500 " + bd.size + "px " + fam; ctx.fillStyle = "#536471";
      bd.lines.forEach(function (l, k) { ctx.fillText(l, x0, yTxt + t2.height + 28 + k * bd.size * 1.36); });
      if (bgImg) { ctx.save(); rrect(ctx, x0, fotoY, w0, fotoH, 32); ctx.clip(); coverImg(ctx, bgImg, x0, fotoY, w0, fotoH); ctx.restore(); ctx.strokeStyle = "#CFD9DE"; ctx.lineWidth = 2; rrect(ctx, x0, fotoY, w0, fotoH, 32); ctx.stroke(); }
      ctx.fillStyle = "#536471"; ctx.font = "600 32px " + fam; ctx.fillText("♥ Curtir     Comentar     Salvar", x0, acaoY + 14);
      rodapeViral(ctx, i, total, W, cx + 56, acaoY + 14, "#536471", "#0F1419", fam);
      if (!comLinkVitrine()) rodapeMarca(ctx, cx + 20, cardB + 40, cw - 40, "#3B4650", fam);   // fora do cartão, embaixo
    }

    else if (slug === "checklist") {
      ctx.fillStyle = "#0B0B10"; ctx.fillRect(0, 0, W, H);
      if (bgImg) { coverImg(ctx, bgImg, 0, 0, W, H); ctx.fillStyle = "rgba(8,8,12,0.88)"; ctx.fillRect(0, 0, W, H); }
      var numH;
      if (i === 0) {   // capa: círculo com "check" enorme
        numH = 300; ctx.fillStyle = COR.destaque; ctx.beginPath(); ctx.arc(pad + 150, top + 150, 150, 0, 7); ctx.fill();
        ctx.strokeStyle = "#0B0B10"; ctx.lineWidth = 36; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
        ctx.moveTo(pad + 150 - 80, top + 150 + 6); ctx.lineTo(pad + 150 - 20, top + 150 + 66); ctx.lineTo(pad + 150 + 86, top + 150 - 60); ctx.stroke();
      } else {
        var ns = alto ? 480 : 430; ctx.font = "800 " + ns + "px " + disp; ctx.fillStyle = COR.destaque; ctx.textBaseline = "alphabetic";
        ctx.fillText(String(i), pad - 14, top + ns * 0.76); ctx.textBaseline = "top"; numH = ns * 0.76;
      }
      if (slide.tag) {
        ctx.font = "700 32px " + fam; var tg = String(slide.tag).toUpperCase(), tw = ctx.measureText(tg).width + 48;
        ctx.strokeStyle = COR.destaque; ctx.lineWidth = 4; rrect(ctx, W - pad - tw, top + 6, tw, 66, 33); ctx.stroke();
        ctx.fillStyle = COR.destaque; ctx.fillText(tg, W - pad - tw + 24, top + 22);
      }
      var b3 = corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 40, maxH: 260, bottom: botLimit, cor: "rgba(255,255,255,0.9)", family: fam });
      var yT = top + numH + 44;
      tituloViral(ctx, slide, { x: pad, y: yT, maxW: maxW, maxH: b3.y - 36 - yT, size: i === 0 ? 140 : 112, weight: tp, family: disp, lh: 1.08, cor: "#fff", hl: COR.destaque });
      rodapeViral(ctx, i, total, W, pad, botLimit + 26, "#fff", COR.destaque, fam);
      rodapeMarcaLinha(ctx, W, pad, botLimit + 26, "#fff", fam);
    }

    else if (slug === "ficha-imovel") {
      ctx.fillStyle = "#F5F5F2"; ctx.fillRect(0, 0, W, H);
      var fH = Math.round(H * 0.5);
      if (bgImg) coverImg(ctx, bgImg, 0, 0, W, fH);
      else { var gf = ctx.createLinearGradient(0, 0, W, fH); gf.addColorStop(0, "#1c1c26"); gf.addColorStop(1, "#3a3a4a"); ctx.fillStyle = gf; ctx.fillRect(0, 0, W, fH); }
      if (slide.tag) {
        ctx.font = "800 32px " + fam; var tgf = String(slide.tag).toUpperCase(), twf = ctx.measureText(tgf).width + 56;
        ctx.fillStyle = "rgba(255,255,255,0.94)"; rrect(ctx, pad, top, twf, 68, 34); ctx.fill(); ctx.fillStyle = "#0F1419"; ctx.fillText(tgf, pad + 28, top + 17);
      }
      var yF = fH + 48, chips = (i === 0 || i === total - 1) ? chipsFicha() : [];
      if (chips.length) yF = desenharChips(ctx, chips, pad, yF, maxW, fam, COR) + 34;
      var corpoF = fitText(ctx, slide.corpo, { size: 38, min: 26, weight: 500, family: fam, maxW: maxW, maxH: 200, lh: 1.36 });
      var tF = tituloViral(ctx, slide, { x: pad, y: yF, maxW: maxW, maxH: Math.max(90, botLimit - yF - corpoF.height - 30), size: i === 0 ? 112 : 96, min: 44, weight: tp, family: disp, lh: 1.08, cor: "#0F1419", hl: "#0F1419", pill: { bg: COR.destaque, fg: "#111" } });
      corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 38, maxH: 200, bottom: Math.min(botLimit, tF.y + tF.height + 30 + corpoF.height), cor: "#3B4650", family: fam });
      rodapeViral(ctx, i, total, W, pad, botLimit + 26, "#3B4650", "#0F1419", fam);
      rodapeMarcaLinha(ctx, W, pad, botLimit + 26, "#3B4650", fam);
    }

    else if (slug === "isso-ou-aquilo") {
      ctx.fillStyle = "#0B0B10"; ctx.fillRect(0, 0, W, H);
      var partes = semMarcas(slide.titulo).split(/\s+ou\s+/i);
      if (partes.length === 2 && i < total - 1) {
        var meio = W / 2, outra = VIZINHOS.length > 1 ? VIZINHOS[(i + 1) % VIZINHOS.length] : null;
        [bgImg, outra].forEach(function (im, k) {
          var xx = k * meio;
          if (im) { ctx.save(); ctx.beginPath(); ctx.rect(xx, 0, meio, H); ctx.clip(); coverImg(ctx, im, xx, 0, meio, H); ctx.restore(); }
          else { ctx.fillStyle = k ? "#2a2a38" : "#1a1a24"; ctx.fillRect(xx, 0, meio, H); }
        });
        var vo = ctx.createLinearGradient(0, 0, 0, H); vo.addColorStop(0, "rgba(0,0,0,0.62)"); vo.addColorStop(0.45, "rgba(0,0,0,0.2)"); vo.addColorStop(1, "rgba(0,0,0,0.88)");
        ctx.fillStyle = vo; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(meio - 3, 0, 6, Math.round(H * 0.68));
        ["A", "B"].forEach(function (L, k) {
          var cxo = k ? meio + meio / 2 : meio / 2, txo = partes[k].replace(/[?!.]+$/, "").trim().toUpperCase();
          ctx.font = "800 38px " + fam; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillText(L, cxo, top + 10);
          var to = fitText(ctx, txo, { size: 84, min: 40, weight: tp, family: disp, maxW: meio - 90, maxH: 300, lh: 1.05 });
          ctx.font = tp + " " + to.size + "px " + disp; ctx.fillStyle = k ? COR.destaque : "#FFFFFF";
          to.lines.forEach(function (ln, j) { ctx.fillText(ln, cxo, top + 70 + j * to.size * 1.05); });
        });
        ctx.fillStyle = COR.destaque; ctx.beginPath(); ctx.arc(meio, H * 0.5, 92, 0, 7); ctx.fill();
        ctx.fillStyle = "#111"; ctx.font = "900 70px " + disp; ctx.textBaseline = "middle"; ctx.fillText("OU", meio, H * 0.5 + 4);
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 38, maxH: 200, bottom: botLimit, cor: "#FFFFFF", family: fam });
      } else {
        if (bgImg) { coverImg(ctx, bgImg, 0, 0, W, H); ctx.fillStyle = "rgba(8,8,12,0.8)"; ctx.fillRect(0, 0, W, H); }
        var b6 = corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 40, maxH: 260, bottom: botLimit, cor: "rgba(255,255,255,0.92)", family: fam });
        tituloViral(ctx, slide, { x: pad, y: top, maxW: maxW, maxH: b6.y - 40 - top, size: i === 0 ? 140 : 120, weight: tp, family: disp, lh: 1.06, cor: "#FFFFFF", hl: COR.destaque });
      }
      rodapeViral(ctx, i, total, W, pad, botLimit + 26, "#fff", COR.destaque, fam);
      rodapeMarcaLinha(ctx, W, pad, botLimit + 26, "#fff", fam);
    }

    else if (slug === "notas") {
      // app de notas do celular (visual genérico, sem logo/marca de nenhum fabricante)
      var sys = '-apple-system, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif', amb = "#E2A100";
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
      var yb = alto ? top - 60 : 40;
      ctx.fillStyle = "#111"; ctx.font = "600 34px " + sys; ctx.fillText(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), pad - 20, yb);   // barra de status
      ctx.fillRect(W - pad - 70, yb + 6, 54, 26); ctx.fillRect(W - pad - 14, yb + 13, 5, 12);
      var yn = yb + 90;   // barra de navegação
      ctx.strokeStyle = amb; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(pad - 20, yn + 22); ctx.lineTo(pad - 40, yn + 2); ctx.lineTo(pad - 20, yn - 18); ctx.stroke();
      ctx.fillStyle = amb; ctx.font = "500 44px " + sys; ctx.fillText("Notas", pad - 6, yn - 22);
      ctx.beginPath(); ctx.arc(W - pad - 10, yn + 2, 26, 0, 7); ctx.lineWidth = 5; ctx.stroke();
      [-12, 0, 12].forEach(function (dx) { ctx.beginPath(); ctx.arc(W - pad - 10 + dx, yn + 2, 3.5, 0, 7); ctx.fill(); });
      ctx.lineWidth = 5; rrect(ctx, W - pad - 110, yn - 14, 34, 38, 4); ctx.stroke();   // compartilhar
      ctx.beginPath(); ctx.moveTo(W - pad - 93, yn - 30); ctx.lineTo(W - pad - 93, yn + 4); ctx.stroke();
      ctx.fillStyle = "#8E8E93"; ctx.font = "500 30px " + sys; ctx.textAlign = "center";   // data centralizada
      var agora = new Date();
      ctx.fillText(agora.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) + " às " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), W / 2, yn + 70); ctx.textAlign = "left";
      var tN = tituloViral(ctx, slide, { x: pad, y: yn + 140, maxW: maxW, maxH: 340, size: i === 0 ? 112 : 96, min: 52, weight: 800, family: sys, lh: 1.1, cor: "#111111", hl: "#111111", pill: { bg: "#FFE066", fg: "#111" } });
      var yN = tN.y + tN.height + 44, itensN = itensDoCorpo(slide.corpo), lista = itensN.length > 1;
      itensN.forEach(function (it) {
        if (yN > botLimit - 110) return;
        var fN = fitText(ctx, it, { size: 48, min: 30, weight: 400, family: sys, maxW: maxW - (lista ? 76 : 0), maxH: 190, lh: 1.3 });
        if (lista) { ctx.strokeStyle = "#C7C7CC"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(pad + 22, yN + fN.size * 0.62, 22, 0, 7); ctx.stroke(); }   // círculo de checklist
        ctx.fillStyle = "#111111"; ctx.font = "400 " + fN.size + "px " + sys;
        fN.lines.forEach(function (l2, k2) { ctx.fillText(l2, pad + (lista ? 76 : 0), yN + k2 * fN.size * 1.3); });
        yN += fN.height + (lista ? 34 : 18);
      });
      var yt = botLimit - 34;   // barra de ferramentas embaixo (ícones genéricos)
      ctx.strokeStyle = amb; ctx.lineWidth = 5;
      [pad, W / 2 - 150, W / 2 + 90, W - pad - 50].forEach(function (x5, k5) {
        if (k5 === 0) { [0, 16, 32].forEach(function (d) { ctx.beginPath(); ctx.arc(x5 + 6, yt + d, 4, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x5 + 20, yt + d); ctx.lineTo(x5 + 48, yt + d); ctx.stroke(); }); }
        else if (k5 === 1) { rrect(ctx, x5, yt - 4, 54, 40, 8); ctx.stroke(); ctx.beginPath(); ctx.arc(x5 + 27, yt + 16, 10, 0, 7); ctx.stroke(); }
        else if (k5 === 2) { ctx.beginPath(); ctx.moveTo(x5, yt + 36); ctx.lineTo(x5 + 40, yt - 4); ctx.lineTo(x5 + 48, yt + 4); ctx.lineTo(x5 + 8, yt + 44); ctx.closePath(); ctx.stroke(); }
        else { rrect(ctx, x5, yt - 4, 40, 40, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x5 + 18, yt + 22); ctx.lineTo(x5 + 46, yt - 10); ctx.stroke(); }
      });
      rodapeMarcaLinha(ctx, W, pad, botLimit + 26, "#3A3A3C", fam);
    }

    else if (slug === "mito-verdade") {
      ctx.fillStyle = "#0E0F14"; ctx.fillRect(0, 0, W, H);
      if (bgImg) { coverImg(ctx, bgImg, 0, 0, W, H); ctx.fillStyle = "rgba(10,10,14,0.86)"; ctx.fillRect(0, 0, W, H); }
      if (i > 0 && i < total - 1) {
        // par: título = MITO (riscado), corpo = VERDADE
        var cardH = (botLimit - top - 40) / 2;
        [["MITO", "#E5484D", "✕"], ["VERDADE", "#30A46C", "✓"]].forEach(function (cfg, k) {
          var yC = top + k * (cardH + 40);
          ctx.fillStyle = k ? "rgba(48,164,108,0.14)" : "rgba(229,72,77,0.14)"; rrect(ctx, pad - 30, yC, maxW + 60, cardH, 36); ctx.fill();
          ctx.fillStyle = cfg[1]; rrect(ctx, pad, yC + 34, 260, 66, 33); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "800 34px " + fam; ctx.fillText(cfg[2] + "  " + cfg[0], pad + 30, yC + 50);
          var txt2 = k ? String(slide.corpo || "") : semMarcas(slide.titulo);
          var fM = fitText(ctx, txt2, { size: k ? 54 : 70, min: 30, weight: k ? 600 : tp, family: k ? fam : disp, maxW: maxW, maxH: cardH - 150, lh: 1.16 });
          ctx.font = (k ? 600 : tp) + " " + fM.size + "px " + (k ? fam : disp); ctx.fillStyle = k ? "#FFFFFF" : "rgba(255,255,255,0.75)";
          fM.lines.forEach(function (l3, k3) {
            var yy3 = yC + 130 + k3 * fM.size * 1.16; ctx.fillText(l3, pad, yy3);
            if (!k) { var w3 = ctx.measureText(l3).width; ctx.fillStyle = "#E5484D"; ctx.fillRect(pad, yy3 + fM.size * 0.52, w3, 6); ctx.fillStyle = "rgba(255,255,255,0.75)"; }
          });
        });
      } else {
        var b7 = corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 40, maxH: 260, bottom: botLimit, cor: "rgba(255,255,255,0.9)", family: fam });
        if (i === 0) { ctx.font = "800 36px " + fam; ctx.fillStyle = "#E5484D"; ctx.fillText("✕ MITO", pad, top); ctx.fillStyle = "#30A46C"; ctx.fillText("✓ VERDADE", pad + 200, top); }
        tituloViral(ctx, slide, { x: pad, y: top + (i === 0 ? 90 : 0), maxW: maxW, maxH: b7.y - 40 - top - (i === 0 ? 90 : 0), size: i === 0 ? 136 : 116, weight: tp, family: disp, lh: 1.06, cor: "#FFFFFF", hl: COR.destaque });
      }
      rodapeViral(ctx, i, total, W, pad, botLimit + 26, "#fff", COR.destaque, fam);
      rodapeMarcaLinha(ctx, W, pad, botLimit + 26, "#fff", fam);
    }

    else if (slug === "antes-depois") {
      ctx.fillStyle = "#0B0B10"; ctx.fillRect(0, 0, W, H);
      var depois = VIZINHOS.length > 1 ? VIZINHOS[(VIZINHOS.indexOf(bgImg) + 1) % VIZINHOS.length] : null;
      if (i < total - 1 && bgImg && depois) {
        var corte = Math.round(W * 0.5);
        ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(corte + 90, 0); ctx.lineTo(corte - 90, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
        coverImg(ctx, bgImg, 0, 0, W, H); ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, 0, W, H); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.moveTo(corte + 90, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(corte - 90, H); ctx.closePath(); ctx.clip();
        coverImg(ctx, depois, 0, 0, W, H); ctx.restore();
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(corte + 90, 0); ctx.lineTo(corte + 90 - 180 * 0.58, H * 0.58); ctx.stroke();
        var vA = ctx.createLinearGradient(0, H * 0.45, 0, H); vA.addColorStop(0, "rgba(0,0,0,0)"); vA.addColorStop(1, "rgba(0,0,0,0.9)"); ctx.fillStyle = vA; ctx.fillRect(0, 0, W, H);
        [["ANTES", pad, "rgba(20,20,24,0.85)", "#FFFFFF"], ["DEPOIS", W - pad - 230, COR.destaque, "#111111"]].forEach(function (r4) {
          ctx.fillStyle = r4[2]; rrect(ctx, r4[1], top, 230, 72, 36); ctx.fill();
          ctx.fillStyle = r4[3]; ctx.font = "800 34px " + fam; ctx.textAlign = "center"; ctx.fillText(r4[0], r4[1] + 115, top + 19); ctx.textAlign = "left";
        });
        var b8 = corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 38, maxH: 180, bottom: botLimit, cor: "rgba(255,255,255,0.92)", family: fam });
        tituloViral(ctx, slide, { x: pad, y: b8.y - 30, bottom: true, maxW: maxW, maxH: 330, size: i === 0 ? 112 : 96, min: 48, weight: tp, family: disp, lh: 1.06, cor: "#FFFFFF", hl: COR.destaque });
      } else {
        if (bgImg) { coverImg(ctx, bgImg, 0, 0, W, H); ctx.fillStyle = "rgba(8,8,12,0.78)"; ctx.fillRect(0, 0, W, H); }
        var b9 = corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 40, maxH: 260, bottom: botLimit, cor: "rgba(255,255,255,0.92)", family: fam });
        tituloViral(ctx, slide, { x: pad, y: top, maxW: maxW, maxH: b9.y - 40 - top, size: i === 0 ? 140 : 120, weight: tp, family: disp, lh: 1.06, cor: "#FFFFFF", hl: COR.destaque });
      }
      rodapeViral(ctx, i, total, W, pad, botLimit + 26, "#fff", COR.destaque, fam);
      rodapeMarcaLinha(ctx, W, pad, botLimit + 26, "#fff", fam);
    }

    else if (slug === "explicador") {
      // estilo "explicador de jornal em vídeo": papel, foto recortada com borda branca, marca-texto e seta à mão
      ctx.fillStyle = "#EDE6D6"; ctx.fillRect(0, 0, W, H);
      var seed = 7 + i * 13; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      for (var pz = 0; pz < 2600; pz++) { ctx.fillStyle = rnd() > 0.5 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.08)"; ctx.fillRect(rnd() * W, rnd() * H, 2, 2); }
      var fw = Math.round(W * 0.6), fh = Math.round(H * (alto ? 0.3 : 0.34)), fx = W - pad - fw + 20, fy = top + 20;
      if (bgImg) {
        ctx.save(); ctx.translate(fx + fw / 2, fy + fh / 2); ctx.rotate(i % 2 ? 0.035 : -0.04);
        ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(-fw / 2 - 16, -fh / 2 - 16, fw + 32, fh + 32);
        ctx.shadowColor = "transparent"; coverImg(ctx, bgImg, -fw / 2, -fh / 2, fw, fh); ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.save(); ctx.translate(fx + fw / 2, fy - 6); ctx.rotate(-0.06); ctx.fillRect(-70, -18, 140, 36); ctx.restore();   // fita adesiva
      }
      // número da etapa (ou selo "ENTENDA" na capa)
      ctx.fillStyle = "#1A1A1A";
      if (i === 0) { ctx.save(); ctx.translate(pad + 10, top + 60); ctx.rotate(-0.08); ctx.strokeStyle = "#E5484D"; ctx.lineWidth = 6; rrect(ctx, 0, 0, 250, 84, 10); ctx.stroke(); ctx.fillStyle = "#E5484D"; ctx.font = "900 44px " + fam; ctx.fillText("ENTENDA", 26, 18); ctx.restore(); }
      else if (i < total - 1) { ctx.font = "900 220px " + disp; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "rgba(26,26,26,0.9)"; ctx.fillText(String(i), pad - 6, top + 220); ctx.textBaseline = "top"; }
      var yE = fy + fh + 70;
      var corpoE = fitText(ctx, slide.corpo, { size: 40, min: 26, weight: 500, family: fam, maxW: maxW, maxH: 220, lh: 1.36 });
      var tE = tituloViral(ctx, slide, { x: pad, y: yE, maxW: maxW, maxH: Math.max(100, botLimit - yE - corpoE.height - 40), size: i === 0 ? 116 : 100, min: 48, weight: tp, family: disp, lh: 1.12, cor: "#1A1A1A", hl: "#1A1A1A", pill: { bg: "rgba(255,214,10,0.9)", fg: "#1A1A1A" } });
      corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 40, maxH: 220, bottom: Math.min(botLimit, tE.y + tE.height + 36 + corpoE.height), cor: "#3A3A3A", family: fam });
      if (bgImg) {   // seta desenhada à mão do título até a foto
        var ax = pad + 120, ay = yE - 18, bx = fx + 40, by = fy + fh - 10;
        ctx.strokeStyle = "#E5484D"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(ax - 40, by + 10, bx - 30, by - 20); ctx.stroke();
        var ang = Math.atan2(-20 - 10, bx - 30 - (ax - 40));
        ctx.beginPath(); ctx.moveTo(bx - 30, by - 20); ctx.lineTo(bx - 30 - 34 * Math.cos(ang - 0.5), by - 20 - 34 * Math.sin(ang - 0.5));
        ctx.moveTo(bx - 30, by - 20); ctx.lineTo(bx - 30 - 34 * Math.cos(ang + 0.5), by - 20 - 34 * Math.sin(ang + 0.5)); ctx.stroke();
      }
      rodapeViral(ctx, i, total, W, pad, botLimit + 26, "#3A3A3A", "#1A1A1A", fam);
      rodapeMarcaLinha(ctx, W, pad, botLimit + 26, "#3A3A3A", fam);
    }

    else {   // bloco-cor
      ctx.fillStyle = COR.destaque; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(0,0,0,0.07)"; ctx.beginPath(); ctx.arc(W, 0, 560, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, H, 420, 0, 7); ctx.fill();
      var yy = top;
      if (slide.tag) {
        ctx.font = "800 32px " + fam; var tx = String(slide.tag).toUpperCase(), tw2 = ctx.measureText(tx).width + 56;
        ctx.fillStyle = "#111"; rrect(ctx, pad, top, tw2, 68, 34); ctx.fill(); ctx.fillStyle = COR.destaque; ctx.fillText(tx, pad + 28, top + 17); yy += 112;
      }
      var b4 = corpoViral(ctx, slide, { x: pad, maxW: maxW, size: 42, weight: 600, maxH: 230, bottom: botLimit, cor: "#111", family: fam });
      tituloViral(ctx, slide, { x: pad, y: yy, maxW: maxW, maxH: b4.y - 40 - yy, size: i === 0 ? 190 : 150, min: 60, weight: tp, family: disp, lh: 1.04, upper: true, cor: "#111", pill: { bg: "#111", fg: COR.destaque } });
      rodapeViral(ctx, i, total, W, pad, botLimit + 26, "#111", "#111", fam);
      rodapeMarcaLinha(ctx, W, pad, botLimit + 26, "#111", fam);
    }
    faixaLinkVitrine(ctx, W, H, alto);
  }

  async function renderSlideJpeg(slide, i, total, tplSlug, bgImg, alto, fonte) {
    var SLIDE_W = 1080, SLIDE_H = alto ? 1920 : 1350;   // alto = 9:16 (stories/reels)
    var th = SLIDE_THEMES[tplSlug] || SLIDE_THEMES.minimalista;
    var cv = document.createElement("canvas"); cv.width = SLIDE_W; cv.height = SLIDE_H;
    var ctx = cv.getContext("2d");
    if (ESTILOS_VIRAIS[tplSlug]) {   // estilos virais têm layout próprio (ver desenharEstiloViral)
      desenharEstiloViral(ctx, tplSlug, slide, i, total, bgImg, alto, fonte, SLIDE_W, SLIDE_H);
      return new Promise(function (resolve, reject) {
        try { cv.toBlob(function (b) { b ? resolve(b) : reject(new Error("Falha ao gerar imagem.")); }, "image/jpeg", 0.9); } catch (e) { reject(e); }
      });
    }
    var g = ctx.createLinearGradient(0, 0, SLIDE_W * 0.6, SLIDE_H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

    var pad = 96, top = alto ? 250 : pad;          // 9:16: deixa livre a área da barra do Instagram
    var ink = th.ink, tagColor = th.tag;
    if (bgImg) {
      // foto relacionada ocupando o slide inteiro (object-fit:cover) + véu escuro pro texto ficar legível
      var r = Math.max(SLIDE_W / bgImg.width, SLIDE_H / bgImg.height);
      var sw = SLIDE_W / r, sh = SLIDE_H / r;
      ctx.drawImage(bgImg, (bgImg.width - sw) / 2, (bgImg.height - sh) / 2, sw, sh, 0, 0, SLIDE_W, SLIDE_H);
      var veil = ctx.createLinearGradient(0, 0, 0, SLIDE_H);
      veil.addColorStop(0, "rgba(8,10,16,0.62)"); veil.addColorStop(0.45, "rgba(8,10,16,0.40)"); veil.addColorStop(1, "rgba(8,10,16,0.88)");
      ctx.fillStyle = veil; ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
      ink = "#FFFFFF";
      if (tplSlug === "vibrante") tagColor = "#7CF3FF";
    }

    var F = FONTES[fonteDe(fonte)];
    var COR = CORES[corDe(fonte)];
    var family = F.corpo, display = F.titulo, tPeso = F.tPeso;
    ctx.textBaseline = "top";
    if (slide.tag) {
      ctx.fillStyle = tagColor; ctx.font = "700 34px " + family;
      ctx.fillText(String(slide.tag).toUpperCase(), pad, top);
      top += 64;
    }
    var bottomLimit = SLIDE_H - (alto ? 340 : pad) - 60;   // reserva espaço do contador (e da UI do stories/reels)
    var avail = bottomLimit - top;
    // título em destaque: fonte maior e até 2/3 da área útil, pra chamar atenção já na miniatura do feed
    var title = fitText(ctx, semMarcas(slide.titulo), { size: i === 0 ? 140 : 116, min: 52, weight: tPeso, family: display, maxW: SLIDE_W - pad * 2, maxH: avail * 0.66, lh: 1.08 });
    ctx.font = tPeso + " " + title.size + "px " + display;
    var hl = palavrasDestaque(slide.titulo), espaco = ctx.measureText(" ").width;
    // sombra leve: o título "salta" da foto, como nos carrosséis que viralizam
    ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = bgImg ? 18 : 0;
    title.lines.forEach(function (l, k) {
      var x = pad, y = top + k * title.size * 1.08;
      l.split(" ").forEach(function (w) {
        ctx.fillStyle = hl[normPalavra(w)] ? COR.destaque : COR.titulo;
        ctx.fillText(w, x, y);
        x += ctx.measureText(w).width + espaco;
      });
    });
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";

    var bodyMaxH = avail - title.height - 48;
    var body = fitText(ctx, slide.corpo, { size: 40, min: 26, weight: 500, family: family, maxW: SLIDE_W - pad * 2, maxH: bodyMaxH, lh: 1.38 });
    ctx.globalAlpha = 0.92; ctx.fillStyle = ink; ctx.font = "500 " + body.size + "px " + family;
    var by = bottomLimit - body.height;           // corpo alinhado embaixo, como no preview
    body.lines.forEach(function (l, k) { ctx.fillText(l, pad, by + k * body.size * 1.38); });
    ctx.textAlign = "right";
    if (i === 0 && total > 1) {
      // capa: chamada visual pra arrastar (aumenta o "swipe rate", sinal forte pro algoritmo)
      ctx.globalAlpha = 1; ctx.fillStyle = COR.destaque; ctx.font = "800 34px " + family;
      ctx.fillText("ARRASTA  →", SLIDE_W - pad, bottomLimit + 26);
    } else {
      ctx.globalAlpha = 0.7; ctx.font = "500 30px \"JetBrains Mono\", monospace";
      ctx.fillText((i + 1) + "/" + total, SLIDE_W - pad, bottomLimit + 30);
    }
    ctx.globalAlpha = 1; ctx.textAlign = "left";
    rodapeMarcaLinha(ctx, SLIDE_W, pad, bottomLimit + 26, bgImg ? "#fff" : ink, family);

    // teste grátis e conta admin (divulgação da própria Vitrine): faixa com o link da plataforma em cada página
    if (comLinkVitrine()) {
      var faixaH = 64, faixaY = SLIDE_H - (alto ? 250 : 0) - faixaH;
      ctx.fillStyle = "rgba(5,6,13,0.78)"; ctx.fillRect(0, faixaY, SLIDE_W, faixaH);
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.font = "600 26px Manrope, Arial, sans-serif";
      ctx.fillText("Criado com Vitrine  ·  " + LINK_VITRINE, SLIDE_W / 2, faixaY + 42);
      ctx.textAlign = "left";
    }

    return new Promise(function (resolve, reject) {
      try { cv.toBlob(function (b) { b ? resolve(b) : reject(new Error("Falha ao gerar imagem.")); }, "image/jpeg", 0.9); }
      catch (e) { reject(e); }
    });
  }

  function uploadSlide(blob, path) { return uploadArquivo(blob, path, "image/jpeg"); }
  async function uploadArquivo(blob, path, tipo) {
    await Auth.ensureValidToken();
    var s = Auth.get();
    var res = await fetch(SUPABASE_URL + "/storage/v1/object/slides-render/" + path, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + s.access_token, "Content-Type": tipo || "application/octet-stream" },
      body: blob
    });
    if (!res.ok) throw new Error("Upload da imagem falhou: " + (await res.text().catch(function () { return res.status; })));
    return SUPABASE_URL + "/storage/v1/object/public/slides-render/" + path;
  }

  // gera os JPEGs de todos os slides em memória (ainda não sobe nada)
  async function renderCarouselBlobs(c, onProgress, formato) {
    var alto = formato === "stories" || formato === "reels";
    var tpl = findTemplateById(c.template_id);
    var slug = (tpl && tpl.slug) || "minimalista";
    await carregarFonte(c.fonte);
    await prepararMarca();   // logo + nome + CRECI no rodapé de todos os slides
    var melhorar = c.melhorar_fotos !== false;   // ✨ Melhorar fotos (ligado por padrão)
    try { await garantirFotosReais(c.slides, contextoDoCarrossel(c), true); }
    catch (e) { toast("Não consegui buscar as fotos: " + e.message); }
    var out = [];
    FICHA = c.origem === "imovel" ? (findProp(c.propriedade_id) || null) : null;   // ficha-imovel: só dados do cadastro
    var idsIg = c.instagram_contas_ids || [], contaPost = contasAtivas().filter(function (x) { return idsIg.indexOf(x.id) >= 0; })[0] || contaSelecionada();
    AUTOR_IG = contaPost && contaPost.username ? contaPost.username : null;   // post-social mostra o @ desta conta
    var imgs = [];
    for (var k = 0; k < c.slides.length; k++) imgs.push(slideImageUrl(c.slides[k]) ? await loadImage(slideImageUrl(c.slides[k]), melhorar) : null);
    VIZINHOS = imgs.filter(Boolean);
    for (var i = 0; i < c.slides.length; i++) {
      var sl = c.slides[i];
      if (onProgress) onProgress(i + 1, c.slides.length);
      var img = imgs[i];
      var blob = await renderSlideJpeg(sl, i, c.slides.length, slug, img, alto, c.fonte);
      out.push({ blob: blob, url: URL.createObjectURL(blob) });
    }
    return out;
  }

  // sobe os JPEGs já aprovados no Storage e grava render_url em cada slide
  async function uploadCarouselBlobs(c, blobs, onProgress) {
    var stamp = Date.now();
    for (var i = 0; i < blobs.length; i++) {
      if (onProgress) onProgress(i + 1, blobs.length);
      var url = await uploadSlide(blobs[i].blob, state.profile.id + "/" + c.id + "/" + stamp + "-" + (i + 1) + ".jpg");
      await DB.update("slides", "id=eq." + c.slides[i].id, { render_url: url });
      c.slides[i].render_url = url;
    }
  }

  // agendamento: deixa as imagens do feed prontas no Storage (render_url) pro servidor publicar na hora marcada
  async function prepararAgendado(c, onProgress) {
    var blobs = await renderCarouselBlobs(c, onProgress, "feed");
    await uploadCarouselBlobs(c, blobs);
    blobs.forEach(function (b) { setTimeout(function () { URL.revokeObjectURL(b.url); }, 30000); });
  }
  // agendados antigos (de antes da publicação automática) sem imagens: prepara em segundo plano quando o app abre
  async function prepararAgendadosPendentes() {
    var pend = state.carrosseis.filter(function (c) {
      return c.status === "agendado" && !ehReels(c) && c.slides && c.slides.length && c.slides.some(function (s) { return !s.render_url; });
    });
    for (var i = 0; i < pend.length; i++) {
      try { await prepararAgendado(pend[i]); } catch (e) { console.warn("agendado sem imagens:", e); }
    }
  }

  var HASHTAGS = "#mercadoimobiliario #imoveis #corretordeimoveis #fortaleza #dicasimobiliarias";
  function legendaPadrao(c) {
    var sl = c.slides || [];
    var leg = c.legenda;
    if (!leg) {
      // legenda pensada pra viralizar: gancho da capa + CTA do último slide + pedido de salvar/compartilhar + hashtags
      var capa = sl[0] ? semMarcas(sl[0].titulo) : "";
      var cta = sl.length > 1 ? semMarcas(sl[sl.length - 1].corpo || sl[sl.length - 1].titulo) : "";
      leg = [capa ? capa + " 👇" : "", cta, c.origem === "imovel" ? "📲 Fotos e detalhes: link na bio" : "", "📌 Salva pra não perder e manda pra quem precisa ver isso.", HASHTAGS].filter(Boolean).join("\n\n");
    }
    return comLinkVitrine() ? leg + "\n\n✨ Criado com a Vitrine — " + LINK_VITRINE : leg;
  }

  var FORMATOS = {
    feed: { nome: "Feed", desc: "Carrossel no feed (4:5)", alto: false },
    reels: { nome: "Reels", desc: "Vídeo 9:16 — 3 s por slide", alto: true },
    stories: { nome: "Stories", desc: "Um story por slide (9:16)", alto: true }
  };

  // gera um MP4 9:16 no navegador: cada slide aparece 3 s, com transição suave
  async function gerarVideoReels(blobs, onProgress, musica) {
    var tipos = musica ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"] : ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4"];
    var tipo = window.MediaRecorder && tipos.find(function (t) { return MediaRecorder.isTypeSupported(t); });
    if (!tipo) throw new Error("Seu navegador não consegue gerar vídeo MP4. Use o Google Chrome atualizado para publicar Reels.");
    var W = 1080, H = 1920, POR = 3000, FADE = 450;
    var imgs = await Promise.all(blobs.map(function (b) { return createImageBitmap(b.blob); }));
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d"); ctx.drawImage(imgs[0], 0, 0, W, H);
    var total = imgs.length * POR;
    // trilha (opcional): toca só para o gravador, com entrada e saída suaves
    var ac = null, fonteAudio = null, faixasAudio = [];
    if (musica) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        ac = new AC(); await ac.resume();
        var buf = await ac.decodeAudioData(await musica.arrayBuffer());
        var dest = ac.createMediaStreamDestination(), g = ac.createGain();
        fonteAudio = ac.createBufferSource(); fonteAudio.buffer = buf; fonteAudio.loop = true;
        fonteAudio.connect(g); g.connect(dest);
        var agora = ac.currentTime, seg = total / 1000;
        g.gain.setValueAtTime(0, agora); g.gain.linearRampToValueAtTime(0.9, agora + 0.8);
        g.gain.setValueAtTime(0.9, agora + Math.max(1, seg - 1.6)); g.gain.linearRampToValueAtTime(0, agora + seg);
        faixasAudio = dest.stream.getAudioTracks();
      } catch (e) { console.warn("trilha:", e); toast("Não consegui usar a música; o vídeo sai sem música."); faixasAudio = []; }
    }
    var saida = new MediaStream(cv.captureStream(30).getVideoTracks().concat(faixasAudio));
    var rec = new MediaRecorder(saida, faixasAudio.length ? { mimeType: tipo, videoBitsPerSecond: 8000000, audioBitsPerSecond: 128000 } : { mimeType: tipo, videoBitsPerSecond: 8000000 });
    var partes = []; rec.ondataavailable = function (e) { if (e.data && e.data.size) partes.push(e.data); };
    rec.start(250);
    if (fonteAudio) fonteAudio.start();
    var t0 = performance.now();
    await new Promise(function (fim) {
      (function quadro() {
        var t = performance.now() - t0;
        if (t >= total) { fim(); return; }
        var i = Math.min(imgs.length - 1, Math.floor(t / POR)), local = t - i * POR;
        ctx.globalAlpha = 1; ctx.drawImage(imgs[i], 0, 0, W, H);
        if (local > POR - FADE && i < imgs.length - 1) { ctx.globalAlpha = (local - (POR - FADE)) / FADE; ctx.drawImage(imgs[i + 1], 0, 0, W, H); ctx.globalAlpha = 1; }
        if (onProgress) onProgress(Math.min(99, Math.round(t / total * 100)));
        requestAnimationFrame(quadro);
      })();
    });
    await new Promise(function (r) { rec.onstop = r; rec.stop(); });
    try { if (fonteAudio) fonteAudio.stop(); if (ac) ac.close(); } catch (e) { }
    var bruto = new Blob(partes, { type: "video/mp4" });
    try { return new Blob([remuxMp4(new Uint8Array(await bruto.arrayBuffer()))], { type: "video/mp4" }); } catch (e) { console.warn("remux:", e); return bruto; }
  }

  /* ============================================================
     REELS AGENDADOS — vídeo pronto guardado no Storage e publicado sozinho na hora marcada
     (carrosseis.formato = 'reels' + carrosseis.video_url; o servidor publica em publicar-agendados)
  ============================================================ */
  var PASTA_PUBLICA = SUPABASE_URL + "/storage/v1/object/public/slides-render/";
  function ehReels(c) { return !!(c && c.formato === "reels"); }
  function videoDe(c) { var u = (c && c.video_url) || ""; return ehReels(c) && u.indexOf(PASTA_PUBLICA) === 0 ? u : ""; }
  function thumbReels(c) {
    var v = videoDe(c);
    return '<div class="reels-mini">' + (v ? '<video src="' + escapeHtml(v) + '#t=0.8" muted playsinline preload="metadata"></video>' : "") + '<span aria-hidden="true">▶</span></div>';
  }
  function tagReels() { return '<span class="pill pill-reels">▶ Reels</span>'; }
  /* MP4 fragmentado (o que o MediaRecorder do Chrome grava) → MP4 normal, com o índice (moov) no começo.
     O Instagram recusa MP4 fragmentado; aqui só reorganizamos as caixas, sem recomprimir (rápido, sem perda).
     Se o arquivo já for MP4 normal, devolve como está. */
  function remuxMp4(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    function tipo(o) { return String.fromCharCode(u8[o + 4], u8[o + 5], u8[o + 6], u8[o + 7]); }
    function caixas(ini, fim) {
      var out = [], o = ini;
      while (o + 8 <= fim) {
        var sz = dv.getUint32(o), h = 8;
        if (sz === 1) { sz = Number(dv.getBigUint64(o + 8)); h = 16; } else if (sz === 0) sz = fim - o;
        if (sz < 8) break;
        out.push({ t: tipo(o), o: o, d: o + h, fim: Math.min(o + sz, fim) });
        o += sz;
      }
      return out;
    }
    function achar(l, t) { for (var i = 0; i < l.length; i++) if (l[i].t === t) return l[i]; return null; }
    function filhos(b) { return caixas(b.d, b.fim); }
    var topo = caixas(0, u8.length);
    var moov = achar(topo, "moov");
    if (!moov) throw new Error("Vídeo sem índice (moov).");
    if (!topo.some(function (b) { return b.t === "moof"; })) return u8;   // já é MP4 normal
    var mv = filhos(moov);
    var trex = {};
    var mvex = achar(mv, "mvex");
    if (mvex) filhos(mvex).forEach(function (b) {
      if (b.t === "trex") trex[dv.getUint32(b.d + 4)] = { dur: dv.getUint32(b.d + 12), size: dv.getUint32(b.d + 16), flags: dv.getUint32(b.d + 20) };
    });
    var faixas = mv.filter(function (b) { return b.t === "trak"; }).map(function (trak) {
      var tk = filhos(trak), tkhd = achar(tk, "tkhd"), md = filhos(achar(tk, "mdia")), mdhd = achar(md, "mdhd"), mi = filhos(achar(md, "minf"));
      var v1 = u8[tkhd.d] === 1, m1 = u8[mdhd.d] === 1;
      return {
        id: dv.getUint32(tkhd.d + (v1 ? 20 : 12)),
        ts: dv.getUint32(mdhd.d + (m1 ? 20 : 12)),
        vol: dv.getUint16(tkhd.d + (v1 ? 48 : 36)),
        w: dv.getUint32(tkhd.d + (v1 ? 88 : 76)), h: dv.getUint32(tkhd.d + (v1 ? 92 : 80)),
        hdlr: achar(md, "hdlr"), mhd: achar(mi, "vmhd") || achar(mi, "smhd") || achar(mi, "nmhd"), dinf: achar(mi, "dinf"),
        stsd: achar(filhos(achar(mi, "stbl")), "stsd"), am: []
      };
    });
    if (!faixas.length) throw new Error("Vídeo sem faixas.");
    topo.filter(function (b) { return b.t === "moof"; }).forEach(function (moof) {
      filhos(moof).filter(function (b) { return b.t === "traf"; }).forEach(function (traf) {
        var tf = filhos(traf), tfhd = achar(tf, "tfhd"), fl = dv.getUint32(tfhd.d) & 0xffffff, p = tfhd.d + 8;
        var id = dv.getUint32(tfhd.d + 4), fx = faixas.find(function (f) { return f.id === id; });
        if (!fx) return;
        var def = trex[id] || { dur: 0, size: 0, flags: 0 };
        var base = moof.o, dDur = def.dur, dSize = def.size, dFlags = def.flags;
        if (fl & 1) { base = Number(dv.getBigUint64(p)); p += 8; }
        if (fl & 2) p += 4;
        if (fl & 8) { dDur = dv.getUint32(p); p += 4; }
        if (fl & 0x10) { dSize = dv.getUint32(p); p += 4; }
        if (fl & 0x20) { dFlags = dv.getUint32(p); p += 4; }
        var fimAnterior = null;
        tf.filter(function (b) { return b.t === "trun"; }).forEach(function (trun) {
          var v = u8[trun.d], f = dv.getUint32(trun.d) & 0xffffff, q = trun.d + 4, n = dv.getUint32(q); q += 4;
          var off = fimAnterior !== null ? fimAnterior : base;
          if (f & 1) { off = base + dv.getInt32(q); q += 4; }
          var primeira = null; if (f & 4) { primeira = dv.getUint32(q); q += 4; }
          for (var i = 0; i < n; i++) {
            var dur = dDur, size = dSize, flags = dFlags, cts = 0;
            if (f & 0x100) { dur = dv.getUint32(q); q += 4; }
            if (f & 0x200) { size = dv.getUint32(q); q += 4; }
            if (f & 0x400) { flags = dv.getUint32(q); q += 4; } else if (i === 0 && primeira !== null) flags = primeira;
            if (f & 0x800) { cts = v === 0 ? dv.getUint32(q) : dv.getInt32(q); q += 4; }
            fx.am.push({ off: off, size: size, dur: dur, sync: !((flags >>> 16) & 1), cts: cts });
            off += size;
          }
          fimAnterior = off;
        });
      });
    });
    faixas = faixas.filter(function (f) { return f.am.length; });
    if (!faixas.length) throw new Error("Vídeo vazio.");
    var enc = new TextEncoder(), MTS = 1000;
    function cx(t) {
      var partes = Array.prototype.slice.call(arguments, 1), len = 8;
      partes.forEach(function (p) { len += p.length; });
      var b = new Uint8Array(len); new DataView(b.buffer).setUint32(0, len); b.set(enc.encode(t), 4);
      var o = 8; partes.forEach(function (p) { b.set(p, o); o += p.length; }); return b;
    }
    function u32s(vs) { var b = new Uint8Array(vs.length * 4), d = new DataView(b.buffer); vs.forEach(function (v, i) { d.setUint32(i * 4, v >>> 0); }); return b; }
    function cru(b) { return u8.slice(b.o, b.fim); }
    function grupos(lista) { var g = []; lista.forEach(function (x) { var l = g[g.length - 1]; if (l && l[1] === x) l[0]++; else g.push([1, x]); }); return g; }
    var matriz = u32s([0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000]);
    faixas.forEach(function (fx) {
      var ds = fx.am.map(function (a) { return a.dur; }).filter(function (d) { return d > 0; });
      var med = ds.length ? Math.round(ds.reduce(function (a, b) { return a + b; }, 0) / ds.length) : Math.round(fx.ts / 30);
      fx.am.forEach(function (a) { if (!a.dur) a.dur = med; });
      fx.total = fx.am.reduce(function (s, a) { return s + a.dur; }, 0);
      fx.mdur = Math.round(fx.total / fx.ts * MTS);
    });
    var mdur = Math.max.apply(null, faixas.map(function (f) { return f.mdur; }));
    var proxId = Math.max.apply(null, faixas.map(function (f) { return f.id; })) + 1;
    function fazerMoov(mdatIni) {
      var pos = mdatIni, traks = faixas.map(function (fx) {
        var offs = fx.am.map(function (a) { var o = pos; pos += a.size; return o; });
        var stt = grupos(fx.am.map(function (a) { return a.dur; }));
        var stts = cx("stts", u32s([0, stt.length].concat([].concat.apply([], stt))));
        var ctts = new Uint8Array(0);
        if (fx.am.some(function (a) { return a.cts !== 0; })) { var cg = grupos(fx.am.map(function (a) { return a.cts; })); ctts = cx("ctts", u32s([0, cg.length].concat([].concat.apply([], cg)))); }
        var syn = []; fx.am.forEach(function (a, i) { if (a.sync) syn.push(i + 1); });
        var stss = syn.length === fx.am.length ? new Uint8Array(0) : cx("stss", u32s([0, syn.length].concat(syn)));
        var stsz = cx("stsz", u32s([0, 0, fx.am.length].concat(fx.am.map(function (a) { return a.size; }))));
        var stsc = cx("stsc", u32s([0, 1, 1, 1, 1]));
        var stco = cx("stco", u32s([0, offs.length].concat(offs)));
        var tkhd = cx("tkhd", u32s([3, 0, 0, fx.id, 0, fx.mdur, 0, 0]), new Uint8Array([0, 0, 0, 0, fx.vol >> 8, fx.vol & 255, 0, 0]), matriz, u32s([fx.w, fx.h]));
        var mdhd = cx("mdhd", u32s([0, 0, 0, fx.ts, fx.total]), new Uint8Array([0x55, 0xc4, 0, 0]));
        var stbl = cx("stbl", cru(fx.stsd), stts, ctts, stss, stsc, stsz, stco);
        var minf = cx("minf", fx.mhd ? cru(fx.mhd) : new Uint8Array(0), cru(fx.dinf), stbl);
        return cx("trak", tkhd, cx("mdia", mdhd, cru(fx.hdlr), minf));
      });
      var mvhd = cx("mvhd", u32s([0, 0, 0, MTS, mdur, 0x10000]), new Uint8Array([1, 0, 0, 0]), u32s([0, 0]), matriz, u32s([0, 0, 0, 0, 0, 0, proxId]));
      return cx.apply(null, ["moov", mvhd].concat(traks));
    }
    var ftyp = cx("ftyp", enc.encode("isom"), u32s([0x200]), enc.encode("isomiso2avc1mp41"));
    var dados = 0; faixas.forEach(function (fx) { fx.am.forEach(function (a) { dados += a.size; }); });
    var moovN = fazerMoov(0);
    var ini = ftyp.length + moovN.length + 8;
    moovN = fazerMoov(ini);
    var out = new Uint8Array(ini + dados);
    out.set(ftyp, 0); out.set(moovN, ftyp.length);
    new DataView(out.buffer).setUint32(ftyp.length + moovN.length, 8 + dados); out.set(enc.encode("mdat"), ftyp.length + moovN.length + 4);
    var o = ini;
    faixas.forEach(function (fx) { fx.am.forEach(function (a) { out.set(u8.subarray(a.off, a.off + a.size), o); o += a.size; }); });
    return out;
  }
  // deixa o vídeo do jeito que o Instagram aceita: MP4 com índice no começo (sem recomprimir)
  async function videoParaInstagram(blob) {
    if (!/mp4/i.test(blob.type || "")) throw new Error("Este navegador gravou o vídeo em WEBM, que o Instagram não aceita. Gere o vídeo no Google Chrome atualizado ou no Safari 17+.");
    var u8 = new Uint8Array(await blob.arrayBuffer());
    return new Blob([remuxMp4(u8)], { type: "video/mp4" });
  }
  async function subirVideoReels(blob) {
    var mp4 = await videoParaInstagram(blob);
    if (mp4.size > 50 * 1024 * 1024) throw new Error("O vídeo passou de 50 MB. Encurte o vídeo e tente de novo.");
    return uploadArquivo(mp4, state.profile.id + "/reels/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".mp4", "video/mp4");
  }
  // "Como publicar": automático pela Vitrine ou pelo app (para escolher a música da biblioteca do Instagram)
  function comoPublicarHtml(manual) {
    return '<div class="ag-formato"><div class="ag-contas-t">Como publicar</div><div class="ag-fmt">' +
      '<button type="button" class="ag-fmt-b' + (manual ? "" : " on") + '" data-ag-modo="auto"><b>Automático</b><span>a Vitrine publica sozinha na hora</span></button>' +
      '<button type="button" class="ag-fmt-b' + (manual ? " on" : "") + '" data-ag-modo="app"><b>🎵 Eu posto pelo app</b><span>para escolher a música do Instagram</span></button></div>' +
      '<p class="ag-fmt-dica" id="ag-modo-dica"' + (manual ? "" : " hidden") + '>Na hora marcada você recebe um aviso no celular e no e-mail. Abra a Vitrine, toque em <b>Postar pelo app</b>: o vídeo vai para o Instagram com a legenda copiada, e lá você escolhe a música.</p></div>';
  }
  function ligarComoPublicar(root, aoMudar) {
    function info(app) {
      var inf = qs(".ag-info", root); if (!inf) return;
      if (inf.dataset.orig == null) inf.dataset.orig = inf.innerHTML;
      inf.innerHTML = app ? "🎵 Na hora marcada a Vitrine te avisa no celular e no e-mail para postar pelo app e escolher a música." : inf.dataset.orig;
    }
    qsa("[data-ag-modo]", root).forEach(function (b) {
      b.onclick = function () {
        qsa("[data-ag-modo]", root).forEach(function (x) { x.classList.toggle("on", x === b); });
        var dica = qs("#ag-modo-dica", root); if (dica) dica.hidden = b.dataset.agModo !== "app";
        info(b.dataset.agModo === "app");
        if (aoMudar) aoMudar(b.dataset.agModo === "app");
      };
    });
    var atual = qs('[data-ag-modo="app"].on', root); if (atual) info(true);
  }
  function musicaHtml() {
    var L = (window.VitrineMusicas && window.VitrineMusicas.lista) || [];
    if (!L.length) return "";
    return '<div class="ag-formato"><div class="ag-contas-t">Música do vídeo</div><div class="ag-mus">' +
      '<button type="button" class="ag-mus-b on" data-ag-mus="">Sem música</button>' +
      L.map(function (t) { return '<button type="button" class="ag-mus-b" data-ag-mus="' + t.id + '" title="' + escapeHtml(t.desc) + '">▶ ' + escapeHtml(t.nome) + '</button>'; }).join("") +
      '</div><audio id="ag-mus-ouvir" preload="none"></audio><p class="ag-fmt-dica">Trilhas da própria Vitrine: sem direitos autorais e sem custo. Toque para ouvir.</p></div>';
  }
  function ligarMusica(root, aoMudar) {
    var player = qs("#ag-mus-ouvir", root);
    qsa("[data-ag-mus]", root).forEach(function (b) {
      b.onclick = async function () {
        qsa("[data-ag-mus]", root).forEach(function (x) { x.classList.toggle("on", x === b); });
        var id = b.dataset.agMus; aoMudar(id || null);
        if (!player) return;
        player.pause();
        if (!id) return;
        try { var f = await window.VitrineMusicas.carregar(id); if (player.dataset.url) URL.revokeObjectURL(player.dataset.url); player.dataset.url = URL.createObjectURL(f); player.src = player.dataset.url; player.currentTime = 0; player.play().catch(function () { }); }
        catch (e) { toast("Não consegui carregar a trilha: " + e.message); }
      };
    });
    return function () { if (player) player.pause(); };
  }
  function usuarioDoPost(c) {
    var d = c ? destinosDoCarrossel(c) : [];
    var u = d[0] ? d[0].replace(/^@/, "") : ((contaSelecionada() && contaSelecionada().username) || (state.profile.nome || "seu_perfil").toLowerCase().replace(/\s+/g, ""));
    return u;
  }

  // prévia igual à tela do Reels no Instagram (vídeo de verdade, o mesmo que vai ser publicado)
  function previaReels(fonte, legenda, user, aoFechar) {
    var body = document.getElementById("modal-body");
    body.innerHTML =
      '<div class="modal-head"><div><h3 style="font-size:18px;">Como vai ficar no Reels</h3>' +
      '<p style="margin:4px 0 0;font-size:12.5px;color:var(--ink-muted);">Este é o vídeo que vai ser publicado. Toque no vídeo para ligar o som.</p></div>' +
      '<button class="modal-close" id="rp-close">' + ICONS.close + '</button></div>' +
      '<div class="reels-pv">' +
      '<video id="rp-v" src="' + escapeHtml(fonte) + '" autoplay muted loop playsinline preload="auto"></video>' +
      '<div class="reels-pv-carregando" id="rp-load"><div class="spin"></div><span>Carregando o vídeo…</span></div>' +
      '<div class="reels-pv-topo"><b>Reels</b></div>' +
      '<div class="reels-pv-lado" aria-hidden="true"><span>♡</span><span>💬</span><span>➤</span><span>⋯</span></div>' +
      '<div class="reels-pv-base"><div class="reels-pv-user"><i>' + escapeHtml(user.slice(0, 1).toUpperCase()) + '</i><b>' + escapeHtml(user) + '</b><em>Seguir</em></div>' +
      '<div class="reels-pv-leg" id="rp-leg">' + escapeHtml(legenda || "") + '</div></div>' +
      '<button type="button" class="reels-pv-som" id="rp-som" aria-label="Som">🔇</button>' +
      '<div class="reels-pv-barra"><i id="rp-barra"></i></div></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;"><button class="btn btn-ghost btn-sm" id="rp-voltar">Voltar</button></div>';
    document.getElementById("overlay").hidden = false;
    var v = document.getElementById("rp-v"), som = document.getElementById("rp-som");
    function alternarSom() { v.muted = !v.muted; som.textContent = v.muted ? "🔇" : "🔊"; if (v.paused) v.play().catch(function () {}); }
    som.onclick = function (e) { e.stopPropagation(); alternarSom(); };
    v.onclick = alternarSom;
    v.ontimeupdate = function () { var b = document.getElementById("rp-barra"); if (b && v.duration) b.style.width = (v.currentTime / v.duration * 100) + "%"; };
    v.onerror = function () { var l = document.getElementById("rp-load"); if (l) l.innerHTML = "<span>Não consegui carregar o vídeo. Verifique a internet e tente de novo.</span>"; };
    v.onplaying = v.onloadeddata = function () { var l = document.getElementById("rp-load"); if (l) l.hidden = true; };
    document.getElementById("rp-leg").onclick = function () { this.classList.toggle("aberta"); };
    function fechar() { try { v.pause(); } catch (e) { } if (aoFechar) aoFechar(); else closeModal(); }
    document.getElementById("rp-close").onclick = fechar;
    document.getElementById("rp-voltar").onclick = fechar;
  }

  // postar na mão (app do Instagram): compartilha ou baixa o vídeo pronto e copia a legenda
  async function postarReelsNaMao(c, btn) {
    var v = videoDe(c); if (!v) { toast("O vídeo deste Reels não foi encontrado."); return; }
    var orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Preparando o vídeo…"; }
    try {
      var r = await fetch(v); if (!r.ok) throw new Error("download " + r.status);
      var blob = await r.blob();
      var leg = c.legenda || getSubjectMeta(c).titulo;
      try { if (navigator.clipboard) await navigator.clipboard.writeText(leg); } catch (e) { }
      var arq = new File([blob], "vitrine-reels.mp4", { type: "video/mp4" });
      var podeComp = false; try { podeComp = !!(navigator.canShare && navigator.share && navigator.canShare({ files: [arq] })); } catch (e) { }
      if (podeComp) {
        try { await navigator.share({ files: [arq], title: "Reels Vitrine" }); toast("Legenda copiada — no Instagram é só colar."); }
        catch (e) { if (e && e.name !== "AbortError") throw e; }
      } else {
        var u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = "vitrine-reels.mp4";
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
        toast("Vídeo baixado e legenda copiada. No Instagram: Criar → Reels → escolha o vídeo e cole a legenda.");
      }
    } catch (e) { toast("Não consegui preparar o vídeo: " + e.message); }
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }

  function openReelsModal(c) {
    var meta = getSubjectMeta(c), v = videoDe(c);
    var pillCls = c.status === "publicado" ? "pill-publicado" : c.status === "agendado" ? "pill-agendado" : "pill-draft";
    var horaDePostar = c.status === "agendado" && c.publicar_manual && new Date(c.data_agendada) <= new Date();
    var quando = c.status === "agendado" && c.publicar_manual ? (horaDePostar ? "⏰ Hora de postar! Toque em Postar pelo app e escolha a música no Instagram" : "Você posta pelo app em " + fmtDateTime(c.data_agendada) + " — a Vitrine te avisa na hora")
      : c.status === "agendado" ? "Publica sozinho em " + fmtDateTime(c.data_agendada)
      : c.status === "publicado" ? "Publicado " + fmtDate(c.data_publicada)
      : c.status === "aguardando_aprovacao" ? "Aguardando aprovação do gestor" + (c.data_agendada ? " · para " + fmtDateTime(c.data_agendada) : "")
      : "Rascunho — escolha o dia e o horário para publicar";
    var destinos = destinosDoCarrossel(c);
    var botoes = c.status === "publicado"
      ? (igLink(c.instagram_permalink) ? '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(igLink(c.instagram_permalink)) + '" target="_blank" rel="noopener noreferrer">' + ICONS.ig + ' Ver no Instagram</a>' : "")
      : '<button class="btn btn-ghost btn-sm" id="rm-previa">' + ICONS.eye + ' Ver como fica</button>' +
        '<button class="btn btn-ghost btn-sm" id="rm-agendar">📅 ' + (c.status === "agendado" ? "Reagendar" : "Agendar") + '</button>' +
        (c.status === "agendado" ? '<button class="btn btn-ghost btn-sm" id="rm-publicado">' + ICONS.check + ' Marcar como publicado</button>' : "") +
        '<button class="btn btn-primary btn-sm" id="rm-mao">📲 Postar pelo app' + (c.publicar_manual ? " (escolher música)" : "") + '</button>';
    document.getElementById("modal-body").innerHTML =
      '<div class="modal-head"><div><h3 style="font-size:19px;">' + escapeHtml(meta.titulo) + '</h3>' +
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;"><span class="pill ' + pillCls + '">' + escapeHtml(c.status === "aguardando_aprovacao" ? "aguardando aprovação" : c.status) + '</span>' + tagReels() + '</div></div>' +
      '<button class="modal-close" id="modal-close">' + ICONS.close + '</button></div>' +
      '<div class="reels-modal">' +
      (v ? '<video class="reels-player" src="' + escapeHtml(v) + '" controls playsinline preload="metadata"></video>'
         : '<div class="reels-player reels-sem">Vídeo não encontrado</div>') +
      '<div class="reels-info">' +
      '<div class="reels-quando' + (horaDePostar ? " agora" : "") + '">' + escapeHtml(quando) + '</div>' +
      (destinos.length ? '<div class="reels-dest">' + ICONS.ig + ' ' + escapeHtml(destinos.join(", ")) + '</div>' : "") +
      (c.erro_publicacao ? '<div class="meta erro-pub">⚠ ' + escapeHtml(c.erro_publicacao) + '</div>' : "") +
      '<label class="reels-leg-lb" for="rm-leg">Legenda</label>' +
      (c.status === "publicado"
        ? '<div class="reels-leg-txt">' + escapeHtml(c.legenda || "") + '</div>'
        : '<textarea id="rm-leg" class="reels-leg" maxlength="2200" placeholder="Escreva a legenda do Reels">' + escapeHtml(c.legenda || "") + '</textarea>' +
          '<div class="reels-leg-acoes"><span id="rm-leg-n">' + (c.legenda || "").length + '/2200</span><button class="btn btn-ghost btn-sm" id="rm-leg-salvar" disabled>Salvar legenda</button></div>') +
      '</div></div>' +
      '<div class="reels-botoes">' + botoes + '</div>';
    document.getElementById("overlay").hidden = false;
    document.getElementById("modal-close").onclick = closeModal;
    var ta = document.getElementById("rm-leg"), sv = document.getElementById("rm-leg-salvar");
    if (ta) {
      ta.oninput = function () { document.getElementById("rm-leg-n").textContent = ta.value.length + "/2200"; sv.disabled = ta.value === (c.legenda || ""); };
      sv.onclick = async function () {
        sv.disabled = true; var t = sv.textContent; sv.textContent = "Salvando…";
        try { await DB.update("carrosseis", "id=eq." + c.id, { legenda: ta.value.trim() }); c.legenda = ta.value.trim(); toast("Legenda salva."); }
        catch (e) { toast("Erro ao salvar a legenda: " + e.message); sv.disabled = false; }
        sv.textContent = t;
      };
    }
    function legendaAtual() { return ta ? ta.value : (c.legenda || ""); }
    var pv = document.getElementById("rm-previa");
    if (pv) pv.onclick = function () { if (!v) { toast("O vídeo deste Reels não foi encontrado."); return; } var leg = legendaAtual(); previaReels(v, leg, usuarioDoPost(c), function () { openReelsModal(c); var t2 = document.getElementById("rm-leg"); if (t2 && t2.value !== leg) { t2.value = leg; t2.oninput(); } }); };
    var ag = document.getElementById("rm-agendar");
    if (ag) ag.onclick = function () { abrirAgendarRascunho(c.id); };
    var mao = document.getElementById("rm-mao");
    if (mao) mao.onclick = function () { postarReelsNaMao(c, mao); };
    var mp = document.getElementById("rm-publicado");
    if (mp) mp.onclick = async function () {
      try {
        var pubAt = new Date().toISOString();
        await DB.update("carrosseis", "id=eq." + c.id, { status: "publicado", data_publicada: pubAt });
        c.status = "publicado"; c.data_publicada = pubAt;
        closeModal(); renderPainel(); renderInstagram(); toast("Marcado como publicado.");
      } catch (err) { toast("Erro: " + err.message); }
    };
  }

  // agenda um vídeo novo (feito no editor de Reels) para sair sozinho no Instagram
  function agendarVideoNovo(blob, info) {
    info = info || {};
    if (testeSemPublicacoes()) { avisoFimDoTeste(); return; }
    var previaUrl = URL.createObjectURL(blob);
    var igOn = contasAtivas().length > 0;
    var legIni = info.legenda || "", manualSel = !!info.manual;
    document.getElementById("modal-body").innerHTML =
      '<div class="modal-head"><div><h3 style="font-size:19px;">📅 Agendar Reels</h3>' +
      '<div style="font-size:13px;color:var(--ink-muted);margin-top:4px;">' + escapeHtml(info.titulo || "Reels") + '</div></div>' +
      '<button class="modal-close" id="modal-close">' + ICONS.close + '</button></div>' +
      '<div class="reels-modal"><video class="reels-player" src="' + previaUrl + '" controls playsinline muted loop autoplay></video>' +
      '<div class="reels-info">' +
      '<div class="agendar-rapido">' +
      '<label>Dia<input type="date" id="ag-data" value="' + ymd(addDays(1)) + '" min="' + ymd(new Date()) + '" max="' + ymd(addDays(90)) + '"></label>' +
      '<label>Horário<input type="time" id="ag-hora" value="18:00" step="300"></label></div>' +
      '<div class="ag-chips">' + HORARIOS_TOP.map(function (t) { return '<button type="button" class="cal-slot top" data-ag-hora="' + t + '">' + t + '</button>'; }).join("") + '</div>' +
      '<div id="ag-contas">' + escolhaContasHtml([]) + '</div>' +
      comoPublicarHtml(manualSel) +
      '<label class="reels-leg-lb" for="ag-leg">Legenda</label>' +
      '<textarea id="ag-leg" class="reels-leg" maxlength="2200" placeholder="Escreva a legenda do Reels">' + escapeHtml(legIni) + '</textarea>' +
      (igOn ? '<p class="ag-info">Na hora marcada, a Vitrine publica sozinha no seu Instagram — mesmo com o app fechado.</p>'
            : '<p class="ag-info ag-warn">⚠ Seu Instagram ainda não está conectado. Conecte na aba Instagram até o horário, senão o Reels não sai sozinho.</p>') +
      '</div></div>' +
      '<div class="reels-botoes"><button class="btn btn-ghost btn-sm" id="ag-cancelar">Cancelar</button>' +
      '<button class="btn btn-ghost btn-sm" id="ag-previa">' + ICONS.eye + ' Ver como fica</button>' +
      '<button class="btn btn-primary btn-sm" id="ag-confirmar">📅 Confirmar agendamento</button></div>';
    document.getElementById("overlay").hidden = false;
    function sair() { closeModal(); setTimeout(function () { URL.revokeObjectURL(previaUrl); }, 60000); }
    document.getElementById("modal-close").onclick = sair;
    document.getElementById("ag-cancelar").onclick = sair;
    qsa("[data-ag-hora]").forEach(function (b) { b.onclick = function () { document.getElementById("ag-hora").value = b.dataset.agHora; qsa("[data-ag-hora]").forEach(function (x) { x.classList.toggle("on", x === b); }); }; });
    ligarComoPublicar(document.getElementById("modal-body"), function (m) { manualSel = m; });
    document.getElementById("ag-previa").onclick = function () {
      var guardado = { d: document.getElementById("ag-data").value, h: document.getElementById("ag-hora").value, l: document.getElementById("ag-leg").value, c: lerContasMarcadas(document.getElementById("ag-contas")) };
      previaReels(previaUrl, guardado.l, (contasAtivas().find(function (x) { return x.id === guardado.c[0]; }) || contaSelecionada() || { username: usuarioDoPost(null) }).username, function () {
        agendarVideoNovo(blob, { titulo: info.titulo, legenda: guardado.l, propriedade_id: info.propriedade_id, manual: manualSel });
        document.getElementById("ag-data").value = guardado.d; document.getElementById("ag-hora").value = guardado.h;
        if (guardado.c[0]) { var r = document.querySelector('[data-conta-ig="' + guardado.c[0] + '"]'); if (r) r.checked = true; }
      });
    };
    document.getElementById("ag-confirmar").onclick = async function () {
      var btn = this;
      var d = document.getElementById("ag-data").value, t = document.getElementById("ag-hora").value || "18:00";
      if (!d) { toast("Escolha o dia da publicação."); return; }
      var quando = new Date(d + "T" + t);
      if (quando <= new Date(Date.now() + 5 * 60000)) { toast("Esse horário já passou (ou está em menos de 5 minutos) — escolha outro."); return; }
      if (quando > addDays(90)) { toast("Dá pra agendar até 90 dias à frente."); return; }
      var contasSel = lerContasMarcadas(document.getElementById("ag-contas"));
      var leg = document.getElementById("ag-leg").value.trim();
      btn.disabled = true; var orig = btn.textContent; btn.textContent = "Enviando o vídeo…";
      try {
        var url = await subirVideoReels(blob);
        btn.textContent = "Agendando…";
        var payload = {
          corretor_id: state.profile.id, origem: info.propriedade_id ? "imovel" : "custom", propriedade_id: info.propriedade_id || null,
          assunto_custom: (info.titulo || "Reels").slice(0, 200), categoria: "Reels", status: "agendado", data_agendada: quando.toISOString(),
          legenda: leg || null, instagram_contas_ids: contasSel, formato: "reels", video_url: url, melhorar_fotos: false, fonte: "moderna", publicar_manual: manualSel
        };
        var rows = await DB.insert("carrosseis", payload);
        var novo = rows && rows[0];
        if (!novo) throw new Error("o servidor não confirmou o agendamento.");
        var sl = await DB.insert("slides", [{ carrossel_id: novo.id, ordem: 0, titulo: (info.titulo || "Reels").slice(0, 200), tag: "REELS" }]).catch(function () { return []; });
        novo.slides = sl || [];
        state.carrosseis.unshift(novo);
        sair(); renderPainel(); renderInstagram();
        if (novo.status === "aguardando_aprovacao") toast("Reels enviado para aprovação do gestor.");
        else if (novo.publicar_manual) toast("Reels agendado para " + fmtDateTime(novo.data_agendada) + " — na hora a Vitrine te avisa para postar pelo app e escolher a música.");
        else toast("Reels agendado para " + fmtDateTime(novo.data_agendada) + (igOn ? " — vai ser publicado sozinho no Instagram." : ". Conecte o Instagram até lá pra publicar sozinho."));
      } catch (err) { toast("Não consegui agendar: " + err.message); btn.disabled = false; btn.textContent = orig; }
    };
  }

  // prévia no formato do Instagram com escolha Feed / Reels / Stories.
  // modo "publicar" → resolve {formato, blobs} ou null. modo "ver" → só visualização.
  function abrirPrevia(c, modo, onProgressInicial) {
    return new Promise(function (resolve) {
      var formato = "feed", idx = 0, cache = {}, carregando = false;
      var user = (state.igConta && state.igConta.status === "ativo" && state.igConta.username) || (state.profile.nome || "seu_perfil").toLowerCase().replace(/\s+/g, "");
      var body = document.getElementById("modal-body");
      function liberar() { Object.keys(cache).forEach(function (k) { cache[k].forEach(function (b) { setTimeout(function () { URL.revokeObjectURL(b.url); }, 60000); }); }); }
      function done(v) { liberar(); closeModal(); resolve(v); }
      async function carregar(f) {
        if (cache[f]) return;
        carregando = true; draw();
        try { cache[f] = await renderCarouselBlobs(c, function (n, t) { var el = document.getElementById("pv-load"); if (el) el.textContent = "Gerando imagem " + n + "/" + t + "…"; if (onProgressInicial) onProgressInicial(n, t); }, f); }
        catch (err) { toast("Erro ao gerar a prévia: " + err.message); }
        carregando = false; idx = 0; draw();
      }
      function draw() {
        var blobs = cache[formato] || [], F = FORMATOS[formato];
        var tabs = '<div class="fmt-tabs">' + Object.keys(FORMATOS).map(function (k) {
          return '<button type="button" class="fmt-tab' + (k === formato ? " on" : "") + '" data-fmt="' + k + '"><b>' + FORMATOS[k].nome + '</b><span>' + FORMATOS[k].desc + '</span></button>';
        }).join("") + '</div>';
        var midia = carregando || !blobs.length
          ? '<div class="igpv-media' + (F.alto ? " alto" : "") + '"><div class="igpv-load"><div class="spin"></div><span id="pv-load">Gerando imagens…</span></div></div>'
          : '<div class="igpv-media' + (F.alto ? " alto" : "") + '"><img src="' + blobs[idx].url + '" alt="Slide ' + (idx + 1) + '">' +
            (formato !== "feed" ? '<div class="igpv-bars">' + blobs.map(function (b, k) { return '<i class="' + (k <= idx ? "on" : "") + '"></i>'; }).join("") + '</div>' : '') +
            (idx > 0 ? '<button class="igpv-nav l" id="pv-prev" aria-label="Anterior">‹</button>' : '') +
            (idx < blobs.length - 1 ? '<button class="igpv-nav r" id="pv-next" aria-label="Próximo">›</button>' : '') +
            '<span class="igpv-count">' + (idx + 1) + '/' + blobs.length + '</span>' +
            (formato === "reels" ? '<span class="igpv-tag">Reels · ' + (blobs.length * 3) + ' s</span>' : '') + '</div>';
        var aviso = formato === "feed" && (c.slides.length < 2 || c.slides.length > 10) ? '<p class="fmt-aviso">O carrossel do feed precisa ter de 2 a 10 slides.</p>' : "";
        body.innerHTML =
          '<div class="modal-head"><div><h3 style="font-size:18px;">Como vai ficar no Instagram</h3>' +
          '<p style="margin:4px 0 0;font-size:12.5px;color:var(--ink-muted);">Escolha onde publicar e confira cada slide.</p></div>' +
          '<button class="modal-close" id="pv-close">' + ICONS.close + '</button></div>' + tabs +
          '<div class="igpv' + (F.alto ? " alto" : "") + '"><div class="igpv-head"><div class="igpv-av">' + escapeHtml(user.slice(0, 1).toUpperCase()) + '</div><b>' + escapeHtml(user) + '</b></div>' + midia +
          (formato === "feed" ? '<div class="igpv-dots">' + blobs.map(function (b, k) { return '<span class="' + (k === idx ? "on" : "") + '"></span>'; }).join("") + '</div>' : '') +
          (formato !== "stories" ? '<div class="igpv-cap"><b>' + escapeHtml(user) + '</b> ' + escapeHtml(legendaPadrao(c)) + '</div>' : '') + '</div>' + aviso +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">' +
          (modo === "publicar"
            ? '<button class="btn btn-ghost btn-sm" id="pv-back">Voltar e ajustar</button><button class="btn btn-primary btn-sm" id="pv-ok"' + (carregando || aviso ? " disabled" : "") + '>' + ICONS.ig + ' Publicar no ' + F.nome + '</button>'
            : '<button class="btn btn-ghost btn-sm" id="pv-back">Fechar</button>' + (!carregando && blobs.length && !c._temp ? '<button class="btn btn-primary btn-sm" id="pv-musica">📲 Postar no ' + F.nome + '</button>' : '')) + '</div>';
        document.getElementById("pv-close").onclick = function () { done(null); };
        document.getElementById("pv-back").onclick = function () { done(null); };
        var ok = document.getElementById("pv-ok"); if (ok) ok.onclick = function () { done({ formato: formato, blobs: cache[formato] }); };
        var mu = document.getElementById("pv-musica"); if (mu) mu.onclick = function () { var b = cache[formato]; closeModal(); resolve(null); postarComMusica(c, b, formato); };
        var pr = document.getElementById("pv-prev"); if (pr) pr.onclick = function () { idx--; draw(); };
        var nx = document.getElementById("pv-next"); if (nx) nx.onclick = function () { idx++; draw(); };
        qsa("[data-fmt]", body).forEach(function (b) { b.onclick = function () { if (carregando) return; formato = b.dataset.fmt; idx = 0; draw(); carregar(formato); }; });
      }
      document.getElementById("overlay").hidden = false;
      carregar("feed");
    });
  }

  /* ---------- postar com música: manda as imagens pro app do Instagram ----------
     A API oficial do Instagram não permite escolher música, então a Vitrine entrega as imagens
     prontas pro app (menu Compartilhar do celular) e copia a legenda. A música é escolhida lá. */
  // formato escolhido antes de postar: feed (carrossel 4:5), stories (imagens 9:16) ou reels (vídeo 9:16)
  async function postarComMusica(c, blobsProntos, formatoIni) {
    if (!c.slides || !c.slides.length) { toast("Este carrossel não tem slides."); return; }
    if (testeSemPublicacoes()) { avisoFimDoTeste(); return; }
    var body = document.getElementById("modal-body");
    var formato = FORMATOS[formatoIni] ? formatoIni : "feed";
    var cache = {}, video = null;
    if (blobsProntos && blobsProntos.length) cache[formato] = blobsProntos;
    var blobs = cache[formato] || null;
    var legenda = legendaPadrao(c);
    var NOME_DESTINO = { feed: "Feed", stories: "Story", reels: "Reels" };
    function arquivos() {
      if (formato === "reels" && video) return [new File([video], "vitrine-reels.mp4", { type: "video/mp4" })];
      return blobs.map(function (b, i) { return new File([b.blob], "vitrine-" + (i + 1) + ".jpg", { type: "image/jpeg" }); });
    }
    function podeCompartilhar() {
      try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: arquivos() })); } catch (e) { return false; }
    }
    function copiarLegenda() { try { if (navigator.clipboard) navigator.clipboard.writeText(legenda).catch(function () {}); } catch (e) { } }
    function baixarTodas() {
      if (formato === "reels" && video) { var u = URL.createObjectURL(video), av = document.createElement("a"); av.href = u; av.download = "vitrine-reels.mp4"; document.body.appendChild(av); av.click(); av.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000); return; }
      blobs.forEach(function (b, i) {
        setTimeout(function () { var a = document.createElement("a"); a.href = b.url; a.download = "vitrine-" + (i + 1) + ".jpg"; document.body.appendChild(a); a.click(); a.remove(); }, i * 350);
      });
    }
    var idx = 0;
    var user = (state.igConta && state.igConta.status === "ativo" && state.igConta.username) || (state.profile.nome || "seu_perfil").toLowerCase().replace(/\s+/g, "");
    // prévia igual ao post do Instagram: passa os slides (setas ou arrastando o dedo), legenda e lugar da música
    function previaHtml() {
      return '<div class="igpv mu-previa"><div class="igpv-head"><div class="igpv-av">' + escapeHtml(user.slice(0, 1).toUpperCase()) + '</div>' +
        '<div class="mu-quem"><b>' + escapeHtml(user) + '</b><span class="mu-som">🎵 a música que você escolher no Instagram</span></div></div>' +
        '<div class="igpv-media' + (FORMATOS[formato].alto ? ' alto' : '') + '" id="mu-media"><img src="' + blobs[idx].url + '" alt="Slide ' + (idx + 1) + '" draggable="false">' +
        (idx > 0 ? '<button class="igpv-nav l" id="mu-prev" aria-label="Anterior">‹</button>' : '') +
        (idx < blobs.length - 1 ? '<button class="igpv-nav r" id="mu-next" aria-label="Próximo">›</button>' : '') +
        '<span class="igpv-count">' + (idx + 1) + '/' + blobs.length + '</span></div>' +
        '<div class="igpv-dots">' + blobs.map(function (b, k) { return '<span class="' + (k === idx ? "on" : "") + '"></span>'; }).join("") + '</div>' +
        (formato !== "stories" ? '<div class="igpv-cap"><b>' + escapeHtml(user) + '</b> ' + escapeHtml(legenda) + '</div>' : '') + '</div>';
    }
    function abasHtml() {
      return '<div class="fmt-tabs">' + Object.keys(FORMATOS).map(function (k) {
        return '<button type="button" class="fmt-tab' + (k === formato ? " on" : "") + '" data-mfmt="' + k + '"><b>' + FORMATOS[k].nome + '</b><span>' + FORMATOS[k].desc + '</span></button>';
      }).join("") + '</div>';
    }
    async function carregar(f) {
      formato = f; idx = 0; video = null;
      draw(true);
      try {
        if (!cache[f]) cache[f] = await renderCarouselBlobs(c, function (n, t) { var el = document.getElementById("mu-load"); if (el) el.textContent = "Gerando imagem " + n + "/" + t + "…"; }, f);
        blobs = cache[f];
        if (f === "reels") {
          var el = document.getElementById("mu-load"); if (el) el.textContent = "Montando o vídeo do Reels…";
          video = await gerarVideoReels(blobs);
        }
      } catch (e) { toast("Erro ao gerar: " + e.message); if (f !== "feed") return carregar("feed"); closeModal(); return; }
      draw(false);
    }
    function ligarPrevia() {
      var pr = document.getElementById("mu-prev"); if (pr) pr.onclick = function () { idx--; draw(false); };
      var nx = document.getElementById("mu-next"); if (nx) nx.onclick = function () { idx++; draw(false); };
      var m = document.getElementById("mu-media"); if (!m) return;
      var x0 = null;
      m.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      m.addEventListener("touchend", function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (dx < -40 && idx < blobs.length - 1) { idx++; draw(false); }
        else if (dx > 40 && idx > 0) { idx--; draw(false); }
      });
    }
    function draw(carregando, msg) {
      var celular = !carregando && podeCompartilhar();
      body.innerHTML =
        '<div class="modal-head"><div><h3 style="font-size:18px;">📲 Postar no Instagram</h3>' +
        '<p style="margin:4px 0 0;font-size:12.5px;color:var(--ink-muted);">Escolha onde postar: Feed, Stories ou Reels. Abre o app do Instagram com tudo pronto — lá você pode colocar música.</p></div>' +
        '<button class="modal-close" id="mu-close">' + ICONS.close + '</button></div>' + abasHtml() +
        (carregando
          ? '<div class="igpv-load" style="position:static;padding:30px 0;"><div class="spin"></div><span id="mu-load">' + (msg || "Gerando imagens…") + '</span></div>'
          : '<p class="mu-titulo-previa">Veja como vai ficar antes de postar:</p>' + previaHtml() +
            (celular
              ? '<ol class="mu-passos"><li>Toque em <b>Abrir no Instagram</b> e escolha <b>Instagram → ' + NOME_DESTINO[formato] + '</b>.</li><li>No Instagram, toque no ícone de <b>música 🎵</b> e escolha a sua.</li><li>Na legenda, <b>cole</b> o texto (já copiei pra você) e publique.</li></ol>'
              : formato === "stories"
                ? '<p class="fmt-aviso" style="margin:6px 0;">O Instagram no computador não publica Stories. Baixe as imagens e poste pelo app do celular, ou escolha Feed ou Reels.</p>'
                : '<p class="fmt-aviso" style="margin:6px 0;">Neste computador o navegador não compartilha arquivos direto com o Instagram. Siga os 3 passos:</p>' +
                '<ol class="mu-passos"><li><b>Baixe ' + (formato === "reels" ? 'o vídeo' : 'as ' + blobs.length + ' imagens') + '</b> e <b>copie a legenda</b> (botão abaixo).</li><li>Abra o Instagram no navegador e clique em <b>Criar → Publicação</b>; selecione ' + (formato === "reels" ? 'o <b>vídeo baixado</b>' : 'as <b>' + blobs.length + ' imagens baixadas</b> (na ordem 1, 2, 3…)') + '.</li><li>No campo de legenda, <b>cole</b> (Ctrl+V / ⌘V) e publique.</li></ol>' +
                '<p class="fmt-aviso" style="margin-top:6px;">Para colocar música, use o app do celular — no computador o Instagram não oferece essa opção.</p>')) +
        '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px;">' +
        (carregando ? '' :
          '<button class="btn btn-ghost btn-sm" id="mu-feito">Já postei — marcar como publicado</button>' +
          (celular
            ? '<button class="btn btn-primary btn-sm" id="mu-abrir">' + ICONS.ig + ' Abrir no Instagram</button>'
            : '<button class="btn btn-ghost btn-sm" id="mu-baixar">1. Baixar ' + (formato === "reels" ? 'vídeo' : 'imagens') + ' e copiar legenda</button>' +
              '<button class="btn btn-primary btn-sm" id="mu-ig-web">2. Abrir Instagram.com</button>')) +
        '</div>';
      document.getElementById("mu-close").onclick = closeModal;
      qsa("[data-mfmt]", body).forEach(function (b) { b.onclick = function () { if (!carregando && b.dataset.mfmt !== formato) carregar(b.dataset.mfmt); }; });
      if (!carregando) ligarPrevia();
      var ab = document.getElementById("mu-abrir");
      if (ab) ab.onclick = async function () {
        copiarLegenda();
        try { await navigator.share({ files: arquivos(), title: "Carrossel Vitrine" }); }
        catch (e) { if (e && e.name !== "AbortError") { toast("Não deu pra abrir o compartilhamento — baixando as imagens."); baixarTodas(); } }
      };
      var bx = document.getElementById("mu-baixar");
      if (bx) bx.onclick = function () { copiarLegenda(); baixarTodas(); toast(formato === "reels" ? "Baixando o vídeo — legenda copiada." : "Baixando " + blobs.length + " imagens — legenda copiada."); };
      var igw = document.getElementById("mu-ig-web");
      if (igw) igw.onclick = function () {
        copiarLegenda();   // garante a legenda na área de transferência mesmo se o usuário pulou o botão 1
        window.open("https://www.instagram.com/", "_blank", "noopener");
        toast("No Instagram: Criar → selecione as imagens baixadas → cole a legenda.");
      };
      var ft = document.getElementById("mu-feito");
      if (ft) ft.onclick = async function () {
        ft.disabled = true;
        try {
          var agora = new Date().toISOString();
          await DB.update("carrosseis", "id=eq." + c.id, { status: "publicado", data_publicada: agora });
          c.status = "publicado"; c.data_publicada = agora;
          closeModal(); toast("Marcado como publicado."); if (!document.getElementById("screen-painel").hidden) renderPainel();
        } catch (e) { ft.disabled = false; toast("Erro ao marcar: " + e.message); }
      };
    }
    document.getElementById("overlay").hidden = false;
    if (!blobs || formato === "reels") { await carregar(formato); return; }
    draw(false);
  }

  async function previewCarousel(c) {
    if (!c.slides || !c.slides.length) { toast("Este carrossel não tem slides."); return; }
    await abrirPrevia(c, "ver");
  }


  /* ============================================================
     AUTH UI
  ============================================================ */
  var authMode = "login";
  function renderAuthView(errorMsg, noteMsg) {
    var view = document.getElementById("auth-view");
    view.innerHTML =
      '<div class="auth-shell"><div class="auth-card">' +
      '<button type="button" class="auth-back" id="auth-back">← Conhecer a Vitrine</button>' +
      '<div class="auth-brand"><div class="brand-mark"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><defs><linearGradient id="vtg-auth" x1="6" y1="10" x2="40" y2="44" gradientUnits="userSpaceOnUse"><stop stop-color="#8B5CFF"/><stop offset="1" stop-color="#00E0FF"/></linearGradient></defs><path d="M7 15 L24 42 L41 15" stroke="url(#vtg-auth)" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 7.5 H40" stroke="#fff" stroke-width="5.2" stroke-linecap="round"/><path d="M24 7.5 V29" stroke="#fff" stroke-width="5.2" stroke-linecap="round"/><circle cx="24" cy="42" r="3.4" fill="#00E0FF"/></svg></div>' +
      '<div><div class="brand-name">Vitrine</div><div class="brand-sub" style="margin-top:0;">carrosséis para corretores</div></div></div>' +
      '<div class="auth-tabs">' +
      '<button type="button" class="auth-tab' + (authMode === "login" ? " active" : "") + '" data-authmode="login">Entrar</button>' +
      '<button type="button" class="auth-tab' + (authMode === "signup" ? " active" : "") + '" data-authmode="signup">Criar conta</button>' +
      "</div>" +
      (errorMsg ? '<div class="auth-error">' + escapeHtml(errorMsg) + "</div>" : "") +
      (noteMsg ? '<div class="auth-note">' + escapeHtml(noteMsg) + "</div>" : "") +
      '<form id="auth-form">' +
      (authMode === "signup" ? '<label class="auth-field">Nome<input type="text" id="auth-nome" autocomplete="name" required></label>' +
        '<label class="auth-field">Celular (WhatsApp)<input type="tel" id="auth-tel" autocomplete="tel" inputmode="tel" placeholder="(85) 99999-9999" required></label>' : "") +
      '<label class="auth-field">E-mail<input type="email" id="auth-email" autocomplete="email" required></label>' +
      '<label class="auth-field">Senha<input type="password" id="auth-pass" autocomplete="' + (authMode === "signup" ? "new-password" : "current-password") + '" minlength="6" required></label>' +
      '<button type="submit" class="btn btn-primary auth-submit" id="auth-submit">' + (authMode === "signup" ? "Criar conta grátis" : "Entrar") + "</button>" +
      "</form>" +
      '<p style="text-align:center;font-size:11.5px;color:var(--ink-faint);margin:14px 0 0;">' + (authMode === "signup" ? "3 carrosséis grátis no teste, sem cartão." : "Ainda não tem conta? Use a aba \"Criar conta\".") + "</p>" +
      "</div></div>";

    var back = qs("#auth-back", view); if (back) back.onclick = showLanding;
    qsa("[data-authmode]", view).forEach(function (b) {
      b.addEventListener("click", function () { authMode = b.dataset.authmode; renderAuthView(); });
    });
    qs("#auth-form", view).addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = document.getElementById("auth-submit");
      var email = qs("#auth-email", view).value.trim();
      var pass = qs("#auth-pass", view).value;
      var nome = authMode === "signup" ? qs("#auth-nome", view).value.trim() : null;
      var tel = null;
      if (authMode === "signup") {
        tel = qs("#auth-tel", view).value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
        if (!/^[1-9]{2}9?\d{8}$/.test(tel)) { renderAuthView("Informe um celular válido com DDD, ex.: (85) 99999-9999."); return; }
      }
      btn.disabled = true;
      var originalTxt = btn.textContent;
      btn.innerHTML = '<div class="spin"></div> ' + (authMode === "signup" ? "Criando conta…" : "Entrando…");
      try {
        if (authMode === "signup") {
          var data = await Auth.signUp(email, pass, nome || email.split("@")[0], tel);
          if (!data.access_token) {
            renderAuthView(null, "Conta criada! Verifique seu e-mail (" + email + ") para confirmar o cadastro e depois faça login.");
            authMode = "login";
            return;
          }
        } else {
          await Auth.signIn(email, pass);
        }
        await bootApp();
      } catch (err) {
        renderAuthView(err.message || "Não foi possível continuar. Tente de novo.");
      } finally {
        btn.disabled = false;
        btn.textContent = originalTxt;
      }
    });
  }

  /* ============================================================
     NAVEGAÇÃO
  ============================================================ */
  var TITLES = {
    painel: ["Painel", "Seus carrosséis, do rascunho à publicação."],
    imoveis: ["Meus imóveis", "Os imóveis disponíveis para virar carrossel."],
    novo: ["Criar carrossel", "Escolha um assunto e a IA monta o carrossel pra você em segundos."],
    instagram: ["Instagram", "Conexão e fila de publicação."],
    plano: ["Plano", "Seu teste grátis e sua assinatura da Vitrine."],
    admin: ["Admin", "Contas cadastradas na plataforma (visível só pra você)."],
    equipe: ["Equipe", "Os corretores da sua imobiliária na Vitrine."]
  };
  // quem vê o menu Admin (o servidor também confere — sem isso ele devolve 403)
  var ADMIN_IDS = ["f13c2703-8848-485a-ae60-97e139a2b0a6"];
  function ehAdmin() { return !!(state.profile && ADMIN_IDS.indexOf(state.profile.id) >= 0); }

  function showScreen(name) {
    qsa(".screen").forEach(function (s) { s.hidden = true; });
    document.getElementById("screen-" + name).hidden = false;
    qsa(".navitem").forEach(function (b) { b.classList.toggle("active", b.dataset.screen === name); });
    document.getElementById("topbar-title").textContent = TITLES[name][0];
    document.getElementById("topbar-sub").textContent = TITLES[name][1];
    if (name === "painel") renderPainel();
    if (name === "imoveis") renderImoveis();
    if (name === "instagram") renderInstagram();
    if (name === "plano") renderPlano();
    if (name === "admin") renderAdmin();
    if (name === "equipe") renderEquipe();
    if (name === "novo" && wizard.step === 1) renderWizard();
    if (window.Vitrine && window.Vitrine.aoMostrar) { try { window.Vitrine.aoMostrar(name); } catch (e) { console.error(e); } }
  }

  /* ---------------- APROVAÇÃO DO GESTOR (equipe) ---------------- */
  function rpc(nome, args) { return DB.rest("rpc/" + nome, { method: "POST", body: JSON.stringify(args || {}) }); }
  async function renderAprovConfig() {
    var el = document.getElementById("eq-aprov-cfg"); if (!el) return;
    var cfg = {};
    try { cfg = (await rpc("equipe_config")) || {}; } catch (e) { return; }
    el.innerHTML = '<label class="eq-card" style="display:flex;gap:10px;align-items:center;cursor:pointer;margin-bottom:12px;">' +
      '<input type="checkbox" id="eq-exigir"' + (cfg.exigir_aprovacao ? " checked" : "") + '> ' +
      '<span><b>Exigir minha aprovação antes de agendar</b><br><span style="font-size:12.5px;color:var(--ink-muted);">Os posts dos corretores só vão pro Instagram depois que você aprovar.</span></span></label>';
    document.getElementById("eq-exigir").onchange = async function () {
      var on = this.checked, box = this;
      try { await rpc("equipe_definir_aprovacao", { p_exigir: on }); toast(on ? "Agora os posts da equipe esperam sua aprovação." : "Aprovação desligada."); }
      catch (e) { box.checked = !on; toast(e.message); }
    };
  }
  async function renderAprovLista(el) {
    if (!el) return;
    var lista = [];
    try { lista = (await rpc("equipe_pendentes")) || []; } catch (e) { el.innerHTML = ""; return; }
    if (!lista.length) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="eq-card aprov-card" style="margin-bottom:14px;"><h3 style="font-size:16px;margin:0 0 10px;">⏳ Aguardando sua aprovação <span class="adm-pill trial">' + lista.length + '</span></h3>' +
      lista.map(function (a) {
        return '<div class="aprov-item" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--border);">' +
          '<div style="min-width:0;"><b>' + escapeHtml((a.titulo || "Carrossel").replace(/\*/g, "")) + '</b><div style="font-size:12.5px;color:var(--ink-muted);">' + escapeHtml(a.corretor_nome || "Corretor") +
          (a.data_agendada ? " · para " + escapeHtml(fmtDateTime(a.data_agendada)) : "") + '</div></div>' +
          '<div style="display:flex;gap:8px;"><button class="btn btn-primary btn-sm" data-aprovar="' + a.id + '">Aprovar</button>' +
          '<button class="btn btn-ghost btn-sm btn-danger" data-recusar="' + a.id + '">Recusar</button></div></div>';
      }).join("") + '</div>';
    qsa("[data-aprovar]", el).forEach(function (b) {
      b.onclick = async function () {
        b.disabled = true;
        try { await rpc("equipe_aprovar", { p_carrossel: b.dataset.aprovar, p_aprovar: true }); toast("Aprovado. Vai ser publicado no horário agendado."); renderAprovPainel(); renderAprovLista(document.getElementById("eq-aprov-lista")); }
        catch (e) { toast(e.message); b.disabled = false; }
      };
    });
    qsa("[data-recusar]", el).forEach(function (b) {
      b.onclick = async function () {
        var motivo = prompt("Motivo da recusa (opcional):", "");
        if (motivo === null) return;
        b.disabled = true;
        try { await rpc("equipe_aprovar", { p_carrossel: b.dataset.recusar, p_aprovar: false, p_motivo: motivo || null }); toast("Recusado. O carrossel voltou para rascunho do corretor."); renderAprovPainel(); renderAprovLista(document.getElementById("eq-aprov-lista")); }
        catch (e) { toast(e.message); b.disabled = false; }
      };
    });
  }
  function renderAprovPainel() {
    var el = document.getElementById("aprov-painel"); if (!el) return;
    if (!(equipeInfo && equipeInfo.papel === "dono")) { el.innerHTML = ""; return; }
    renderAprovLista(el);
  }

  /* ---------------- PRÓXIMAS DATAS (painel) ---------------- */
  function renderDatasCard() {
    var el = document.getElementById("datas-card"); if (!el) return;
    var V = window.VitrineDatas;
    var prox = V ? V.proximas(new Date(), 30, 3) : [];
    if (!prox.length) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="eq-card datas-card"><h3 style="font-size:16px;margin:0 0 4px;">📅 Próximas datas</h3>' +
      '<p style="margin:0 0 6px;font-size:12.5px;color:var(--ink-muted);">Poste com antecedência: datas viram assunto e engajamento.</p>' +
      prox.map(function (x, i) {
        var quando = x.emAndamento ? "acontecendo agora" : x.faltam === 0 ? "hoje" : x.faltam === 1 ? "amanhã" : "em " + x.faltam + " dias";
        var dt = x.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        return '<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--border);">' +
          '<div style="min-width:0;flex:1 1 220px;"><b>' + escapeHtml(x.nome) + '</b> <span style="font-size:12.5px;color:var(--ink-muted);">' + dt + ' · ' + quando + '</span>' +
          '<div style="font-size:12.5px;color:var(--ink-muted);">' + escapeHtml(x.tema) + '</div></div>' +
          '<button class="btn btn-primary btn-sm" data-data-post="' + i + '">Criar post</button></div>';
      }).join("") + '</div>';
    qsa("[data-data-post]", el).forEach(function (b) {
      b.onclick = function () {
        var x = prox[+b.dataset.dataPost];
        resetWizard(); showScreen("novo");
        wizard.fotosData = x.foto || null;   // fotos ligadas à data (ex.: Dia das Mães → mãe brincando com o filho)
        var t = document.getElementById("tema-livre-txt");
        if (t) { t.value = x.tema; t.focus(); }
      };
    });
  }

  /* ---------------- EQUIPE (planos de imobiliária) ---------------- */
  var equipeInfo = null;
  async function carregarEquipe() {
    try { equipeInfo = await callFunction("equipe", { acao: "minha" }); }
    catch (e) { equipeInfo = null; }
    document.getElementById("nav-equipe").hidden = !(equipeInfo && equipeInfo.papel);
    renderAprovPainel();
    return equipeInfo;
  }
  async function renderEquipe() {
    var box = document.getElementById("equipe-body");
    box.innerHTML = '<div class="eq-card" style="color:var(--ink-muted);">Carregando…</div>';
    await carregarEquipe();
    var d = equipeInfo;
    if (!d || !d.papel) {
      box.innerHTML = '<div class="eq-card"><h3 style="font-size:16px;margin:0 0 6px;">Você ainda não tem equipe</h3><p style="margin:0 0 12px;color:var(--ink-muted);font-size:13px;">Assine um plano para imobiliárias e convide seus corretores.</p><button class="btn btn-primary btn-sm" id="eq-ver-planos">Ver planos para imobiliárias</button></div>';
      document.getElementById("eq-ver-planos").onclick = function () { showScreen("plano"); };
      return;
    }
    if (d.papel === "membro") {
      box.innerHTML = '<div class="eq-card"><h3 style="font-size:17px;margin:0 0 4px;">' + escapeHtml(d.equipe.nome || "Sua imobiliária") + '</h3>' +
        '<p style="margin:0 0 14px;color:var(--ink-muted);font-size:13px;">Você usa a Vitrine pelo plano da imobiliária' + (d.equipe.dono ? " de " + escapeHtml(d.equipe.dono) : "") + '.' + (d.equipe.ativa ? "" : " A assinatura da imobiliária está pausada no momento.") + '</p>' +
        '<button class="btn btn-ghost btn-sm btn-danger" id="eq-sair">Sair da equipe</button></div>';
      document.getElementById("eq-sair").onclick = async function () {
        if (!confirm("Sair da equipe? Você volta para o teste grátis.")) return;
        try { await callFunction("equipe", { acao: "sair" }); toast("Você saiu da equipe."); location.reload(); } catch (e) { toast(e.message); }
      };
      return;
    }
    var membros = d.membros || [];
    var usadas = 1 + membros.length;
    box.innerHTML =
      '<div class="eq-card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;">' +
      '<div><div style="font-size:12px;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.04em;">' + escapeHtml(d.equipe.plano || "Plano de imobiliária") + (d.equipe.ativa ? "" : " · pausado") + '</div>' +
      '<h3 style="font-size:18px;margin:4px 0 0;"><span id="eq-nome">' + escapeHtml(d.equipe.nome || "Minha imobiliária") + '</span> <button class="btn btn-ghost btn-xs" id="eq-renomear">Renomear</button></h3></div>' +
      '<div style="text-align:right;"><div class="eq-vagas">' + usadas + '/' + d.equipe.max + '</div><div style="font-size:12px;color:var(--ink-muted);">vagas usadas (com você)</div></div></div>' +
      (d.equipe.ativa ? '<div class="eq-convite"><input type="email" id="eq-email" placeholder="E-mail do corretor (o mesmo que ele vai usar pra entrar)"><button class="btn btn-primary btn-sm" id="eq-convidar">Convidar</button></div><div id="eq-link-box"></div>'
        : '<p style="margin:12px 0 0;color:#ff9aab;font-size:13px;">A assinatura da imobiliária não está ativa. Assine de novo em Plano para os corretores voltarem a ter acesso.</p>') + '</div>' +
      '<div id="eq-aprov-cfg"></div><div id="eq-aprov-lista"></div>' +
      '<div class="admin-tabela-wrap"><table class="admin-tabela" style="min-width:640px;"><thead><tr><th>Corretor</th><th>Situação</th><th>Carrosséis</th><th></th></tr></thead><tbody>' +
      (membros.length ? membros.map(function (m) {
        return '<tr><td><b>' + escapeHtml(m.nome || m.email) + '</b>' + (m.nome ? '<div class="sub">' + escapeHtml(m.email) + '</div>' : "") + '</td>' +
          '<td>' + (m.status === "ativo" ? '<span class="adm-pill ativa">Ativo</span>' : '<span class="adm-pill trial">Convite enviado</span>' + (m.link ? '<div style="margin-top:6px;"><button class="btn btn-ghost btn-xs" data-copiar="' + escapeHtml(m.link) + '">Copiar link</button></div>' : "")) + '</td>' +
          '<td>' + (m.status === "ativo" ? m.carrosseis : "—") + '</td>' +
          '<td style="text-align:right;"><button class="btn btn-ghost btn-xs btn-danger" data-remover="' + escapeHtml(m.id) + '">' + (m.status === "ativo" ? "Remover" : "Cancelar convite") + '</button></td></tr>';
      }).join("") : '<tr><td colspan="4" style="padding:20px;color:var(--ink-muted);">Nenhum corretor convidado ainda. Digite o e-mail acima e mande o link pra ele.</td></tr>') +
      '</tbody></table></div>';
    renderAprovConfig();
    renderAprovLista(document.getElementById("eq-aprov-lista"));
    var conv = document.getElementById("eq-convidar");
    if (conv) conv.onclick = async function () {
      var email = document.getElementById("eq-email").value.trim();
      if (!email) { toast("Digite o e-mail do corretor."); return; }
      conv.disabled = true;
      try {
        var r = await callFunction("equipe", { acao: "convidar", email: email });
        await renderEquipe();
        if (r.link) mostrarLinkConvite(r.link, email);
        else toast("Esse corretor já está na equipe.");
      } catch (e) { toast(e.message); conv.disabled = false; }
    };
    document.getElementById("eq-renomear").onclick = async function () {
      var nome = prompt("Nome da imobiliária:", d.equipe.nome || "");
      if (nome == null) return;
      try { await callFunction("equipe", { acao: "renomear", nome: nome }); renderEquipe(); } catch (e) { toast(e.message); }
    };
    qsa("[data-copiar]", box).forEach(function (b) { b.onclick = function () { copiarTexto(b.dataset.copiar); }; });
    qsa("[data-remover]", box).forEach(function (b) {
      b.onclick = async function () {
        if (!confirm("Tirar esse corretor da equipe? Ele volta para o teste grátis.")) return;
        try { await callFunction("equipe", { acao: "remover", membro_id: b.dataset.remover }); toast("Feito."); renderEquipe(); } catch (e) { toast(e.message); }
      };
    });
  }
  function copiarTexto(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast("Link copiado."); }, function () { prompt("Copie o link:", t); });
  }
  function mostrarLinkConvite(link, email) {
    var box = document.getElementById("eq-link-box"); if (!box) return;
    var msg = "Oi! Te convidei pra usar a Vitrine pela nossa imobiliária. Crie sua conta (ou entre) com o e-mail " + email + " por este link: " + link;
    box.innerHTML = '<div class="eq-link"><span style="flex:1;">Convite criado para <b>' + escapeHtml(email) + '</b>. Mande este link pra ele:<br><span class="mono">' + escapeHtml(link) + '</span></span>' +
      '<button class="btn btn-ghost btn-xs" id="eq-copiar-novo">Copiar</button><a class="btn btn-primary btn-xs" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + encodeURIComponent(msg) + '">WhatsApp</a></div>';
    document.getElementById("eq-copiar-novo").onclick = function () { copiarTexto(link); };
  }
  // convite: ?convite=TOKEN — guarda o token até a pessoa entrar/criar conta e então aceita
  var CONVITE_KEY = "vitrine-convite";
  function guardarConviteDaUrl() {
    var p = new URLSearchParams(location.search), t = p.get("convite");
    if (t && /^[a-f0-9]{64}$/.test(t)) { try { sessionStorage.setItem(CONVITE_KEY, t); } catch (e) { } history.replaceState(null, "", location.pathname); return true; }
    return false;
  }
  function conviteGuardado() { try { return sessionStorage.getItem(CONVITE_KEY); } catch (e) { return null; } }
  async function aceitarConvitePendente() {
    var t = conviteGuardado(); if (!t) return;
    try { sessionStorage.removeItem(CONVITE_KEY); } catch (e) { }
    try {
      var r = await callFunction("equipe", { acao: "aceitar", token: t });
      if (!r.ja) { toast("Pronto! Você entrou na equipe" + (r.equipe ? " " + r.equipe : "") + "."); setTimeout(function () { location.reload(); }, 1500); }
    } catch (e) { toast(e.message); }
  }

  /* ---------------- ADMIN ---------------- */
  var adminDados = null;
  // faixa vermelha só pro dono quando o servidor detecta problema (ex.: IA sem crédito na Anthropic)
  var DICA_ALERTA = {
    ia_sem_credito: "Recarregue ou revise o provedor de IA ativo (Anthropic, OpenAI ou Gemini) antes de gerar novos carrosseis.",
    ia_config: "Confira os secrets ANTHROPIC_API_KEY, OPENAI_API_KEY ou GEMINI_API_KEY em Supabase → Edge Functions → Secrets."
  };
  function mostrarAlertasSistema(lista) {
    var box = document.getElementById("alertas-sistema");
    if (!box) {
      box = document.createElement("div"); box.id = "alertas-sistema"; box.className = "alertas-sistema";
      var main = document.querySelector("main.content"); main.insertBefore(box, main.firstChild);
    }
    if (!lista || !lista.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = lista.map(function (a) {
      return '<div class="alerta-item"><b>⚠️ ' + escapeHtml(a.mensagem) + '</b>' +
        '<div class="sub">' + escapeHtml(DICA_ALERTA[a.tipo] || "") + ' Desde ' + fmtDateTime(a.created_at) + ' · ' + a.ocorrencias + ' ocorrência' + (a.ocorrencias === 1 ? "" : "s") + '.</div></div>';
    }).join("") + '<button type="button" class="btn btn-ghost btn-xs" id="alertas-resolver">Já resolvi — esconder</button>';
    document.getElementById("alertas-resolver").onclick = function () {
      callFunction("admin-painel", { acao: "resolver_alertas" }).then(function () { mostrarAlertasSistema([]); toast("Alerta fechado. Se o problema voltar, ele aparece de novo."); })
        .catch(function (e) { toast(e.message); });
    };
  }
  function verificarAlertasSistema() {
    callFunction("admin-painel", { acao: "alertas" }).then(function (r) { mostrarAlertasSistema(r.alertas); }).catch(function () {});
  }
  async function renderAdmin(forcar) {
    var tab = document.getElementById("admin-tabela");
    if (!adminDados || forcar) {
      tab.innerHTML = '<tr><td style="padding:24px;color:var(--ink-muted);">Carregando contas…</td></tr>';
      try { adminDados = await callFunction("admin-painel", {}); }
      catch (e) { tab.innerHTML = '<tr><td style="padding:24px;color:#ff9aab;">' + escapeHtml(e.message) + '</td></tr>'; return; }
    }
    var r = adminDados.resumo;
    mostrarAlertasSistema(adminDados.alertas);
    document.getElementById("admin-resumo").innerHTML = [
      ["Contas", r.contas, r.novas_7_dias + " novas nos últimos 7 dias"],
      ["Assinantes ativos", r.assinantes_ativos, "pagando"],
      ["Em teste grátis", r.em_teste, "podem virar assinantes"],
      ["Receita mensal", "R$ " + Number(r.receita_mensal_estimada).toFixed(2).replace(".", ","), r.carrosseis + " carrosséis criados"]
    ].map(function (s) { return '<div class="stat" style="cursor:default;"><div class="n">' + escapeHtml(s[1]) + '</div><div class="l">' + escapeHtml(s[0]) + '</div><div class="sub" style="font-size:11.5px;color:var(--ink-faint);margin-top:4px;">' + escapeHtml(s[2]) + '</div></div>'; }).join("");
    desenharTabelaAdmin();
    var busca = document.getElementById("admin-busca");
    busca.oninput = desenharTabelaAdmin;
    document.getElementById("admin-atualizar").onclick = function () { renderAdmin(true); };
    document.getElementById("admin-csv").onclick = baixarCsvAdmin;
  }
  function contasFiltradas() {
    var q = (document.getElementById("admin-busca").value || "").toLowerCase().trim();
    return (adminDados ? adminDados.contas : []).filter(function (c) {
      return !q || [c.nome, c.email, c.cidade, c.telefone, c.instagram].join(" ").toLowerCase().indexOf(q) >= 0;
    });
  }
  function desenharTabelaAdmin() {
    var linhas = contasFiltradas();
    var pill = function (c) {
      var cls = c.status === "ativa" ? "ativa" : c.status === "trial" ? "trial" : "outro";
      var txt = c.status === "ativa" ? (c.plano || "Assinante") + (c.periodo ? " · " + c.periodo : "") : c.status === "trial" ? "Teste grátis" : c.status;
      return '<span class="adm-pill ' + cls + '">' + escapeHtml(txt) + '</span>';
    };
    document.getElementById("admin-tabela").innerHTML =
      '<thead><tr><th>Corretor</th><th>Contato</th><th>Plano</th><th>Uso</th><th>Instagram</th><th>Cadastro</th><th>Último acesso</th></tr></thead><tbody>' +
      (linhas.length ? linhas.map(function (c) {
        return '<tr><td><b>' + escapeHtml(c.nome || "—") + '</b><div class="sub">' + escapeHtml(c.cidade || "") + (c.creci ? " · CRECI " + escapeHtml(c.creci) : "") + '</div></td>' +
          '<td>' + escapeHtml(c.email) + (c.email_confirmado ? "" : ' <span class="sub">(e-mail não confirmado)</span>') + '<div class="sub">' + escapeHtml(c.telefone || "") + '</div></td>' +
          '<td>' + pill(c) + (c.fim && c.status === "ativa" ? '<div class="sub">renova ' + fmtDate(c.fim) + '</div>' : "") + '</td>' +
          '<td>' + c.carrosseis + ' carrossel' + (c.carrosseis === 1 ? "" : "éis") + '<div class="sub">' + c.publicados + ' publicado' + (c.publicados === 1 ? "" : "s") + (c.status === "trial" ? " · teste " + c.trial_usado + "/" + c.trial_limite : "") + '</div></td>' +
          '<td>' + (c.instagram ? escapeHtml(c.instagram) : '<span class="sub">não conectado</span>') + '</td>' +
          '<td>' + fmtDate(c.cadastrado_em) + '</td>' +
          '<td>' + (c.ultimo_login ? fmtDateTime(c.ultimo_login) : '<span class="sub">nunca</span>') + '</td></tr>';
      }).join("") : '<tr><td colspan="7" style="padding:24px;color:var(--ink-muted);">Nenhuma conta encontrada.</td></tr>') + '</tbody>';
  }
  function baixarCsvAdmin() {
    var cols = ["nome", "email", "telefone", "cidade", "creci", "status", "plano", "periodo", "carrosseis", "publicados", "instagram", "cadastrado_em", "ultimo_login"];
    var esc = function (v) { v = v == null ? "" : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var csv = [cols.join(";")].concat(contasFiltradas().map(function (c) { return cols.map(function (k) { return esc(c[k]); }).join(";"); })).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "vitrine-contas-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  // teste grátis: posts levam a marca da Vitrine e o limite de publicações é o mesmo dos carrosséis grátis
  var LINK_VITRINE = "vitrinecorretores.github.io";
  function comLinkVitrine() { return emTeste() || ehAdmin(); }
  function emTeste() { return !state.assinatura || state.assinatura.status === "trial"; }
  function publicadosNoInstagram() { return state.carrosseis.filter(function (c) { return c.status === "publicado" && c.instagram_media_id; }).length; }
  function limitePublicacoesTeste() { return (state.profile && state.profile.trial_limite) || 3; }
  function testeSemPublicacoes() { return emTeste() && publicadosNoInstagram() >= limitePublicacoesTeste(); }
  function avisoFimDoTeste() {
    document.getElementById("modal-body").innerHTML =
      '<div class="modal-head"><h3 style="font-size:18px;">Seu teste grátis terminou</h3><button class="modal-close" id="modal-close">' + ICONS.close + '</button></div>' +
      '<p style="color:var(--ink-muted);font-size:14px;line-height:1.6;margin:6px 0 16px;">Você já publicou os ' + limitePublicacoesTeste() + ' carrosséis do teste grátis no Instagram. Pra continuar publicando — e sem a marca da Vitrine nas imagens — assine um plano.</p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-ghost btn-sm" id="fim-teste-fechar">Agora não</button><button class="btn btn-primary btn-sm" id="fim-teste-planos">Ver planos</button></div>';
    document.getElementById("overlay").hidden = false;
    document.getElementById("modal-close").onclick = closeModal;
    document.getElementById("fim-teste-fechar").onclick = closeModal;
    document.getElementById("fim-teste-planos").onclick = function () { closeModal(); showScreen("plano"); };
  }

  function trialBlocked() {
    return state.assinatura && state.assinatura.status === "trial" && state.profile && state.profile.trial_usado >= state.profile.trial_limite;
  }
  function tryStartWizard() {
    if (trialBlocked()) {
      showScreen("plano");
      toast("Você usou seus " + state.profile.trial_limite + " carrosséis grátis. Assine pra continuar criando.");
      return false;
    }
    resetWizard();
    return true;
  }

  /* ============================================================
     PAINEL
  ============================================================ */
  var painelFilter = null;

  /* ---------- vários Instagram por corretor ---------- */
  function contasAtivas() { return state.igContas || []; }
  // a conta "selecionada" (onde o post vai sair) vem primeiro; sem escolha, a mais antiga
  function ordenarContas(l) {
    return (l || []).slice().sort(function (a, b) {
      return (b.principal ? 1 : 0) - (a.principal ? 1 : 0) || String(a.connected_at || "").localeCompare(String(b.connected_at || ""));
    });
  }
  function contaSelecionada() { return contasAtivas()[0] || null; }
  // selo no topo: sempre mostra em qual Instagram os posts vão sair
  function atualizarPillIg() {
    var el = document.getElementById("ig-pill"); if (!el) return;
    var ct = contaSelecionada();
    el.hidden = !state.profile;
    el.classList.toggle("off", !ct);
    el.innerHTML = ICONS.ig + '<span>' + (ct ? 'Postando em <b>@' + escapeHtml(ct.username) + '</b>' : 'Instagram não conectado') + '</span>';
    el.title = ct ? "Os posts saem nesta conta. Clique para trocar." : "Clique para conectar seu Instagram.";
    el.onclick = function () { showScreen("instagram"); };
  }
  // quantas contas o plano permite: Starter 1, Pro 3, equipe 3, teste grátis 1 (o servidor confere de novo)
  function limiteContasIg() {
    if (emTeste()) return 1;
    var pl = findPlano(state.assinatura.plano_id);
    if (!pl) return 1;
    if (pl.tipo === "equipe" || pl.slug === "pro") return 3;
    return 1;
  }
  // @usuário(s) onde o carrossel vai sair (lista vazia = conta principal)
  function destinosDoCarrossel(c) {
    var ativas = contasAtivas(), ids = c.instagram_contas_ids || [];
    var sel = ids.length ? ativas.filter(function (x) { return ids.indexOf(x.id) >= 0; }) : ativas.slice(0, 1);
    return sel.map(function (x) { return "@" + x.username; });
  }
  // em qual Instagram ESTE post vai sair: uma conta por post, guardada no próprio agendamento.
  // Vem marcada a conta já gravada no post; num post novo, a conta selecionada (padrão) da aba Instagram.
  function escolhaContasHtml(selecionados) {
    var ativas = contasAtivas();
    if (!ativas.length) return "";
    var marcada = (selecionados && selecionados.length && ativas.some(function (x) { return x.id === selecionados[0]; })) ? selecionados[0] : ativas[0].id;
    if (ativas.length < 2) return '<div class="ag-contas ag-contas-uma">' + ICONS.ig + '<span>Vai postar em <b>@' + escapeHtml(ativas[0].username) + '</b></span></div>';
    return '<div class="ag-contas"><div class="ag-contas-t">Postar em qual Instagram?</div>' +
      ativas.map(function (x) {
        return '<label class="ag-conta"><input type="radio" name="conta-ig" data-conta-ig="' + x.id + '"' + (x.id === marcada ? " checked" : "") + '> @' + escapeHtml(x.username) + '</label>';
      }).join("") + '</div>';
  }
  function lerContasMarcadas(root) {
    var ativas = contasAtivas();
    if (!ativas.length) return [];
    var r = root && root.querySelector("[data-conta-ig]:checked");
    return [r ? r.getAttribute("data-conta-ig") : ativas[0].id];
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-ir-instagram]");
    if (!b) return;
    ev.preventDefault();
    if (typeof closeModal === "function") closeModal();
    showScreen("instagram");
  });
  // mais novos primeiro em todas as listas (publicados pela data de publicação)
  function dataRecente(c) { return (c.status === "publicado" && c.data_publicada) || c.created_at || ""; }
  function ordemRecente(a, b) { return String(dataRecente(b)).localeCompare(String(dataRecente(a))); }

  function renderPainel() {
    renderDatasCard();
    renderAprovPainel();
    var total = state.carrosseis.length;
    var rasc = state.carrosseis.filter(function (c) { return c.status === "rascunho"; }).length;
    var ag = state.carrosseis.filter(function (c) { return c.status === "agendado"; }).length;
    var pub = state.carrosseis.filter(function (c) { return c.status === "publicado"; }).length;
    document.getElementById("stat-row").innerHTML = [
      ["Carrosséis criados", total, "all"], ["Rascunhos", rasc, "rascunho"], ["Agendados", ag, "agendado"], ["Publicados", pub, "publicado"]
    ].map(function (s) {
      var isActive = s[2] === "all" ? !painelFilter : painelFilter === s[2];
      return '<button type="button" class="stat' + (isActive ? " active" : "") + '" data-filter="' + s[2] + '">' +
        '<div class="n mono">' + s[1] + '</div><div class="l">' + s[0] + '</div></button>';
    }).join("");
    qsa("#stat-row [data-filter]").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = b.dataset.filter;
        painelFilter = (f === "all" || painelFilter === f) ? null : f;
        renderPainel();
      });
    });

    var sectionHint = document.getElementById("kanban-hint");
    if (painelFilter) {
      var fLabel = painelFilter === "rascunho" ? "Rascunhos" : painelFilter === "agendado" ? "Agendados" : "Publicados";
      sectionHint.innerHTML = 'mostrando só: <strong>' + fLabel + '</strong> · <a href="#" id="clear-filter" style="color:var(--accent2);text-decoration:underline;">ver todos</a>';
      document.getElementById("clear-filter").addEventListener("click", function (e) { e.preventDefault(); painelFilter = null; renderPainel(); });
    } else {
      sectionHint.textContent = "clique num status acima pra filtrar";
    }

    var temAprov = state.carrosseis.some(function (c) { return c.status === "aguardando_aprovacao"; });
    var allCols = [
      { status: "rascunho", label: "Rascunho" }].concat(temAprov ? [{ status: "aguardando_aprovacao", label: "Aguardando aprovação" }] : []).concat([
      { status: "agendado", label: "Agendado" },
      { status: "publicado", label: "Publicado" }
    ]);
    var cols = painelFilter ? allCols.filter(function (c) { return c.status === painelFilter; }) : allCols;
    document.getElementById("kanban").classList.toggle("single", cols.length === 1);
    document.getElementById("kanban").innerHTML = cols.map(function (col) {
      var items = state.carrosseis.filter(function (c) { return c.status === col.status; }).sort(ordemRecente);
      var body = items.length ? items.map(function (c) {
        var meta = getSubjectMeta(c);
        var tpl = findTemplateById(c.template_id);
        var slide0 = (c.slides && c.slides[0]) || { tag: "", titulo: meta.titulo, corpo: "" };
        var when = c.status === "aguardando_aprovacao" ? '<span class="selo-aprov">⏳ Aguardando aprovação do gestor</span>' + (c.data_agendada ? " · para " + fmtDateTime(c.data_agendada) : "")
          : c.status === "agendado" ? (c.publicar_manual ? "Postar pelo app " : "Agendado ") + fmtDateTime(c.data_agendada)
          : c.status === "publicado" ? "Publicado " + fmtDate(c.data_publicada)
          : "Criado " + fmtDate(c.created_at);
        // agendados e publicados: card compacto (texto e botões na mesma linha), como os rascunhos enxutos
        var compacto = c.status !== "rascunho";
        return '<div class="ccard' + (compacto ? ' compacto' : '') + '">' +
          '<div class="thumb">' + (ehReels(c) ? thumbReels(c) : slideTile(slide0, tpl && tpl.slug, true, 1, 1, null, c.fonte)) + '</div>' +
          '<div class="body">' + (compacto ? '<div class="txt">' : '') +
          '<h4>' + (ehReels(c) ? '<span class="tag-reels">▶ Reels</span> ' : '') + escapeHtml(meta.titulo) + '</h4>' +
          (compacto ? '' : '<div class="addr">' + escapeHtml(meta.sub) + '</div>') +
          '<div class="meta">' + when + '</div>' +
          (c.status === "agendado" && destinosDoCarrossel(c).length ? '<div class="meta ig-dest">→ ' + escapeHtml(destinosDoCarrossel(c).join(", ")) + '</div>' : "") +
          (c.erro_publicacao ? '<div class="meta erro-pub" title="' + escapeHtml(c.erro_publicacao) + '">⚠ ' + escapeHtml(c.erro_publicacao) + '</div>' : '') +
          (compacto ? '</div>' : '') +
          '<div class="actions">' +
          (c.status === "rascunho" ? '<button class="btn btn-primary btn-sm btn-agendar" data-agendar="' + c.id + '" title="Agendar publicação">📅 Agendar</button>' : "") +
          (c.status === "agendado" ? '<button class="btn btn-ghost btn-sm" data-agendar="' + c.id + '" title="Mudar data e horário">📅</button>' : "") +
          '<button class="btn btn-ghost btn-sm" data-view="' + c.id + '">' + ICONS.eye + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-del="' + c.id + '">' + ICONS.trash + '</button>' +
          '</div>' +
          '</div></div>';
      }).join("") : '<div class="empty-col">Nada por aqui ainda.</div>';
      return '<div><div class="kcol-head">' + col.label + ' <span class="n">' + items.length + '</span></div><div class="kcol">' + body + '</div></div>';
    }).join("");

    qsa("[data-view]").forEach(function (b) { b.addEventListener("click", function () { openCarouselModal(b.dataset.view); }); });
    qsa("[data-agendar]").forEach(function (b) { b.addEventListener("click", function () { abrirAgendarRascunho(b.dataset.agendar); }); });
    qsa("[data-del]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var id = b.dataset.del;
        try {
          await DB.del("slides", "carrossel_id=eq." + id);
          await DB.del("carrosseis", "id=eq." + id);
          state.carrosseis = state.carrosseis.filter(function (c) { return c.id !== id; });
          renderPainel(); toast("Carrossel excluído.");
        } catch (err) { toast("Erro ao excluir: " + err.message); }
      });
    });
  }

  function openCarouselModal(id) {
    var c = state.carrosseis.find(function (x) { return x.id === id; });
    if (!c) return;
    if (ehReels(c)) { openReelsModal(c); return; }
    var meta = getSubjectMeta(c);
    var tpl = findTemplateById(c.template_id);
    var pillCls = c.status === "publicado" ? "pill-publicado" : c.status === "agendado" ? "pill-agendado" : "pill-draft";
    var extra = c.status === "publicado"
      ? (igLink(c.instagram_permalink) ? '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(igLink(c.instagram_permalink)) + '" target="_blank" rel="noopener noreferrer">' + ICONS.ig + ' Ver no Instagram</a>' : "")
      : '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">' +
        '<button class="btn btn-ghost btn-sm" id="preview-ig">' + ICONS.eye + ' Ver como fica</button>' +
        '<button class="btn btn-ghost btn-sm" id="agendar-modal">📅 ' + (c.status === "agendado" ? "Reagendar" : "Agendar") + '</button>' +
        (c.status === "agendado" ? '<button class="btn btn-ghost btn-sm" id="mark-published">' + ICONS.check + ' Marcar como publicado</button>' : "") +
        '<button class="btn btn-primary btn-sm" id="publish-ig">📲 Postar no Instagram</button></div>';
    document.getElementById("modal-body").innerHTML =
      '<div class="modal-head"><div><h3 style="font-size:19px;">' + escapeHtml(meta.titulo) + '</h3>' +
      '<span class="pill ' + pillCls + '" style="margin-top:6px;">' + escapeHtml(c.status) + '</span></div>' +
      '<button class="modal-close" id="modal-close">' + ICONS.close + '</button></div>' +
      '<div class="carousel-strip">' + slideStrip(c.slides, tpl && tpl.slug, false, meta.art, c.fonte, c.melhorar_fotos) + '</div>' +
      (c.status !== "publicado" ? '<div id="modal-fontes">' + fontPickerHtml(c.fonte) + '</div>' : "") +
      (c.status !== "publicado" ? '<div class="fotos-titulo">Fotos dos slides</div>' + melhorarToggleHtml(c.melhorar_fotos) + fotoControlsHtml(c.slides) : "") +
      (c.direcionamento ? '<div style="font-size:12px;color:var(--ink-muted);margin-bottom:8px;"><strong>Direcionamento usado:</strong> ' + escapeHtml(c.direcionamento) + '</div>' : "") +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">' +
      '<span style="font-size:12px;color:var(--ink-faint);">' + escapeHtml(meta.sub) + '</span>' + extra + '</div>';
    document.getElementById("overlay").hidden = false;
    document.getElementById("modal-close").addEventListener("click", closeModal);
    qsa("#modal-fontes [data-cor]").forEach(function (b) {
      b.onclick = async function () {
        c.fonte = comCor(c.fonte, b.dataset.cor);
        try { await DB.update("carrosseis", "id=eq." + c.id, { fonte: c.fonte }); } catch (e) { toast("Erro ao salvar a cor: " + e.message); }
        openCarouselModal(c.id); renderPainel();
      };
    });
    qsa("#modal-fontes [data-fonte]").forEach(function (b) {
      b.onclick = async function () {
        c.fonte = comCor(b.dataset.fonte, corDe(c.fonte));
        try { await DB.update("carrosseis", "id=eq." + c.id, { fonte: c.fonte }); } catch (e) { toast("Erro ao salvar a fonte: " + e.message); }
        openCarouselModal(c.id); renderPainel();
      };
    });
    if (c.status !== "publicado") wireFotoControls(document.getElementById("modal-body"), c.slides, contextoDoCarrossel(c), true, function () { openCarouselModal(c.id); });
    var mt = qs("#modal-body [data-melhorar]");
    if (mt) mt.onchange = async function () {
      c.melhorar_fotos = mt.checked;
      try {
        await DB.update("carrosseis", "id=eq." + c.id, { melhorar_fotos: c.melhorar_fotos });
        // agendado já tem imagens prontas no Storage: refaz com o novo ajuste
        if (c.status === "agendado" && !ehReels(c)) { toast("Refazendo as imagens agendadas…"); await prepararAgendado(c); }
      } catch (e) { toast("Erro ao salvar: " + e.message); }
      openCarouselModal(c.id);
    };
    // carrossel antigo sem foto: busca as fotos reais uma vez e redesenha
    if (!c._buscouFotos && c.slides.some(function (s) { return !isFotoReal(s.imagem_url); })) {
      c._buscouFotos = true;
      garantirFotosReais(c.slides, contextoDoCarrossel(c), true)
        .then(function () { if (!document.getElementById("overlay").hidden) openCarouselModal(c.id); renderPainel(); })
        .catch(function (e) { toast("Não consegui buscar as fotos: " + e.message); });
    }
    var pv = document.getElementById("preview-ig");
    if (pv) pv.addEventListener("click", async function () { await previewCarousel(c); openCarouselModal(c.id); });
    var pi = document.getElementById("publish-ig");
    if (pi) pi.addEventListener("click", function () { postarComMusica(c); });
    var am = document.getElementById("agendar-modal");
    if (am) am.addEventListener("click", function () { abrirAgendarRascunho(c.id); });
    var mp = document.getElementById("mark-published");
    if (mp) mp.addEventListener("click", async function () {
      try {
        var pubAt = new Date().toISOString();
        await DB.update("carrosseis", "id=eq." + c.id, { status: "publicado", data_publicada: pubAt });
        c.status = "publicado"; c.data_publicada = pubAt;
        closeModal(); renderPainel(); renderInstagram(); toast("Marcado como publicado.");
      } catch (err) { toast("Erro: " + err.message); }
    });
  }
  function closeModal() { document.getElementById("overlay").hidden = true; }

  // agendar (ou reagendar) um carrossel já salvo, direto do Painel
  function abrirAgendarRascunho(id) {
    var c = state.carrosseis.find(function (x) { return x.id === id; });
    if (!c) return;
    var meta = getSubjectMeta(c);
    var ini = c.status === "agendado" && c.data_agendada ? new Date(c.data_agendada) : null;
    var dIni = ini ? ymd(ini) : ymd(addDays(1));
    var tIni = ini ? pad2(ini.getHours()) + ":" + pad2(ini.getMinutes()) : "18:00";
    var igOn = state.igConta && state.igConta.status === "ativo";
    var fmtSel = ehReels(c) ? "reels" : "feed", manualSel = !!c.publicar_manual, musSel = null;
    document.getElementById("modal-body").innerHTML =
      '<div class="modal-head"><div><h3 style="font-size:19px;">📅 ' + (c.status === "agendado" ? "Reagendar" : "Agendar") + ' publicação</h3>' +
      '<div style="font-size:13px;color:var(--ink-muted);margin-top:4px;">' + escapeHtml(meta.titulo) + '</div></div>' +
      '<button class="modal-close" id="modal-close">' + ICONS.close + '</button></div>' +
      (ehReels(c)
        ? '<div class="ag-contas ag-contas-uma"><span class="tag-reels">▶ Reels</span><span>Vai sair como <b>Reels</b> (vídeo)</span></div>'
        : '<div class="ag-formato"><div class="ag-contas-t">Publicar como</div><div class="ag-fmt">' +
          '<button type="button" class="ag-fmt-b on" data-ag-fmt="feed"><b>Carrossel</b><span>no feed</span></button>' +
          '<button type="button" class="ag-fmt-b" data-ag-fmt="reels"><b>▶ Reels</b><span>vídeo 9:16 · 3 s por slide</span></button></div>' +
          '<p class="ag-fmt-dica" id="ag-fmt-dica" hidden>A Vitrine monta o vídeo agora, neste aparelho (leva uns segundos por slide). Mantenha esta tela aberta até terminar.</p></div>') +
      '<div id="ag-reels-op"' + (ehReels(c) ? "" : " hidden") + '>' + (ehReels(c) ? "" : musicaHtml()) + comoPublicarHtml(manualSel) + '</div>' +
      '<div class="agendar-rapido">' +
      '<label>Dia<input type="date" id="ag-data" value="' + dIni + '" min="' + ymd(new Date()) + '" max="' + ymd(addDays(90)) + '"></label>' +
      '<label>Horário<input type="time" id="ag-hora" value="' + tIni + '" step="300"></label></div>' +
      '<div class="ag-chips">' + HORARIOS_TOP.map(function (t) { return '<button type="button" class="cal-slot top" data-ag-hora="' + t + '">' + t + '</button>'; }).join("") +
      '<span class="ag-dica">horários de mais engajamento</span></div>' +
      '<div id="ag-contas">' + escolhaContasHtml(c.instagram_contas_ids) + '</div>' +
      (igOn ? '<p class="ag-info">Na hora marcada, a Vitrine publica sozinha no seu Instagram — mesmo com o app fechado.</p>'
            : '<p class="ag-info ag-warn">⚠ Seu Instagram ainda não está conectado. Conecte na aba Instagram até o horário, senão o post não sai sozinho.</p>') +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">' +
      '<button class="btn btn-ghost btn-sm" id="ag-cancelar">Cancelar</button>' +
      '<button class="btn btn-primary btn-sm" id="ag-confirmar">📅 Confirmar agendamento</button></div>';
    document.getElementById("overlay").hidden = false;
    document.getElementById("modal-close").onclick = closeModal;
    document.getElementById("ag-cancelar").onclick = closeModal;
    document.getElementById("modal-close").addEventListener("click", function () { var a = document.getElementById("ag-mus-ouvir"); if (a) a.pause(); });
    document.getElementById("ag-cancelar").addEventListener("click", function () { var a = document.getElementById("ag-mus-ouvir"); if (a) a.pause(); });
    qsa("[data-ag-hora]").forEach(function (b) { b.onclick = function () { document.getElementById("ag-hora").value = b.dataset.agHora; }; });
    qsa("[data-ag-fmt]").forEach(function (b) {
      b.onclick = function () {
        fmtSel = b.dataset.agFmt;
        qsa("[data-ag-fmt]").forEach(function (x) { x.classList.toggle("on", x === b); });
        var dica = document.getElementById("ag-fmt-dica"); if (dica) dica.hidden = fmtSel !== "reels";
        var op = document.getElementById("ag-reels-op"); if (op) op.hidden = fmtSel !== "reels";
      };
    });
    var pararMus = ligarMusica(document.getElementById("modal-body"), function (id) { musSel = id; });
    ligarComoPublicar(document.getElementById("modal-body"), function (m) { manualSel = m; });
    document.getElementById("ag-confirmar").onclick = async function () {
      var btn = this;
      var d = document.getElementById("ag-data").value, t = document.getElementById("ag-hora").value || "18:00";
      if (!d) { toast("Escolha o dia da publicação."); return; }
      var quando = new Date(d + "T" + t);
      if (quando <= new Date(Date.now() + 5 * 60000)) { toast("Esse horário já passou (ou está em menos de 5 minutos) — escolha outro."); return; }
      if (quando > addDays(90)) { toast("Dá pra agendar até 90 dias à frente."); return; }
      if (fmtSel === "feed" && (!c.slides || c.slides.length < 2 || c.slides.length > 10)) { toast("Pra publicar no feed o carrossel precisa ter de 2 a 10 slides."); return; }
      if (fmtSel === "reels" && !ehReels(c) && (!c.slides || !c.slides.length)) { toast("Este carrossel não tem slides para virar vídeo."); return; }
      if (ehReels(c) && !videoDe(c)) { toast("O vídeo deste Reels não foi encontrado. Gere o vídeo de novo."); return; }
      if (c.status !== "agendado" && testeSemPublicacoes()) { closeModal(); avisoFimDoTeste(); return; }
      btn.disabled = true; var orig = btn.textContent; btn.textContent = "Agendando…";
      var eraRascunho = c.status !== "agendado";
      try {
        var iso = quando.toISOString();
        var contasSel = lerContasMarcadas(document.getElementById("ag-contas"));
        if (contasAtivas().length > 1 && !contasSel.length) { toast("Marque pelo menos um Instagram."); btn.disabled = false; btn.textContent = orig; return; }
        var extra = {};
        if (fmtSel === "reels" && !ehReels(c)) {
          // carrossel → Reels: monta o vídeo 9:16 com os slides e guarda no Storage pro servidor publicar
          var blRe = await renderCarouselBlobs(c, function (n, tot) { btn.textContent = "Preparando slide " + n + "/" + tot + "…"; }, "reels");
          if (pararMus) pararMus();
          var musBlob = null;
          if (musSel) { btn.textContent = "Carregando a música…"; try { musBlob = await window.VitrineMusicas.carregar(musSel); } catch (e) { toast("Não consegui carregar a música; o vídeo sai sem música."); } }
          var vid = await gerarVideoReels(blRe, function (pc) { btn.textContent = "Gerando o vídeo " + pc + "%…"; }, musBlob);
          blRe.forEach(function (b) { setTimeout(function () { URL.revokeObjectURL(b.url); }, 30000); });
          btn.textContent = "Enviando o vídeo…";
          extra = { formato: "reels", video_url: await subirVideoReels(vid), legenda: c.legenda || legendaPadrao(c) };
        }
        extra.publicar_manual = fmtSel === "reels" ? manualSel : false;
        var upd = await DB.update("carrosseis", "id=eq." + c.id, Object.assign({ status: "agendado", data_agendada: iso, erro_publicacao: null, instagram_contas_ids: contasSel }, extra));
        Object.assign(c, extra);
        // com a aprovação do gestor ligada, o banco troca 'agendado' por 'aguardando_aprovacao'
        var stFinal = upd && upd[0] && upd[0].status ? upd[0].status : "agendado";
        c.status = stFinal; c.data_agendada = iso; c.erro_publicacao = null; c.instagram_contas_ids = contasSel;
        // imagens do feed prontas no Storage pro servidor publicar na hora marcada
        // rascunho pode ter sido editado (fonte/fotos) depois de algum render antigo: renderiza de novo
        if (!ehReels(c) && (eraRascunho || c.slides.some(function (s) { return !s.render_url; }))) {
          try { await prepararAgendado(c, function (n, tot) { btn.textContent = "Preparando imagens " + n + "/" + tot + "…"; }); }
          catch (e) { toast("Agendado, mas as imagens não foram preparadas (" + e.message + "). Abra o app antes do horário que eu tento de novo."); }
        }
        closeModal(); renderPainel(); renderInstagram();
        if (stFinal === "aguardando_aprovacao") toast("Enviado para aprovação do gestor.");
        else if (c.publicar_manual) toast("Agendado para " + fmtDateTime(iso) + " — na hora a Vitrine te avisa para postar pelo app e escolher a música.");
        else toast("Agendado para " + fmtDateTime(iso) + (igOn ? " — vai ser publicado sozinho no Instagram." : ". Conecte o Instagram (aba Instagram) até lá pra publicar sozinho."));
      } catch (err) { toast("Erro ao agendar: " + err.message); btn.disabled = false; btn.textContent = orig; }
    };
  }

  /* ============================================================
     IMÓVEIS
  ============================================================ */
  function specsLine(p) {
    if (p.tipo === "terreno") return (p.area_m2 || 0) + " m² de área";
    var s = (p.area_m2 || 0) + " m² · " + (p.quartos || 0) + " quarto" + (p.quartos > 1 ? "s" : "") + (p.suites ? " (" + p.suites + " suíte" + (p.suites > 1 ? "s" : "") + ")" : "");
    if (p.vagas) s += " · " + p.vagas + " vaga" + (p.vagas > 1 ? "s" : "");
    return s;
  }

  function fotosDe(p) {
    return (p && Array.isArray(p.fotos) ? p.fotos : []).map(function (f) {
      var u = typeof f === "string" ? f : (f && f.url) || "";
      return /^https:\/\//.test(u) ? safeUrl(u) : "";
    }).filter(Boolean);
  }
  function propCardHtml(p) {
    var fotos = fotosDe(p);
    var specs = p.tipo === "terreno"
      ? '<span>' + ICONS.ruler + (p.area_m2 || 0) + ' m²</span>'
      : '<span>' + ICONS.ruler + (p.area_m2 || 0) + ' m²</span><span>' + ICONS.bed + (p.quartos || 0) + ' qts</span><span>' + ICONS.car + (p.vagas || 0) + ' vg</span>';
    return '<div class="prop-card">' +
      '<div class="prop-cover' + (fotos.length ? " has-foto" : "") + '">' + (fotos.length ? imgWithFallback(fotos[0], propCoverSvg(p.tipo)) : propCoverSvg(p.tipo)) + '<span class="tag">' + escapeHtml(p.tipo) + '</span>' + (fotos.length ? '<span class="prop-nfotos">' + fotos.length + ' foto' + (fotos.length > 1 ? "s" : "") + '</span>' : "") + '</div>' +
      '<div class="prop-body">' +
      '<h3>' + escapeHtml(p.titulo) + '</h3>' +
      '<div class="prop-addr">' + escapeHtml(p.bairro || "") + ' · ' + escapeHtml(p.cidade || "") + '</div>' +
      '<div class="prop-specs">' + specs + '</div>' +
      '<div class="prop-price">' + fmtBRL(p.preco) + (p.finalidade === "aluguel" ? " /mês" : "") + '</div>' +
      '</div>' +
      '<div class="prop-foot"><button class="btn btn-primary" data-create="' + escapeHtml(p.id) + '">' + ICONS.wand + ' Criar carrossel</button>' +
      '<div class="prop-acts"><button class="btn btn-ghost btn-sm" data-prop-fotos="' + escapeHtml(p.id) + '">Fotos</button>' +
      '<button class="btn btn-ghost btn-sm" data-prop-link="' + escapeHtml(p.id) + '" title="Copiar o link da página pública deste imóvel">Copiar link da página</button>' +
      '<button class="btn btn-ghost btn-sm btn-danger" data-prop-del="' + escapeHtml(p.id) + '">Excluir</button></div></div>' +
      '<div class="imv-stats" data-prop-stats="' + escapeHtml(p.id) + '" style="font-size:12px;color:var(--text-3,#a1a1aa);padding:0 16px 12px;">0 visitas · 0 cliques no WhatsApp</div>' +
      '</div>';
  }
  function linkPaginaImovel(id) { return new URL("imovel.html?id=" + encodeURIComponent(id), window.location.href).toString(); }
  // contadores de visitas/cliques da página pública (RLS: só o dono lê)
  async function carregarEstatsImoveis() {
    if (!state.propriedades.length) return;
    try {
      var ids = state.propriedades.map(function (p) { return p.id; }).join(",");
      var rows = await DB.select("imovel_eventos", "select=propriedade_id,tipo&propriedade_id=in.(" + ids + ")&limit=20000");
      var cont = {};
      (rows || []).forEach(function (r) { var c = cont[r.propriedade_id] || (cont[r.propriedade_id] = { visita: 0, whatsapp: 0 }); c[r.tipo]++; });
      qsa("[data-prop-stats]").forEach(function (el) {
        var c = cont[el.dataset.propStats] || { visita: 0, whatsapp: 0 };
        el.textContent = c.visita + (c.visita === 1 ? " visita" : " visitas") + " · " + c.whatsapp + (c.whatsapp === 1 ? " clique" : " cliques") + " no WhatsApp";
      });
    } catch (e) { /* contadores são opcionais */ }
  }
  function renderImoveis() {
    document.getElementById("imoveis-count").textContent = state.propriedades.length + " imóveis";
    document.getElementById("prop-grid").innerHTML = state.propriedades.map(propCardHtml).join("") +
      '<button class="add-card" id="add-prop">' + ICONS.plus + ' Novo imóvel</button>';
    qsa("[data-create]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!tryStartWizard()) return;
        wizard.subjectMode = "property";
        wizard.propertyId = b.dataset.create;
        wizard.step = 2;
        showScreen("novo");
        renderWizard();
      });
    });
    qsa("[data-prop-fotos]").forEach(function (b) { b.addEventListener("click", function () { openFotosImovel(b.dataset.propFotos); }); });
    qsa("[data-prop-link]").forEach(function (b) {
      b.addEventListener("click", function () {
        var url = linkPaginaImovel(b.dataset.propLink);
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { toast("Link copiado! Cole na bio do Instagram."); }, function () { window.prompt("Copie o link:", url); });
        else window.prompt("Copie o link:", url);
      });
    });
    carregarEstatsImoveis();
    qsa("[data-prop-del]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var p = findProp(b.dataset.propDel); if (!p) return;
        if (!window.confirm('Excluir o imóvel "' + (p.titulo || "") + '"? Os carrosséis já criados continuam salvos.')) return;
        b.disabled = true;
        try {
          // solta os carrosséis desse imóvel antes (eles continuam existindo), depois apaga o imóvel
          await DB.rest("carrosseis?propriedade_id=eq." + encodeURIComponent(p.id), { method: "PATCH", body: JSON.stringify({ propriedade_id: null }), headers: { Prefer: "return=minimal" } });
          await DB.del("propriedades", "id=eq." + encodeURIComponent(p.id));
          state.propriedades = state.propriedades.filter(function (x) { return x.id !== p.id; });
          renderImoveis();
          toast("Imóvel excluído.");
        } catch (e) { b.disabled = false; toast("Não consegui excluir: " + e.message); }
      });
    });
    document.getElementById("add-prop").addEventListener("click", openAddPropertyModal);
  }

  // fotos do imóvel: até 10, JPG/PNG/WEBP, guardadas na pasta do próprio corretor no Storage
  var MAX_FOTOS_IMOVEL = 10;
  async function enviarFotosImovel(p, files) {
    var atuais = fotosDe(p);
    var lista = Array.prototype.slice.call(files || []);
    var livres = Math.max(MAX_FOTOS_IMOVEL - atuais.length, 0);
    if (lista.length > livres) { toast("Máximo de " + MAX_FOTOS_IMOVEL + " fotos por imóvel — enviando só " + livres + "."); lista = lista.slice(0, livres); }
    var novas = [];
    for (var i = 0; i < lista.length; i++) {
      var f = lista[i];
      if (["image/jpeg", "image/png", "image/webp"].indexOf(f.type) < 0) { toast(f.name + ": envie JPG, PNG ou WEBP."); continue; }
      if (f.size > 15 * 1024 * 1024) { toast(f.name + ": foto muito grande (máx. 15 MB)."); continue; }
      var ext = f.type.split("/")[1].replace("jpeg", "jpg");
      novas.push(await uploadArquivo(f, state.profile.id + "/imoveis/" + p.id + "/" + Date.now() + "-" + i + "." + ext, f.type));
    }
    if (!novas.length) return;
    var fotos = atuais.concat(novas);
    await DB.update("propriedades", "id=eq." + encodeURIComponent(p.id), { fotos: fotos });
    p.fotos = fotos;
  }
  async function salvarOrdemFotos(p, fotos) {
    await DB.update("propriedades", "id=eq." + encodeURIComponent(p.id), { fotos: fotos });
    p.fotos = fotos;
  }
  function openFotosImovel(id) {
    var p = findProp(id); if (!p) return;
    function desenhar() {
      var fotos = fotosDe(p);
      var body = document.getElementById("modal-body");
      body.innerHTML =
        '<div class="modal-head"><div><h3 style="font-size:19px;">Fotos do imóvel</h3><p class="imv-sub">' + escapeHtml(p.titulo) + ' · ' + fotos.length + '/' + MAX_FOTOS_IMOVEL + ' — a 1ª é a capa, e elas entram nos carrosséis desse imóvel</p></div><button class="modal-close" id="modal-close">' + ICONS.close + '</button></div>' +
        '<div class="imv-fotos">' + fotos.map(function (u, i) {
          return '<div class="imv-foto">' + imgWithFallback(u, "") +
            (i === 0 ? '<span class="imv-capa">Capa</span>' : '<button type="button" class="imv-capa-btn" data-capa="' + i + '">Usar como capa</button>') +
            '<button type="button" class="imv-rm" data-rm="' + i + '" title="Remover foto">' + ICONS.close + '</button></div>';
        }).join("") +
        (fotos.length < MAX_FOTOS_IMOVEL ? '<label class="imv-add">' + ICONS.plus + '<span>Adicionar fotos</span><input type="file" id="imv-input" accept="image/jpeg,image/png,image/webp" multiple hidden></label>' : "") +
        '</div>';
      document.getElementById("modal-close").addEventListener("click", function () { closeModal(); renderImoveis(); });
      var inp = document.getElementById("imv-input");
      if (inp) inp.addEventListener("change", async function () {
        toast("Enviando fotos…");
        try { await enviarFotosImovel(p, inp.files); toast("Fotos salvas."); } catch (e) { toast("Erro ao enviar: " + e.message); }
        desenhar();
      });
      qsa("[data-rm]", body).forEach(function (b) {
        b.addEventListener("click", async function () {
          var f2 = fotosDe(p); f2.splice(+b.dataset.rm, 1);
          try { await salvarOrdemFotos(p, f2); desenhar(); } catch (e) { toast("Erro: " + e.message); }
        });
      });
      qsa("[data-capa]", body).forEach(function (b) {
        b.addEventListener("click", async function () {
          var f2 = fotosDe(p); var f = f2.splice(+b.dataset.capa, 1)[0]; f2.unshift(f);
          try { await salvarOrdemFotos(p, f2); desenhar(); } catch (e) { toast("Erro: " + e.message); }
        });
      });
    }
    desenhar();
    document.getElementById("overlay").hidden = false;
  }

  function openAddPropertyModal() {
    document.getElementById("modal-body").innerHTML =
      '<div class="modal-head"><h3 style="font-size:19px;">Novo imóvel</h3><button class="modal-close" id="modal-close">' + ICONS.close + '</button></div>' +
      '<div class="card" style="padding:12px;margin-bottom:14px;"><div style="font-size:13px;font-weight:600;margin-bottom:6px;">Importar por link</div>' +
      '<div style="display:flex;gap:8px;"><input type="url" id="np-link" placeholder="Cole o link do anúncio (ZAP, VivaReal, OLX, QuintoAndar...)" style="flex:1;min-width:0;">' +
      '<button class="btn btn-ghost" type="button" id="np-importar">Importar</button></div>' +
      '<div id="np-imp-msg" style="font-size:12px;margin-top:6px;opacity:.8;"></div>' +
      '<div id="np-imp-fotos" hidden style="margin-top:10px;"></div></div>' +
      '<div class="form-grid">' +
      '<label class="full">Título<input type="text" id="np-titulo" placeholder="Ex: Cobertura duplex na Praia de Iracema"></label>' +
      '<label>Bairro<input type="text" id="np-bairro" placeholder="Ex: Iracema"></label>' +
      '<label>Cidade<input type="text" id="np-cidade" placeholder="Ex: Fortaleza · CE"></label>' +
      '<label>Tipo<select id="np-tipo"><option value="apartamento">Apartamento</option><option value="casa">Casa</option><option value="terreno">Terreno</option></select></label>' +
      '<label>Finalidade<select id="np-finalidade"><option value="venda">Venda</option><option value="aluguel">Aluguel</option></select></label>' +
      '<label>Preço (R$)<input type="number" id="np-preco" placeholder="450000"></label>' +
      '<label>Área (m²)<input type="number" id="np-m2" placeholder="80"></label>' +
      '<label>Quartos<input type="number" id="np-quartos" value="0"></label>' +
      '<label>Vagas<input type="number" id="np-vagas" value="0"></label>' +
      '<label class="full">Diferenciais (separe por vírgula)<textarea id="np-dif" rows="2" placeholder="Vista para o mar, Reformado, Aceita permuta"></textarea></label>' +
      '<label class="full">Fotos do imóvel (opcional, até 10 — JPG, PNG ou WEBP)<input type="file" id="np-fotos" accept="image/jpeg,image/png,image/webp" multiple></label>' +
      '</div>' +
      '<div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">' +
      '<button class="btn btn-ghost" id="np-cancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="np-save">Adicionar imóvel</button></div>';
    document.getElementById("overlay").hidden = false;
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("np-cancel").addEventListener("click", closeModal);
    var fotosImportadas = [];
    var todasImportadas = [];
    var arquivosFotos = null; // Files já baixados (pra "Baixar todas" funcionar no celular sem perder o toque)
    var enderecoImportado = "";
    function desenharFotosImportadas() {
      var box = document.getElementById("np-imp-fotos");
      if (!todasImportadas.length) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
        '<span style="font-size:12px;opacity:.85;">' + fotosImportadas.length + ' de ' + todasImportadas.length + ' marcadas pro imóvel (máx. ' + MAX_FOTOS_IMOVEL + ')</span>' +
        '<button class="btn btn-primary" type="button" id="np-baixar" style="padding:8px 12px;font-size:13px;">⬇️ Baixar todas (' + todasImportadas.length + ')</button></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:6px;">' +
        todasImportadas.map(function (u, i) {
          var on = fotosImportadas.indexOf(u) >= 0;
          return '<button type="button" data-fi="' + i + '" title="' + (on ? "Tirar do imóvel" : "Usar no imóvel") + '" style="position:relative;padding:0;border:2px solid ' + (on ? "var(--accent)" : "transparent") + ';border-radius:8px;overflow:hidden;aspect-ratio:1;background:#18181B;cursor:pointer;opacity:' + (on ? 1 : .45) + '">' +
            '<img src="' + escapeHtml(u) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">' +
            (on ? '<span style="position:absolute;top:3px;right:3px;background:var(--accent);color:#0A0A0A;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;font-weight:700;">✓</span>' : '') +
            '</button>';
        }).join("") + '</div>';
      qsa("[data-fi]", box).forEach(function (b) {
        b.addEventListener("click", function () {
          var u = todasImportadas[+b.dataset.fi], k = fotosImportadas.indexOf(u);
          if (k >= 0) fotosImportadas.splice(k, 1);
          else if (fotosImportadas.length >= MAX_FOTOS_IMOVEL) { toast("No máximo " + MAX_FOTOS_IMOVEL + " fotos por imóvel."); return; }
          else fotosImportadas.push(u);
          fotosImportadas.sort(function (a, c) { return todasImportadas.indexOf(a) - todasImportadas.indexOf(c); });
          desenharFotosImportadas();
        });
      });
      document.getElementById("np-baixar").addEventListener("click", baixarTodasFotos);
      prepararArquivosFotos();
    }
    function nomeFoto(i, tipo) {
      var base = (document.getElementById("np-titulo").value.trim() || "imovel").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "imovel";
      return base + "-" + String(i + 1).padStart(2, "0") + (/png/.test(tipo) ? ".png" : /webp/.test(tipo) ? ".webp" : ".jpg");
    }
    var prepPromise = null;
    function prepararArquivosFotos() {
      if (prepPromise) return prepPromise;
      var lista = todasImportadas.slice();
      prepPromise = Promise.all(lista.map(function (u, i) {
        return fetch(u).then(function (r) { if (!r.ok) throw new Error(); return r.blob(); })
          .then(function (bl) { return new File([bl], nomeFoto(i, bl.type), { type: bl.type || "image/jpeg" }); })
          .catch(function () { return null; });
      })).then(function (fs) { arquivosFotos = fs.filter(Boolean); return arquivosFotos; });
      return prepPromise;
    }
    async function baixarTodasFotos() {
      var b = document.getElementById("np-baixar");
      // celular: abre a folha de compartilhar com todas as fotos ("Salvar imagens" / "Salvar na galeria")
      var celular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
      if (!arquivosFotos) { b.disabled = true; b.textContent = "Preparando fotos…"; await prepararArquivosFotos(); b.disabled = false; b.textContent = "⬇️ Baixar todas (" + todasImportadas.length + ")"; if (celular) { toast("Fotos prontas! Toque de novo em Baixar todas."); return; } }
      var arqs = arquivosFotos || [];
      if (!arqs.length) { toast("Não consegui baixar as fotos desse anúncio."); return; }
      if (celular && navigator.canShare && navigator.canShare({ files: arqs })) {
        try { await navigator.share({ files: arqs, title: "Fotos do imóvel" }); return; }
        catch (e) { if (e && e.name === "AbortError") return; }
      }
      // computador (ou celular sem compartilhar): baixa uma por uma
      for (var i = 0; i < arqs.length; i++) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(arqs[i]); a.download = arqs[i].name;
        document.body.appendChild(a); a.click(); a.remove();
        (function (h) { setTimeout(function () { URL.revokeObjectURL(h); }, 60000); })(a.href);
        await new Promise(function (r) { setTimeout(r, 350); });
      }
      toast(arqs.length + " foto(s) baixada(s). Se o navegador perguntar, permita vários downloads.");
    }
    document.getElementById("np-importar").addEventListener("click", async function () {
      var inp = document.getElementById("np-link"), msg = document.getElementById("np-imp-msg"), b = this;
      var link = inp.value.trim();
      if (!link) { toast("Cole o link do anúncio."); return; }
      b.disabled = true; msg.textContent = "Lendo o anúncio… pode levar até 30 segundos.";
      try {
        var r = await callFunction("importar-imovel", { url: link });
        var d = r.dados || {};
        function set(id, v) { if (v !== null && v !== undefined && v !== "") document.getElementById(id).value = v; }
        set("np-titulo", d.titulo); set("np-bairro", d.bairro); set("np-cidade", d.cidade);
        set("np-tipo", d.tipo); set("np-finalidade", d.finalidade); set("np-preco", d.preco);
        set("np-m2", d.area_m2); set("np-quartos", d.quartos);
        if (d.diferenciais && d.diferenciais.length) document.getElementById("np-dif").value = d.diferenciais.join(", ");
        enderecoImportado = d.endereco || "";
        todasImportadas = (r.fotos || []).filter(function (u) { return /^https:\/\//.test(u); });
        fotosImportadas = todasImportadas.slice(0, MAX_FOTOS_IMOVEL);
        msg.textContent = todasImportadas.length
          ? "Pronto! " + todasImportadas.length + " foto(s) encontrada(s). Baixe todas pro seu aparelho e marque as que vão pro imóvel."
          : "Dados importados, mas o site não liberou as fotos. Envie as fotos manualmente abaixo.";
        desenharFotosImportadas();
      } catch (e) { msg.textContent = e.message; }
      finally { b.disabled = false; }
    });
    document.getElementById("np-save").addEventListener("click", async function () {
      var titulo = document.getElementById("np-titulo").value.trim();
      if (!titulo) { toast("Dê um título ao imóvel."); return; }
      var bairro = document.getElementById("np-bairro").value.trim();
      var cidade = document.getElementById("np-cidade").value.trim() || "Fortaleza · CE";
      var diferenciais = document.getElementById("np-dif").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      if (!diferenciais.length) diferenciais = ["Ótima localização", "Pronto para morar"];
      var payload = {
        corretor_id: state.profile.id,
        tipo: document.getElementById("np-tipo").value,
        finalidade: document.getElementById("np-finalidade").value,
        titulo: titulo,
        bairro: bairro || null,
        cidade: cidade,
        endereco: enderecoImportado || ((bairro || "") + ", " + cidade),
        preco: Number(document.getElementById("np-preco").value) || 0,
        area_m2: Number(document.getElementById("np-m2").value) || 0,
        quartos: Number(document.getElementById("np-quartos").value) || 0,
        suites: 0,
        vagas: Number(document.getElementById("np-vagas").value) || 0,
        diferenciais: diferenciais
      };
      var arqsSel = document.getElementById("np-fotos").files;
      if (fotosImportadas.length && !(arqsSel && arqsSel.length)) payload.fotos = fotosImportadas;
      var btn = this; btn.disabled = true;
      try {
        var rows = await DB.insert("propriedades", payload);
        state.propriedades.push(rows[0]);
        var arqs = document.getElementById("np-fotos").files;
        if (arqs && arqs.length) {
          btn.textContent = "Enviando fotos…";
          try { await enviarFotosImovel(rows[0], arqs); } catch (e2) { toast("Imóvel salvo, mas as fotos falharam: " + e2.message); }
        }
        closeModal(); renderImoveis();
        toast("Imóvel adicionado.");
      } catch (err) {
        toast("Erro ao salvar: " + err.message);
      } finally { btn.disabled = false; }
    });
  }

  /* ============================================================
     WIZARD
  ============================================================ */
  function freshWizard() {
    return { step: 1, subjectMode: "topic", propertyId: null, topicId: null, customTopic: "", customCategoria: "Dicas", slides: null, templateSlug: "minimalista", fonte: "impacto", dest: "rascunho", customPrompt: "", melhorar: true, calc: null, calcSig: "" };
  }
  var wizard = freshWizard();
  function resetWizard() {
    wizard = freshWizard(); cal = null;
    var tl = document.getElementById("tema-livre-txt"); if (tl) tl.value = "";
    var d = document.getElementById("sched-date"); if (d) d.value = "";
    var sc = document.getElementById("sched-contas"); if (sc) sc.innerHTML = "";
  }

  // svg puro (usado como base/fallback, ex. spotlight do passo 1-2, onde a foto real ainda não importa)
  function wizardArtSvg() {
    if (wizard.subjectMode === "property") { var p = findProp(wizard.propertyId); return p ? propCoverSvg(p.tipo) : null; }
    if (wizard.subjectMode === "topic") { var t = findTopic(wizard.topicId); return t ? topicCoverSvg(t.categoria) : null; }
    return customCoverSvg();
  }
  // foto de capa real (Pollinations.ai) com o SVG como fallback — usada no preview do carrossel (passo 3) e ao salvar.
  function wizardArt() {
    var svg = wizardArtSvg();
    if (!svg) return null;
    return aiCoverImg(wizardCoverPrompt(), svg);
  }
  function wizardCoverPrompt() {
    if (wizard.subjectMode === "property") { var p = findProp(wizard.propertyId); return coverPromptFor("property", p || {}); }
    if (wizard.subjectMode === "topic") { var t = findTopic(wizard.topicId); return coverPromptFor("topic", t || {}); }
    return coverPromptFor("custom", { categoria: wizard.customCategoria });
  }

  function invalidateSlides() { wizard.slides = null; }
  // contexto curto (bairro/tipo do imóvel ou categoria do assunto) pra imagem de cada slide combinar com o tema
  function wizardContexto() {
    if (wizard.subjectMode === "simfin") return "financiamento imobiliário, casa própria, família";
    if (wizard.subjectMode === "simalug") return "alugar ou comprar imóvel, casa própria";
    if (wizard.subjectMode === "precos") return "preço do metro quadrado, bairros, mercado imobiliário";
    if (wizard.subjectMode === "property") { var p = findProp(wizard.propertyId); return p ? (p.tipo || "imóvel") + " em " + (p.bairro || "") : ""; }
    if (wizard.subjectMode === "topic") { var t = findTopic(wizard.topicId); return t ? "mercado imobiliário, " + t.categoria : ""; }
    return "mercado imobiliário, " + (wizard.customCategoria || "");
  }

  var CATEGORIAS = ["Dicas", "Financiamento", "Vendas", "Mercado"];

  function wireStep1Once() {
    qsa("#mode-tabs .mode-tab").forEach(function (b) {
      b.addEventListener("click", function () {
        if (wizard.subjectMode !== b.dataset.mode) invalidateSlides();
        wizard.subjectMode = b.dataset.mode; renderSubjectStep();
      });
    });
    document.getElementById("cat-pick").innerHTML = CATEGORIAS.map(function (cat) {
      return '<button type="button" class="cat-chip" data-cat="' + cat + '">' + cat + '</button>';
    }).join("");
    qsa("#cat-pick .cat-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        if (wizard.customCategoria !== b.dataset.cat) invalidateSlides();
        wizard.customCategoria = b.dataset.cat; renderCustomForm();
      });
    });
    document.getElementById("custom-topic").addEventListener("input", function (e) {
      if (wizard.customTopic !== e.target.value) invalidateSlides();
      wizard.customTopic = e.target.value;
    });
    // tema livre (caixa grande no topo do passo 1): escreve a ideia e já vai pra geração
    function categoriaDoTema(t) {
      t = t.toLowerCase();
      if (/financ|juros|parcela|caixa|fgts|banco|entrada|cr[eé]dito/.test(t)) return "Financiamento";
      if (/vend|negoci|cliente|comprador|visita|proposta|corretor/.test(t)) return "Vendas";
      if (/mercado|valoriz|pre[cç]o|alta|queda|investi|aluguel sobe|tend[eê]ncia|bairro/.test(t)) return "Mercado";
      return "Dicas";
    }
    async function criarComTemaLivre() {
      var txt = document.getElementById("tema-livre-txt").value.trim();
      if (txt.length < 5) { toast("Escreva sua ideia em pelo menos algumas palavras."); document.getElementById("tema-livre-txt").focus(); return; }
      if (!(await avisarTemaRepetido(txt, null))) return;
      wizard.temaAvisado = txt;
      invalidateSlides();
      wizard.subjectMode = "custom";
      wizard.customTopic = txt;
      wizard.customCategoria = categoriaDoTema(txt);
      wizard.customPrompt = formatosTemaLivre.map(function (i) { return FORMATOS_VIRAIS[i].txt; }).join(" ");
      wizard.step = 2;
      renderWizard();
      runGeneration();
    }
    document.getElementById("tema-livre-btn").addEventListener("click", criarComTemaLivre);
    var formatosTemaLivre = [];
    var boxF = document.getElementById("tema-livre-formatos");
    if (boxF) {
      boxF.innerHTML = formatosHtml("formatos-tema", "");
      qsa("#formatos-tema .formato-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = +b.dataset.formato, k = formatosTemaLivre.indexOf(i);
          if (k >= 0) formatosTemaLivre.splice(k, 1); else formatosTemaLivre.push(i);
          b.classList.toggle("on", k < 0);
        });
      });
    }
    document.getElementById("tema-livre-txt").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); criarComTemaLivre(); }
    });
    document.getElementById("surprise-btn").addEventListener("click", function () {
      invalidateSlides(); wizard.subjectMode = "topic"; renderSubjectStep();
    });
    document.getElementById("wiz-cancel").addEventListener("click", function () { resetWizard(); showScreen("painel"); });
    document.getElementById("wiz-back").addEventListener("click", function () { if (wizard.step > 1) { wizard.step--; renderWizard(); } });
    document.getElementById("wiz-next").addEventListener("click", onWizNext);
  }

  /* ---------- slides de cálculo (sem IA): simulação de financiamento e alugar x comprar (simulacao.js) ---------- */
  function ehCalc() { return wizard.subjectMode === "simfin" || wizard.subjectMode === "simalug" || wizard.subjectMode === "precos"; }
  var CALC_CAMPOS = {
    simfin: [
      { k: "valor", rot: "Valor do imóvel (R$)", pad: "500000" }, { k: "entrada", rot: "Entrada (%)", pad: "20" },
      { k: "anos", rot: "Prazo (anos)", pad: "30" }, { k: "taxa", rot: "Juros ao ano (%)", pad: "11,5", dica: "Taxa ilustrativa, confira com o banco." }
    ],
    simalug: [
      { k: "aluguel", rot: "Aluguel mensal (R$)", pad: "2500" }, { k: "valor", rot: "Valor do imóvel (R$)", pad: "500000" },
      { k: "entrada", rot: "Entrada (%)", pad: "20" }, { k: "anos", rot: "Prazo do financiamento (anos)", pad: "30" },
      { k: "taxa", rot: "Juros ao ano (%)", pad: "11,5", dica: "Taxa ilustrativa, confira com o banco." },
      { k: "rend", rot: "Rendimento da aplicação (% ao mês)", pad: "0,8" },
      { k: "valoriz", rot: "Valorização do imóvel (% ao ano)", pad: "5" }, { k: "reaj", rot: "Reajuste do aluguel (% ao ano)", pad: "5" }
    ]
  };
  function numBR(t) {
    t = String(t == null ? "" : t).replace(/[R$\s%]/g, "");
    if (t.indexOf(",") >= 0) t = t.replace(/\./g, "").replace(",", ".");
    else if (/\.\d{3}(\.|$)/.test(t)) t = t.replace(/\./g, "");
    var n = parseFloat(t); return isFinite(n) ? n : NaN;
  }
  function renderCalcForm() {
    var box = document.getElementById("subject-calc"), m = wizard.subjectMode;
    wizard.calc = wizard.calc || {};
    if (m === "precos") { if (window.VitrineCresc) window.VitrineCresc.renderPrecos(box, wizard); return; }   // crescimento.js
    var v = wizard.calc[m] = wizard.calc[m] || {};
    var titulo = m === "simfin" ? "Simulação de financiamento (SAC e Price)" : "Alugar ou comprar? Comparativo em 10 anos";
    var sub = m === "simfin" ? "A Vitrine calcula a parcela, os juros e a renda mínima e monta 7 slides prontos — sem IA, só conta."
      : "Compara comprar financiado com alugar e investir a entrada, ao longo de 10 anos. 7 slides prontos, sem IA.";
    box.innerHTML = '<div class="calc-form"><h4>' + titulo + '</h4><p class="calc-sub">' + sub + '</p><div class="calc-grid">' +
      CALC_CAMPOS[m].map(function (c) {
        return '<label>' + c.rot + '<input type="text" inputmode="decimal" data-calc="' + c.k + '" value="' + escapeHtml(v[c.k] != null ? v[c.k] : c.pad) + '">' + (c.dica ? '<small>' + c.dica + '</small>' : "") + '</label>';
      }).join("") + '</div><p class="calc-sub">Valores ilustrativos, sem seguros e tarifas. Os bancos analisam cada caso.</p></div>';
    qsa("[data-calc]", box).forEach(function (inp) { inp.addEventListener("input", function () { v[inp.dataset.calc] = inp.value; }); });
  }
  // lê o formulário, valida e monta os slides; devolve false se algo estiver inválido
  async function gerarSlidesCalculo() {
    if (wizard.subjectMode === "precos") return window.VitrineCresc ? window.VitrineCresc.gerarSlides(wizard) : false;   // crescimento.js
    var m = wizard.subjectMode, raw = (wizard.calc && wizard.calc[m]) || {}, o = {}, bad = null;
    var lim = { valor: [20000, 1e9, "o valor do imóvel"], aluguel: [100, 1e6, "o aluguel"], entrada: [0, 95, "a entrada (0 a 95%)"], anos: [1, 35, "o prazo (1 a 35 anos)"], taxa: [0, 40, "os juros ao ano"], rend: [0, 5, "o rendimento mensal (0 a 5%)"], valoriz: [-10, 30, "a valorização ao ano"], reaj: [0, 30, "o reajuste do aluguel"] };
    CALC_CAMPOS[m].forEach(function (c) {
      var n = numBR(raw[c.k] != null ? raw[c.k] : c.pad), l = lim[c.k];
      if (!(n >= l[0] && n <= l[1]) && !bad) bad = "Confira " + l[2] + ".";
      o[c.k] = n;
    });
    if (bad) { toast(bad); return false; }
    o.entradaPct = o.entrada; o.taxaAnual = o.taxa;
    var sig = m + JSON.stringify(o);
    if (wizard.slides && wizard.calcSig === sig) return true;       // nada mudou: mantém as edições feitas no texto
    var S = window.VitrineSim;
    wizard.slides = m === "simfin" ? S.slidesFinanciamento(o) : S.slidesAlugarComprar(o);
    wizard.customTopic = m === "simfin" ? S.descricaoFinanciamento(o) : S.descricaoAlugarComprar(o);
    wizard.customCategoria = "Financiamento";
    wizard.calcSig = sig;
    return true;
  }

  function renderSubjectStep() {
    qsa("#mode-tabs .mode-tab").forEach(function (b) { b.classList.toggle("active", b.dataset.mode === wizard.subjectMode); });
    document.getElementById("subject-calc").hidden = !ehCalc();
    if (ehCalc()) renderCalcForm();
    document.getElementById("subject-topic").hidden = wizard.subjectMode !== "topic";
    document.getElementById("subject-property").hidden = wizard.subjectMode !== "property";
    document.getElementById("subject-custom").hidden = wizard.subjectMode !== "custom";
    if (wizard.subjectMode === "topic") renderTopicGrid();
    if (wizard.subjectMode === "property") renderPickGrid();
    if (wizard.subjectMode === "custom") renderCustomForm();
  }

  // assuntos sugeridos: a cada carregamento da página mostra 6 diferentes — começa com um sorteio do banco
  // e troca pelos que a IA acabou de criar (sugerir-conteudo) assim que chegam
  var topicosDaVez = null, topicosIA = false;
  function sortear(lista, n) {
    var c = lista.slice();
    for (var i = c.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = c[i]; c[i] = c[j]; c[j] = t; }
    return c.slice(0, n);
  }
  // ---------- temas já usados: nunca repetir o mesmo assunto ----------
  var STOPWORDS_TEMA = {};
  ("a o as os um uma uns umas de da do das dos em na no nas nos por para pra com sem sobre entre ate e ou mas que se como mais menos muito muita seu sua seus suas meu minha ao aos ja nao sim e eh ser ter voce vc ele ela eles elas isso esse essa este esta aqui ali la qual quais quando onde porque por que dica dicas").split(" ")
    .forEach(function (w) { STOPWORDS_TEMA[w] = 1; });
  // minúsculas, sem acento, sem pontuação, sem stopwords; devolve o conjunto de palavras
  function palavrasDoTema(txt) {
    var s = String(txt || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ");
    var set = {}, n = 0;
    s.split(/\s+/).forEach(function (w) {
      if (w.length < 2 || STOPWORDS_TEMA[w]) return;
      if (w.length > 4 && /s$/.test(w)) w = w.slice(0, -1); // plural simples
      if (!set[w]) { set[w] = 1; n++; }
    });
    set._n = n;
    return set;
  }
  function similaridadeTemas(a, b) {
    var A = palavrasDoTema(a), B = palavrasDoTema(b);
    if (!A._n || !B._n) return 0;
    var inter = 0;
    Object.keys(A).forEach(function (w) { if (w !== "_n" && B[w]) inter++; });
    return inter / (A._n + B._n - inter);
  }
  var LIMIAR_TEMA_REPETIDO = 0.6;
  // texto do assunto de um carrossel: tópico do banco (gancho), assunto próprio ou título da capa (slide ordem 0)
  function textosDoCarrossel(c) {
    var out = [];
    if (c.topico_id) { var t = findTopic(c.topico_id); if (t && t.gancho) out.push(t.gancho); }
    if (c.assunto_custom) out.push(c.assunto_custom);
    var s0 = (c.slides || []).filter(function (s) { return s.ordem === 0; })[0] || (c.slides || [])[0];
    if (s0 && s0.titulo) out.push(s0.titulo);
    return out;
  }
  // carrosséis do corretor (rascunho, agendado ou publicado) mais recentes primeiro
  function carrosselsUsados() {
    return (state.carrosseis || []).filter(function (c) { return c.status === "rascunho" || c.status === "agendado" || c.status === "publicado"; })
      .slice().sort(ordemRecente);
  }
  // últimos ~60 temas usados (texto), pra IA da edge function evitar
  function temasUsados(n) {
    var out = [];
    carrosselsUsados().forEach(function (c) {
      var tx = textosDoCarrossel(c)[0];
      if (tx && out.indexOf(tx) < 0) out.push(String(tx).slice(0, 140));
    });
    return out.slice(0, n || 60);
  }
  // o tópico do banco já foi usado (mesmo id ou texto muito parecido)?
  function topicoJaUsado(t) {
    var usados = carrosselsUsados();
    for (var i = 0; i < usados.length; i++) {
      var c = usados[i];
      if (c.topico_id && c.topico_id === t.id) return true;
      var txs = textosDoCarrossel(c);
      for (var j = 0; j < txs.length; j++) if (similaridadeTemas(t.gancho, txs[j]) >= LIMIAR_TEMA_REPETIDO) return true;
    }
    return false;
  }
  // acha o carrossel mais parecido já usado com um tema (texto e/ou topico_id)
  function carrosselParecido(texto, topicoId) {
    var usados = carrosselsUsados(), melhor = null, nota = 0;
    usados.forEach(function (c) {
      if (c._temp) return;
      var sc = 0;
      if (topicoId && c.topico_id === topicoId) sc = 1;
      else if (texto) textosDoCarrossel(c).forEach(function (tx) { sc = Math.max(sc, similaridadeTemas(texto, tx)); });
      if (sc >= LIMIAR_TEMA_REPETIDO && sc > nota) { melhor = c; nota = sc; }
    });
    return melhor;
  }
  // aviso (não bloqueia): mostra o carrossel parecido e deixa "criar mesmo assim". Resolve true = pode seguir.
  function avisarTemaRepetido(texto, topicoId) {
    var c = carrosselParecido(texto, topicoId);
    if (!c) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var tx = textosDoCarrossel(c)[0] || "esse assunto";
      var quando = c.status === "publicado" ? "publicado em " + fmtDataTema(c.data_publicada || c.created_at)
        : c.status === "agendado" ? "agendado para " + fmtDataTema(c.data_agendada)
        : "rascunho criado em " + fmtDataTema(c.created_at);
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";
      var box = document.createElement("div");
      box.style.cssText = "background:#fff;color:#222;max-width:420px;width:100%;border-radius:14px;padding:20px;font:15px/1.4 system-ui,sans-serif";
      var h = document.createElement("div"); h.style.cssText = "font-weight:700;font-size:17px;margin-bottom:8px"; h.textContent = "Você já fez um carrossel parecido";
      var p = document.createElement("div"); p.style.cssText = "margin-bottom:16px";
      p.textContent = "“" + tx + "” — " + quando + ". Quer criar mesmo assim ou escolher outro tema?";
      var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap";
      function fim(v) { document.body.removeChild(ov); resolve(v); }
      var b1 = document.createElement("button"); b1.type = "button"; b1.textContent = "Escolher outro tema";
      b1.style.cssText = "padding:10px 14px;border-radius:10px;border:1px solid #ccc;background:#fff;cursor:pointer";
      var b2 = document.createElement("button"); b2.type = "button"; b2.textContent = "Criar mesmo assim";
      b2.style.cssText = "padding:10px 14px;border-radius:10px;border:0;background:#222;color:#fff;cursor:pointer";
      b1.onclick = function () { fim(false); }; b2.onclick = function () { fim(true); };
      row.appendChild(b1); row.appendChild(b2); box.appendChild(h); box.appendChild(p); box.appendChild(row); ov.appendChild(box); document.body.appendChild(ov);
    });
  }
  function fmtDataTema(iso) { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch (e) { return "—"; } }
  // lista sem os temas já usados (se tudo já foi usado, devolve a lista toda pra não esvaziar a tela)
  function semUsados(lista) { var l = lista.filter(function (t) { return !topicoJaUsado(t); }); return l.length ? l : lista; }
  var gerandoAssuntos = false;
  function statusAssuntos(txt) { var el = document.getElementById("topic-status"); if (el) el.textContent = txt; }
  // pede 6 assuntos inéditos pra IA (botão "Gerar novas sugestões"; automático só 1x/24h)
  // economia de IA: o banco de assuntos é renovado 1x por dia em lote (função banco-sugestoes, metade do preço).
  // "Gerar novas sugestões" mostra primeiro assuntos que este navegador ainda não viu; só chama a IA ao vivo se acabarem.
  function assuntosVistos() { try { return JSON.parse(localStorage.getItem("vitrine_assuntos_vistos") || "[]"); } catch (e) { return []; } }
  function marcarVistos(lista) {
    var v = assuntosVistos().concat(lista.map(function (t) { return t.id; }));
    try { localStorage.setItem("vitrine_assuntos_vistos", JSON.stringify(v.slice(-400))); } catch (e) { }
  }
  function ineditosDoBanco(n) {
    var vistos = {}; assuntosVistos().forEach(function (id) { vistos[id] = 1; });
    var novos = state.topicos.filter(function (t) { return !vistos[t.id] && !topicoJaUsado(t); })
      .sort(ordemRecente);
    return sortear(novos.slice(0, Math.max(n * 3, 18)), n);
  }
  function gerarNovosAssuntos(manual) {
    if (gerandoAssuntos) return;
    var doBanco = ineditosDoBanco(6);
    if (doBanco.length >= 6) {
      topicosDaVez = doBanco; topicosIA = true; marcarVistos(doBanco);
      statusAssuntos("✨ Assuntos novos criados pela IA hoje");
      if (wizard.subjectMode === "topic") renderTopicGrid();
      return;
    }
    gerandoAssuntos = true;
    var btn = document.getElementById("topic-novas");
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spin"></div> Gerando…'; }
    statusAssuntos("A IA está criando assuntos novos de mercado imobiliário…");
    callFunction("sugerir-conteudo", { tipo: "assunto", temas_usados: temasUsados(60) }).then(function (r) {
      // descarta o que a IA trouxer repetido (rede de segurança além do temas_usados)
      var novos = ((r && r.topicos) || []).filter(function (t) { return !topicoJaUsado(t); });
      if (!novos.length) throw new Error("A IA não trouxe sugestões agora.");
      state.topicos = state.topicos.concat(novos);
      topicosDaVez = novos.slice(0, 6); topicosIA = true; marcarVistos(topicosDaVez);
      statusAssuntos("✨ Assuntos novos criados pela IA agora");
      if (wizard.subjectMode === "topic") renderTopicGrid();
    }).catch(function (e) {
      if (manual) {
        // sem IA no momento (ex.: limite por hora): pelo menos troca por outros do banco
        topicosDaVez = sortear(semUsados(state.topicos), 6); topicosIA = false;
        if (wizard.subjectMode === "topic") renderTopicGrid();
        toast((e && e.message ? e.message : "Não deu pra gerar agora.") + " Mostrei outros assuntos do banco.");
      }
      statusAssuntos("");
    }).then(function () {
      gerandoAssuntos = false;
      var b = document.getElementById("topic-novas");
      if (b) { b.disabled = false; b.textContent = "✨ Gerar novas sugestões"; }
    });
  }
  function prepararAssuntos() {
    topicosDaVez = sortear(semUsados(state.topicos), 6); topicosIA = false;
    var btn = document.getElementById("topic-novas");
    if (btn && !btn.dataset.ok) { btn.dataset.ok = "1"; btn.addEventListener("click", function () { gerarNovosAssuntos(true); }); }
    // ao abrir: mostra os mais novos do banco que este navegador ainda não viu (sem chamar a IA)
    var ini = ineditosDoBanco(6);
    if (ini.length >= 6) { topicosDaVez = ini; marcarVistos(ini); }
    else if (state.topicos.length < 6) gerarNovosAssuntos(false);
  }

  function renderTopicGrid() {
    if (!topicosDaVez) topicosDaVez = sortear(semUsados(state.topicos), 6);
    if (wizard.topicId && !topicosDaVez.some(function (t) { return t.id === wizard.topicId; })) { var sel = findTopic(wizard.topicId); if (sel) topicosDaVez = [sel].concat(topicosDaVez.slice(0, 5)); }
    document.getElementById("topic-grid").innerHTML = topicosDaVez.map(function (t) {
      var primeiraIdeia = (t.ideias && t.ideias[0]) ? t.ideias[0].titulo : "";
      return '<div class="topic-card ' + (wizard.topicId === t.id ? "selected" : "") + '" data-topic="' + t.id + '">' +
        '<span class="topic-cat">' + escapeHtml(t.categoria) + '</span><h4>' + escapeHtml(t.gancho) + '</h4><p>' + escapeHtml(primeiraIdeia) + '</p></div>';
    }).join("");
    qsa("[data-topic]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (wizard.topicId !== el.dataset.topic) invalidateSlides();
        wizard.topicId = el.dataset.topic; renderTopicGrid();
      });
    });
  }

  function renderCustomForm() {
    document.getElementById("custom-topic").value = wizard.customTopic;
    qsa("#cat-pick .cat-chip").forEach(function (b) { b.classList.toggle("selected", b.dataset.cat === wizard.customCategoria); });
  }

  function renderSteps() {
    var labels = ["Assunto", "Conteúdo", "Estilo", "Publicar"];
    document.getElementById("steps").innerHTML = labels.map(function (l, i) {
      var n = i + 1, cls = n === wizard.step ? "active" : n < wizard.step ? "done" : "";
      var back = n < wizard.step;
      var dotContent = n < wizard.step ? ICONS.check : n;
      return '<div class="step ' + cls + (back ? " clickable" : "") + '"' + (back ? ' data-goto="' + n + '" title="Voltar pra este passo"' : "") + '>' +
        '<div class="dot">' + dotContent + '</div>' + l + '</div>' + (i < 3 ? '<div class="step-line"></div>' : "");
    }).join("");
    qsa("[data-goto]").forEach(function (el) {
      el.addEventListener("click", function () { wizard.step = Number(el.dataset.goto); renderWizard(); });
    });
  }

  function renderWizard() {
    renderSteps();
    ["1", "2", "3", "4"].forEach(function (n) { document.getElementById("wiz-step-" + n).hidden = (Number(n) !== wizard.step); });
    document.getElementById("wiz-back").style.visibility = wizard.step === 1 ? "hidden" : "visible";
    document.getElementById("wiz-next").textContent = wizard.step === 4 ? "Confirmar" : "Continuar";

    if (wizard.step === 1) renderSubjectStep();
    if (wizard.step === 2) renderGenArea();
    if (wizard.step === 3) renderTplStep();
    if (wizard.step === 4) renderDestStep();
  }

  function renderPickGrid() {
    document.getElementById("pick-grid").innerHTML = state.propriedades.map(function (p) {
      return '<div class="pick-card ' + (wizard.propertyId === p.id ? "selected" : "") + '" data-pick="' + p.id + '">' +
        '<div class="pick-cover">' + propCoverSvg(p.tipo) + '</div>' +
        '<div><h4>' + escapeHtml(p.titulo) + '</h4><div class="addr">' + escapeHtml(p.bairro || "") + '</div></div></div>';
    }).join("") || '<p style="font-size:12.5px;color:var(--ink-faint);">Você ainda não cadastrou imóveis. Adicione um em "Meus imóveis".</p>';
    qsa("[data-pick]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (wizard.propertyId !== el.dataset.pick) invalidateSlides();
        wizard.propertyId = el.dataset.pick; renderPickGrid();
      });
    });
  }

  // formatos que mais viralizam no Instagram: o corretor toca no botão e a IA segue a instrução (vai junto no direcionamento)
  var FORMATOS_VIRAIS = [
    { nome: "🔥 Gancho polêmico", txt: "Comece com uma afirmação forte e polêmica (sem mentir) que faça a pessoa parar de rolar; depois explique." },
    { nome: "❌ Erro comum", txt: "Formato 'erros que custam caro': cada slide é um erro comum e como evitar." },
    { nome: "🔢 Lista numerada", txt: "Lista numerada (ex.: 5 coisas que...), um item por slide, título curto e direto." },
    { nome: "🆚 Antes x depois", txt: "Formato antes e depois: em cada slide do meio, o título mostra a transformação (ex.: 'Sala escura *virou* clara') e o corpo explica o que mudou do antes para o depois." },
    { nome: "🧐 Mito x verdade", txt: "Formato mito x verdade: em cada slide do meio, o TÍTULO é o mito (a frase errada que as pessoas acreditam, sem escrever a palavra mito) e o CORPO é a verdade que corrige, em até 2 frases." },
    { nome: "⚖️ Isso ou aquilo", txt: "Formato enquete isso ou aquilo: em cada slide do meio, o título é uma pergunta com duas opções no formato 'X ou Y?' (ex.: 'Casa ou apê?') e o corpo provoca a escolha; o último slide pede para comentar A ou B." },
    { nome: "🤫 Ninguém te conta", txt: "Tom de bastidor: 'o que ninguém te conta sobre...', revelando algo que o cliente não sabe." },
    { nome: "✅ Checklist", txt: "Checklist prático para salvar: no corpo de cada slide, liste itens curtos separados por ponto e vírgula, que a pessoa possa conferir." },
    { nome: "❓ Pergunta pro seguidor", txt: "Termine com uma pergunta direta pro seguidor responder nos comentários." },
    { nome: "💾 Salve e compartilhe", txt: "Conteúdo útil de referência e último slide pedindo para salvar e mandar pra quem precisa." },
    { nome: "⏱️ Em 30 segundos", txt: "Bem direto: frases curtíssimas, como uma dica rápida de 30 segundos." },
    { nome: "📖 História real", txt: "Conte em formato de história curta de um cliente (sem nomes reais), com começo, problema e solução." },
    { nome: "🎯 Pra quem é", txt: "Fale direto com um público específico logo no título (ex.: 'Se você ganha até X...' ou 'Se você vai comprar o 1º imóvel...')." }
  ];
  // junta ou tira a instrução do formato no texto do direcionamento
  function alternarFormato(texto, instrucao) {
    texto = String(texto || "");
    if (texto.indexOf(instrucao) >= 0) return texto.replace(instrucao, "").replace(/\s{2,}/g, " ").trim();
    return (texto ? texto.trim() + " " : "") + instrucao;
  }
  function formatosHtml(idBox, textoAtual) {
    return '<div class="formatos-virais" id="' + idBox + '"><span class="formatos-label">Formato viral (toque pra usar):</span>' +
      FORMATOS_VIRAIS.map(function (f, i) {
        var on = String(textoAtual || "").indexOf(f.txt) >= 0;
        return '<button type="button" class="prompt-chip formato-chip' + (on ? ' on' : '') + '" data-formato="' + i + '" title="' + escapeHtml(f.txt) + '">' + escapeHtml(f.nome) + '</button>';
      }).join("") + '</div>';
  }

  var PROMPT_SUGGESTIONS = [
    "Foco em quem tá comprando o primeiro imóvel",
    "Tom mais descontraído, como se fosse pra um amigo",
    "Destaque o lado de investimento, não de moradia",
    "Foco em famílias com filhos pequenos",
    "Deixa mais direto, tipo dica rápida de 30 segundos"
  ];

  function subjectSpotlightHtml() {
    if (wizard.subjectMode === "topic") {
      var t = findTopic(wizard.topicId);
      if (!t) return "";
      var ideas = (t.ideias || []).map(function (pt) { return pt.titulo; });
      return '<div class="subject-spotlight"><div class="art">' + topicCoverSvg(t.categoria) + '</div><div>' +
        '<div class="cat">' + escapeHtml(t.categoria) + ' · sugestão da Vitrine</div>' +
        '<h4>' + escapeHtml(t.gancho) + '</h4>' +
        '<div class="spotlight-label">Ideias pra puxar no seu direcionamento:</div>' +
        '<ul class="spotlight-ideas">' + ideas.map(function (i) { return '<li>' + escapeHtml(i) + '</li>'; }).join("") + '</ul>' +
        '</div></div>';
    }
    if (wizard.subjectMode === "property") {
      var p = findProp(wizard.propertyId);
      if (!p) return "";
      return '<div class="subject-spotlight"><div class="art">' + propCoverSvg(p.tipo) + '</div><div>' +
        '<div class="cat">' + escapeHtml(p.bairro || "") + ' · ' + escapeHtml(p.cidade || "") + '</div>' +
        '<h4>' + escapeHtml(p.titulo) + '</h4>' +
        '<div class="spotlight-label">Diferenciais pra puxar no seu direcionamento:</div>' +
        '<ul class="spotlight-ideas">' + (p.diferenciais || []).map(function (d) { return '<li>' + escapeHtml(d) + '</li>'; }).join("") + '</ul>' +
        '</div></div>';
    }
    return '<div class="subject-spotlight"><div class="art">' + customCoverSvg() + '</div><div>' +
      '<div class="cat">' + escapeHtml(wizard.customCategoria || "Mercado") + ' · seu assunto</div>' +
      '<h4>' + escapeHtml(wizard.customTopic || "—") + '</h4>' +
      '<div class="spotlight-label">Dá pra complementar com tom, público-alvo ou um ângulo específico no direcionamento abaixo.</div>' +
      '</div></div>';
  }

  function promptBoxHtml() {
    return '<div style="margin-bottom:16px;">' +
      '<label style="display:block; font-size:12px; font-weight:600; color:var(--ink-muted); margin-bottom:8px;">Direcionamento pra IA (opcional) — o que você, corretor, quer destacar</label>' +
      '<div class="prompt-suggestions" id="prompt-suggestions">' + PROMPT_SUGGESTIONS.map(function (s) {
        var on = String(wizard.customPrompt || "").indexOf(s) >= 0;
        return '<button type="button" class="prompt-chip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-sugg="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>';
      }).join("") + '</div>' +
      formatosHtml("formatos-wizard", wizard.customPrompt) +
      '<textarea id="custom-prompt" rows="2" placeholder="Sem ideia? Clique numa sugestão acima, ou escreva a sua — ex: destaque a vista pro mar" ' +
      'style="width:100%; border:1px solid var(--border); border-radius:8px; background:var(--surface); color:var(--ink); font-family:inherit; font-size:13px; padding:8px 10px; resize:vertical;">' + escapeHtml(wizard.customPrompt) + '</textarea></div>';
  }
  // deixa marcado (sombreado) tudo que está escolhido no texto do direcionamento
  function marcarEscolhidos() {
    var t = String(wizard.customPrompt || "");
    qsa("#prompt-suggestions .prompt-chip").forEach(function (b) { var on = t.indexOf(b.dataset.sugg) >= 0; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    qsa("#formatos-wizard .formato-chip").forEach(function (b) { var on = t.indexOf(FORMATOS_VIRAIS[+b.dataset.formato].txt) >= 0; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  }
  function wirePromptBox() {
    document.getElementById("custom-prompt").addEventListener("input", function (e) { wizard.customPrompt = e.target.value; marcarEscolhidos(); });
    qsa("#formatos-wizard .formato-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        wizard.customPrompt = alternarFormato(document.getElementById("custom-prompt").value, FORMATOS_VIRAIS[+b.dataset.formato].txt);
        document.getElementById("custom-prompt").value = wizard.customPrompt;
        marcarEscolhidos();
      });
    });
    qsa("#prompt-suggestions .prompt-chip").forEach(function (b) {
      b.addEventListener("click", function () {   // toque marca/desmarca; dá pra escolher mais de uma
        wizard.customPrompt = alternarFormato(document.getElementById("custom-prompt").value, b.dataset.sugg);
        document.getElementById("custom-prompt").value = wizard.customPrompt;
        marcarEscolhidos();
      });
    });
    marcarEscolhidos();
  }

  function renderGenArea(errMsg) {
    var area = document.getElementById("gen-area");
    if (ehCalc() && wizard.slides) {   // slides gerados por conta (sem IA): só edição de texto
      area.innerHTML = '<div class="subject-spotlight"><div class="art">' + customCoverSvg() + '</div><div><div class="cat">🧮 Cálculo · sem IA</div><h4>' + escapeHtml(wizard.customTopic) + '</h4>' +
        '<div class="spotlight-label">Os números vêm da simulação. Pra mudar valores, volte ao passo 1.</div></div></div>' +
        '<p class="dica-destaque">Dica: palavras entre *asteriscos* no título saem em <span class="hl">destaque</span> no carrossel.</p><div class="slide-editor" id="slide-editor"></div>';
      var ed = document.getElementById("slide-editor");
      ed.innerHTML = wizard.slides.map(function (s, i) {
        return '<div class="slide-row"><div class="tagcol"><span class="slide-num">' + (i + 1) + '/' + wizard.slides.length + '</span><span class="slide-tagname">' + escapeHtml(s.tag) + '</span></div>' +
          '<div><input type="text" data-i="' + i + '" data-f="titulo" value="' + escapeHtml(s.titulo) + '"><textarea data-i="' + i + '" data-f="corpo">' + escapeHtml(s.corpo) + '</textarea></div></div>';
      }).join("");
      qsa("input,textarea", ed).forEach(function (el) { el.addEventListener("input", function () { wizard.slides[el.dataset.i][el.dataset.f] = el.value; }); });
      return;
    }
    if (!wizard.slides) {
      var fonteTxt = wizard.subjectMode === "property"
        ? "os dados do imóvel selecionado — endereço, valor, metragem e diferenciais"
        : wizard.subjectMode === "topic" ? "o assunto sugerido pela Vitrine" : "o assunto que você descreveu";
      area.innerHTML = subjectSpotlightHtml() + promptBoxHtml() +
        '<div class="gen-empty"><div class="wand">' + ICONS.wand + '</div>' +
        (errMsg ? '<p class="err">' + escapeHtml(errMsg) + '</p>' : '') +
        '<p>A IA vai usar ' + fonteTxt + ' — mais o seu direcionamento acima, se tiver — e escrever os slides do carrossel com texto real gerado por IA, mais imagem de capa.</p>' +
        '<button class="btn btn-primary" id="gen-btn">' + ICONS.wand + ' Gerar com IA</button></div>';
      wirePromptBox();
      document.getElementById("gen-btn").addEventListener("click", runGeneration);
      return;
    }
    var ganchosHtml = (wizard.ganchos && wizard.ganchos.length > 1)
      ? '<div class="gancho-box"><div class="fotos-titulo">Escolha o gancho da capa</div><div class="formato-chips">' +
        wizard.ganchos.map(function (g, i) {
          return '<button type="button" class="formato-chip' + (wizard.ganchoIdx === i ? " on" : "") + '" data-gancho="' + i + '">' + (i === 0 ? "Principal: " : "Opção " + (i + 1) + ": ") + escapeHtml(String(g).replace(/\*/g, "")) + '</button>';
        }).join("") + '</div></div>' : "";
    area.innerHTML = subjectSpotlightHtml() + promptBoxHtml() + ganchosHtml + '<p class="dica-destaque">Dica: palavras entre *asteriscos* no título saem em <span class="hl">amarelo</span> no carrossel.</p><div class="slide-editor" id="slide-editor"></div>' +
      '<button class="btn btn-ghost btn-sm" id="regen-btn">' + ICONS.wand + ' Gerar novamente com esse direcionamento</button>';
    wirePromptBox();
    qsa("[data-gancho]", area).forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.dataset.gancho;
        wizard.ganchoIdx = i; wizard.slides[0].titulo = wizard.ganchos[i];
        renderGenArea();
      });
    });
    var editor = document.getElementById("slide-editor");
    editor.innerHTML = wizard.slides.map(function (s, i) {
      return '<div class="slide-row">' +
        '<div class="tagcol"><span class="slide-num">' + (i + 1) + '/' + wizard.slides.length + '</span><span class="slide-tagname">' + escapeHtml(s.tag) + '</span></div>' +
        '<div><input type="text" data-i="' + i + '" data-f="titulo" value="' + escapeHtml(s.titulo) + '">' +
        '<textarea data-i="' + i + '" data-f="corpo">' + escapeHtml(s.corpo) + '</textarea></div></div>';
    }).join("");
    qsa("input,textarea", editor).forEach(function (el) {
      el.addEventListener("input", function () { wizard.slides[el.dataset.i][el.dataset.f] = el.value; });
    });
    document.getElementById("regen-btn").addEventListener("click", function () { wizard.slides = null; runGeneration(); });
  }

  async function runGeneration() {
    var area = document.getElementById("gen-area");
    var promptEl = document.getElementById("custom-prompt");
    if (promptEl) wizard.customPrompt = promptEl.value;
    area.innerHTML = subjectSpotlightHtml() + promptBoxHtml() +
      '<div class="gen-empty"><div class="wand"><div class="spin" style="border-top-color:var(--accent); border-color:rgba(139,92,255,0.25);"></div></div>' +
      '<p>Gerando texto com IA (Claude)' + (wizard.customPrompt ? " a partir do seu direcionamento" : "") + '…</p></div>';
    try {
      var origem = wizard.subjectMode === "property" ? "imovel" : wizard.subjectMode === "topic" ? "topico" : "custom";
      var dados;
      if (origem === "imovel") { dados = Object.assign({}, findProp(wizard.propertyId)); delete dados.fotos; }
      else if (origem === "topico") dados = findTopic(wizard.topicId);
      else dados = { assunto: wizard.customTopic.trim(), categoria: wizard.customCategoria };

      var resp = await callFunction("gerar-conteudo", { origem: origem, dados: dados, direcionamento: wizard.customPrompt || undefined });
      wizard.slides = resp.slides || [];
      if (!wizard.slides.length) throw new Error("A IA não retornou slides. Tente gerar de novo.");
      // teste de ganchos: capa principal + alternativas (se a IA não mandar, não mostra nada)
      var alts = (resp.capas_alternativas || []).filter(function (x) { return typeof x === "string" && x.trim(); }).slice(0, 2);
      wizard.ganchos = alts.length ? [wizard.slides[0].titulo].concat(alts) : null;
      wizard.ganchoIdx = 0;
      area.querySelector(".gen-empty p").textContent = "Texto pronto. Buscando fotos reais em alta resolução pra cada slide…";
      // imóvel com fotos próprias: usa as fotos do corretor nos slides (na ordem), o resto vem do banco de fotos
      if (origem === "imovel") {
        var fotosImovel = fotosDe(findProp(wizard.propertyId));
        wizard.slides.forEach(function (sl, i) { if (fotosImovel[i]) aplicarFoto(sl, { url: fotosImovel[i], credito: "Foto do imóvel", link: "" }); });
      }
      try { await garantirFotosReais(wizard.slides, wizardContexto(), false, wizard.fotosData); }
      catch (e) { toast("Fotos não encontradas agora (" + e.message + ") — dá pra tentar de novo na prévia."); }
      renderGenArea();
    } catch (err) {
      renderGenArea(err.message || "Erro ao gerar conteúdo. Tente de novo.");
    }
  }

  /* Modelos que dependem do formato do texto: só fazem sentido quando o texto gerado tem aquela estrutura. */
  var TPL_ESTRUTURA = {
    "isso-ou-aquilo": { formato: "⚖️ Isso ou aquilo", dica: "títulos no formato \"X ou Y?\"" },
    "mito-verdade": { formato: "🧐 Mito x verdade", dica: "título = mito e texto = verdade" },
    "antes-depois": { formato: "🆚 Antes x depois", dica: "texto de antes e depois e pelo menos 2 fotos" },
    "ficha-imovel": { formato: null, dica: "carrossel criado a partir de um imóvel cadastrado" }
  };
  function textoCombina(slug) {
    var sl = wizard.slides || [], meio = sl.slice(1, -1), dir = String(wizard.customPrompt || "");
    var todo = sl.map(function (s) { return (s.tag || "") + " " + semMarcas(s.titulo) + " " + (s.corpo || ""); }).join(" ");
    var fotos = sl.filter(function (s) { return slideImageUrl(s); }).length;
    if (slug === "ficha-imovel") return wizard.subjectMode === "property" && !!findProp(wizard.propertyId);
    if (slug === "isso-ou-aquilo") return meio.filter(function (s) { return /\S\s+ou\s+\S/i.test(semMarcas(s.titulo)); }).length >= Math.max(1, Math.ceil(meio.length / 2));
    if (slug === "mito-verdade") return meio.length >= 2 && (dir.indexOf("mito x verdade") >= 0 || /\bmitos?\b/i.test(todo));
    if (slug === "antes-depois") return fotos >= 2 && (dir.indexOf("antes e depois") >= 0 || /\breforma|\bvirou\b|\btransforma|\bantes e depois\b/i.test(todo));
    return true;
  }
  function renderTplStep() {
    var visiveis = state.templates.filter(tplVisivel);
    var combinam = visiveis.filter(function (t) { return TPL_ESTRUTURA[t.slug] && textoCombina(t.slug); });
    var ordem = combinam.concat(visiveis.filter(function (t) { return combinam.indexOf(t) < 0; }));
    if (TPL_ESTRUTURA[wizard.templateSlug] && !textoCombina(wizard.templateSlug)) wizard.templateSlug = "minimalista";   // modelo que não combina não fica escolhido
    var sug = combinam.length ? '<div class="tpl-sugestao">💡 <b>Sugestão:</b> o texto gerado combina com o modelo <b>' + escapeHtml(combinam[0].nome) + '</b>' +
      (wizard.templateSlug !== combinam[0].slug ? ' <button type="button" class="btn btn-primary btn-sm" data-usar-tpl="' + combinam[0].slug + '">Usar</button>' : ' ✓') + '</div>' : "";
    document.getElementById("tpl-grid").innerHTML = sug + ordem.map(function (t) {
      var est = TPL_ESTRUTURA[t.slug], ok = !est || textoCombina(t.slug);
      return '<div class="tpl-card ' + (wizard.templateSlug === t.slug ? "selected" : "") + (ok ? "" : " tpl-off") + '" data-tpl="' + t.slug + '"' + (ok ? "" : ' aria-disabled="true"') + '>' +
        (est && ok ? '<span class="tpl-combina">Combina com o texto</span>' : "") +
        '<div class="tpl-swatch tpl-' + t.slug + '"><span>Aa</span></div>' +
        '<h4>' + escapeHtml(t.nome) + (TPL_BETA.indexOf(t.slug) >= 0 ? ' <small style="color:var(--ink-faint);font-weight:600;">(teste)</small>' : '') + '</h4><p>' +
        (ok ? escapeHtml(t.descricao || "") : 'Precisa de ' + escapeHtml(est.dica) + '.' + (est.formato ? ' No passo 2, marque o formato <b>' + escapeHtml(est.formato) + '</b> e gere de novo.' : '')) + '</p></div>';
    }).join("");
    qsa("[data-tpl]").forEach(function (el) {
      el.addEventListener("click", function () {
        var est = TPL_ESTRUTURA[el.dataset.tpl];
        if (est && !textoCombina(el.dataset.tpl)) { toast("Esse modelo não combina com o texto gerado. Precisa de " + est.dica + "."); return; }
        wizard.templateSlug = el.dataset.tpl; renderTplStep();
      });
    });
    qsa("[data-usar-tpl]").forEach(function (b) { b.addEventListener("click", function (e) { e.stopPropagation(); wizard.templateSlug = b.dataset.usarTpl; renderTplStep(); }); });
    var strip = document.getElementById("preview-strip");
    strip.innerHTML = slideStrip(wizard.slides || [], wizard.templateSlug, false, wizardArt(), wizard.fonte, wizard.melhorar);
    var fbox = document.getElementById("wiz-fontes");
    if (!fbox) { fbox = document.createElement("div"); fbox.id = "wiz-fontes"; strip.insertAdjacentElement("beforebegin", fbox); }
    fbox.innerHTML = fontPickerHtml(wizard.fonte);
    qsa("[data-fonte]", fbox).forEach(function (b) { b.onclick = function () { wizard.fonte = comCor(b.dataset.fonte, corDe(wizard.fonte)); renderTplStep(); }; });
    qsa("[data-cor]", fbox).forEach(function (b) { b.onclick = function () { wizard.fonte = comCor(wizard.fonte, b.dataset.cor); renderTplStep(); }; });
    var box = document.getElementById("wiz-fotos");
    if (!box) { box = document.createElement("div"); box.id = "wiz-fotos"; strip.insertAdjacentElement("afterend", box); }
    if (wizard.slides && wizard.slides.length) {
      box.innerHTML = '<div class="fotos-titulo">Fotos dos slides — troque as que quiser</div>' + melhorarToggleHtml(wizard.melhorar) + fotoControlsHtml(wizard.slides);
      wireFotoControls(box, wizard.slides, wizardContexto(), false, renderTplStep);
      var wt = qs("[data-melhorar]", box);
      if (wt) wt.onchange = function () { wizard.melhorar = wt.checked; renderTplStep(); };
    } else box.innerHTML = "";
  }

  function renderDestStep() {
    var dests = [
      { id: "rascunho", nome: "Salvar rascunho", desc: "Continue editando depois" },
      { id: "agendado", nome: "Agendar", desc: "Escolha data e horário" },
      { id: "musica", nome: "📲 Postar no Instagram", desc: "Abre o app do Instagram com tudo pronto — dá pra pôr música" }
    ];
    document.getElementById("dest-grid").innerHTML = dests.map(function (d) {
      return '<div class="dest-card ' + (wizard.dest === d.id ? "selected" : "") + '" data-dest="' + d.id + '"><h4>' + d.nome + '</h4><p>' + d.desc + '</p></div>';
    }).join("");
    qsa("[data-dest]").forEach(function (el) {
      el.addEventListener("click", function () { wizard.dest = el.dataset.dest; renderDestStep(); });
    });
    var vb = document.getElementById("wiz-ver-previa");
    if (!vb) {
      vb = document.createElement("button"); vb.type = "button"; vb.id = "wiz-ver-previa"; vb.className = "btn btn-ghost wiz-ver-previa";
      vb.innerHTML = "👁 Ver como fica no Instagram";
      document.getElementById("dest-grid").insertAdjacentElement("afterend", vb);
      vb.onclick = function () { verPreviaDoWizard(); };
    }
    document.getElementById("schedule-box").hidden = wizard.dest !== "agendado";
    if (wizard.dest === "agendado") renderCalendario();
    var igOn = state.igConta && state.igConta.status === "ativo";
    document.getElementById("ig-warn").hidden = !(wizard.dest === "agendado" && !igOn);
    var boxContas = document.getElementById("sched-contas");
    if (boxContas) {
      if (wizard.dest !== "agendado") boxContas.innerHTML = "";
      else if (!boxContas.innerHTML) boxContas.innerHTML = escolhaContasHtml([]);   // não redesenha: mantém a conta marcada
    }
  }

  /* ---------- calendário de agendamento (dia + hora) ---------- */
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DIAS_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  var HORARIOS_TOP = ["12:00", "18:00", "19:00", "20:00"];   // picos de engajamento no Instagram
  var cal = null;
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function renderCalendario() {
    var inD = document.getElementById("sched-date"), inT = document.getElementById("sched-time");
    var agora = new Date();
    if (!inD.value) { var d0 = addDays(1); inD.value = ymd(d0); }
    if (!inT.value) inT.value = "18:00";
    var sel = new Date(inD.value + "T00:00:00");
    if (!cal) cal = { ano: sel.getFullYear(), mes: sel.getMonth() };
    var primeiro = new Date(cal.ano, cal.mes, 1), diasNoMes = new Date(cal.ano, cal.mes + 1, 0).getDate();
    var hojeStr = ymd(agora), limite = addDays(90);
    var podeVoltar = cal.ano > agora.getFullYear() || cal.mes > agora.getMonth();
    var podeAvancar = new Date(cal.ano, cal.mes + 1, 1) <= limite;
    var dias = "";
    for (var v = 0; v < primeiro.getDay(); v++) dias += '<button type="button" class="cal-day vazio" disabled></button>';
    for (var dia = 1; dia <= diasNoMes; dia++) {
      var dt = new Date(cal.ano, cal.mes, dia), str = ymd(dt);
      var passado = str < hojeStr || dt > limite;
      dias += '<button type="button" class="cal-day' + (str === hojeStr ? " hoje" : "") + (str === inD.value ? " on" : "") + '" data-dia="' + str + '"' + (passado ? " disabled" : "") + ">" + dia + "</button>";
    }
    var slots = "";
    for (var h = 7; h <= 22; h++) {
      ["00", "30"].forEach(function (m) {
        var t = pad2(h) + ":" + m;
        var passouHoje = inD.value === hojeStr && new Date(inD.value + "T" + t) <= new Date(agora.getTime() + 10 * 60000);
        slots += '<button type="button" class="cal-slot' + (HORARIOS_TOP.indexOf(t) >= 0 ? " top" : "") + (t === inT.value ? " on" : "") + '" data-hora="' + t + '"' + (passouHoje ? " disabled" : "") + ">" + t + "</button>";
      });
    }
    var quando = new Date(inD.value + "T" + inT.value);
    var resumo = DIAS_SEM[quando.getDay()] + ", " + quando.getDate() + " de " + MESES[quando.getMonth()] + " às " + inT.value;
    document.getElementById("sched-cal").innerHTML =
      '<div><div class="cal-head"><button type="button" class="cal-nav" id="cal-prev"' + (podeVoltar ? "" : " disabled") + ' aria-label="Mês anterior">‹</button>' +
      "<b>" + MESES[cal.mes] + " " + cal.ano + '</b><button type="button" class="cal-nav" id="cal-next"' + (podeAvancar ? "" : " disabled") + ' aria-label="Próximo mês">›</button></div>' +
      '<div class="cal-grid">' + DIAS_SEM.map(function (d) { return '<div class="cal-dow">' + d + "</div>"; }).join("") + dias + "</div></div>" +
      '<div class="cal-times"><h4>Horário</h4><div class="cal-slots">' + slots + '</div><div class="cal-legenda"><i></i> horários de mais engajamento</div></div>' +
      '<div class="cal-resumo">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>' +
      "<span>Agendado para <b>" + resumo + "</b></span></div>";
    var box = document.getElementById("sched-cal");
    qsa("[data-dia]", box).forEach(function (b) { b.onclick = function () {
      inD.value = b.dataset.dia;
      // se escolheu hoje e o horário já passou, pula pro próximo horário livre
      if (inD.value === hojeStr && new Date(inD.value + "T" + inT.value) <= agora) {
        var prox = new Date(agora.getTime() + 40 * 60000); inT.value = pad2(prox.getHours()) + ":" + (prox.getMinutes() < 30 ? "30" : "00");
        if (prox.getMinutes() >= 30) inT.value = pad2(Math.min(22, prox.getHours() + 1)) + ":00";
      }
      renderCalendario(); }; });
    qsa("[data-hora]", box).forEach(function (b) { b.onclick = function () { inT.value = b.dataset.hora; renderCalendario(); }; });
    document.getElementById("cal-prev").onclick = function () { cal.mes--; if (cal.mes < 0) { cal.mes = 11; cal.ano--; } renderCalendario(); };
    document.getElementById("cal-next").onclick = function () { cal.mes++; if (cal.mes > 11) { cal.mes = 0; cal.ano++; } renderCalendario(); };
  }

  async function onWizNext() {
    if (wizard.step === 1) {
      if (ehCalc()) {
        if (!(await gerarSlidesCalculo())) return;
        var bt = document.getElementById("wiz-next"), tx = bt.textContent; bt.disabled = true; bt.textContent = "Buscando fotos…";
        try { await garantirFotosReais(wizard.slides, wizardContexto(), false, wizard.fotosData); } catch (e) { toast("Fotos não encontradas agora — dá pra trocar no passo de estilo."); }
        bt.disabled = false; bt.textContent = tx;
        wizard.step = 2; renderWizard(); return;
      }
      if (wizard.subjectMode === "topic" && !wizard.topicId) { toast("Escolha um assunto sugerido."); return; }
      if (wizard.subjectMode === "property" && !wizard.propertyId) { toast("Escolha um imóvel para continuar."); return; }
      if (wizard.subjectMode === "custom" && !wizard.customTopic.trim()) { toast("Escreva sobre o que é o carrossel."); return; }
      wizard.step = 2; renderWizard(); return;
    }
    if (wizard.step === 2) {
      if (!wizard.slides) { toast("Gere o conteúdo com IA para continuar."); return; }
      wizard.step = 3; renderWizard(); return;
    }
    if (wizard.step === 3) { wizard.step = 4; renderWizard(); return; }
    if (wizard.step === 4) { await confirmCarousel(); }
  }

  // prévia do carrossel ainda não salvo (passo 4): monta um carrossel temporário com o que está no assistente
  async function verPreviaDoWizard() {
    if (!wizard.slides || !wizard.slides.length) { toast("Gere o conteúdo primeiro."); return; }
    var origem = wizard.subjectMode === "property" ? "imovel" : wizard.subjectMode === "topic" ? "topico" : "custom";
    var tpl = findTemplateBySlug(wizard.templateSlug);
    var temp = {
      _temp: true, origem: origem, template_id: tpl ? tpl.id : null, fonte: comCor(wizard.fonte, corDe(wizard.fonte)),
      propriedade_id: wizard.propertyId, topico_id: wizard.topicId,
      assunto_custom: wizard.customTopic, categoria: wizard.customCategoria, melhorar_fotos: wizard.melhorar !== false,
      slides: wizard.slides
    };
    await abrirPrevia(temp, "ver");
  }

  async function confirmCarousel() {
    var btn = document.getElementById("wiz-next");
    var origem = wizard.subjectMode === "property" ? "imovel" : wizard.subjectMode === "topic" ? "topico" : "custom";
    var tpl = findTemplateBySlug(wizard.templateSlug);
    // aviso de tema repetido (não bloqueia); não repete se já foi avisado no tema livre
    var temaTxt = origem === "custom" ? wizard.customTopic.trim() : origem === "topico" ? ((findTopic(wizard.topicId) || {}).gancho || "") : "";
    if (origem !== "imovel" && wizard.temaAvisado !== temaTxt) {
      if (!(await avisarTemaRepetido(temaTxt, origem === "topico" ? wizard.topicId : null))) return;
      wizard.temaAvisado = temaTxt;
    }
    var payload = {
      corretor_id: state.profile.id,
      origem: origem,
      template_id: tpl ? tpl.id : null,
      fonte: comCor(wizard.fonte, corDe(wizard.fonte)),
      melhorar_fotos: wizard.melhorar !== false,
      direcionamento: wizard.customPrompt || null,
      gancho_idx: wizard.ganchos ? wizard.ganchoIdx : null,
      status: wizard.dest,
      propriedade_id: origem === "imovel" ? wizard.propertyId : null,
      topico_id: origem === "topico" ? wizard.topicId : null,
      assunto_custom: origem === "custom" ? wizard.customTopic.trim() : null,
      categoria: origem === "custom" ? wizard.customCategoria : null
    };

    if (wizard.dest === "agendado") {
      var date = document.getElementById("sched-date").value, time = document.getElementById("sched-time").value || "09:00";
      if (!date) { toast("Escolha a data da publicação."); return; }
      if (new Date(date + "T" + time) <= new Date()) { toast("Esse horário já passou — escolha outro no calendário."); return; }
      payload.data_agendada = new Date(date + "T" + time).toISOString();
      payload.instagram_contas_ids = lerContasMarcadas(document.getElementById("sched-contas"));
      if (contasAtivas().length > 1 && !payload.instagram_contas_ids.length) { toast("Marque pelo menos um Instagram."); return; }
      if (wizard.slides.length < 2 || wizard.slides.length > 10) { toast("Pra publicar no feed o carrossel precisa ter de 2 a 10 slides."); return; }
      if (testeSemPublicacoes()) { avisoFimDoTeste(); return; }
    }
    // "com música": a API do Instagram não coloca música, então salva como rascunho e abre o app do Instagram
    var comMusica = wizard.dest === "musica";
    if (comMusica) {
      if (testeSemPublicacoes()) { avisoFimDoTeste(); return; }
      payload.status = "rascunho";
    }

    btn.disabled = true; var orig = btn.textContent; btn.textContent = "Salvando…";
    try {
      var rows = await DB.insert("carrosseis", payload);
      var carrossel = rows[0];
      // PostgREST exige que todo objeto do array tenha exatamente as mesmas chaves num insert em lote —
      // por isso imagem_url/imagem_prompt vão em todas as linhas (null exceto na capa), nunca só condicionalmente.
      var slideRows = wizard.slides.map(function (s, i) {
        return {
          carrossel_id: carrossel.id, ordem: i, tag: s.tag, titulo: s.titulo, corpo: s.corpo,
          // foto real (Pexels) de fundo em todo slide; imagem_prompt guarda o crédito do fotógrafo
          imagem_url: isFotoReal(s.imagem_url) ? s.imagem_url : null,
          imagem_prompt: isFotoReal(s.imagem_url) ? (s.imagem_prompt || null) : null
        };
      });
      var savedSlides = await DB.insert("slides", slideRows);
      carrossel.slides = savedSlides.sort(function (a, b) { return a.ordem - b.ordem; });
      state.carrosseis.unshift(carrossel);

      // O crédito do teste grátis é debitado pelo banco no momento em que o carrossel é salvo
      // (gatilho carrosseis_debitar_teste) — "Gerar novamente" não gasta crédito. O cliente não escreve
      // em trial_usado, só busca o valor atualizado pra refletir na tela.
      if (state.assinatura && state.assinatura.status === "trial") {
        try {
          var freshProfile = await DB.select("profiles", "select=trial_usado,trial_limite&id=eq." + state.profile.id);
          if (freshProfile && freshProfile[0]) {
            state.profile.trial_usado = freshProfile[0].trial_usado;
            state.profile.trial_limite = freshProfile[0].trial_limite;
          }
        } catch (e) { /* não bloqueia o salvamento do carrossel por causa disso */ }
      }
      updateNavPlanBadge();
      if (comMusica) {
        resetWizard(); showScreen("painel");
        postarComMusica(carrossel);
        return;
      }
      if (wizard.dest === "agendado") {
        // gera e sobe agora as imagens do feed: na hora marcada o servidor publica sozinho, mesmo com o app fechado
        try {
          await prepararAgendado(carrossel, function (n, t) { btn.textContent = "Preparando imagens " + n + "/" + t + "…"; });
        } catch (e) {
          toast("Agendado, mas as imagens não foram preparadas (" + e.message + "). Abra o app antes do horário que eu tento de novo.");
        }
      }
      if (wizard.dest === "rascunho") toast("Rascunho salvo.");
      else if (wizard.dest === "agendado" && carrossel.status === "aguardando_aprovacao") toast("Enviado para aprovação do gestor. Depois de aprovado, ele é agendado para " + fmtDateTime(payload.data_agendada) + ".");
      else if (wizard.dest === "agendado") toast("Agendado para " + fmtDateTime(payload.data_agendada) + (state.igConta && state.igConta.status === "ativo" ? " — vai ser publicado sozinho no Instagram." : ". Conecte o Instagram (aba Instagram) até lá pra publicar sozinho."));

      resetWizard(); showScreen("painel");
    } catch (err) {
      if (/teste grátis/i.test(err.message || "")) { toast(err.message); showScreen("plano"); }
      else toast("Erro ao salvar carrossel: " + err.message);
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }

  /* ============================================================
     INSTAGRAM
  ============================================================ */
  function applyReplyTemplate(tpl, nome) { return (tpl || "").replace(/\{\{\s*nome\s*\}\}/gi, nome); }

  function renderAutoReply() {
    var cfg = state.autoReply || { ativo: true, template: "" };
    var toggleBtn = document.getElementById("autoreply-toggle");
    toggleBtn.textContent = cfg.ativo ? "Ativado · clique pra desligar" : "Desativado · clique pra ligar";
    toggleBtn.className = "btn btn-sm " + (cfg.ativo ? "btn-2" : "btn-ghost");
    toggleBtn.onclick = async function () {
      cfg.ativo = !cfg.ativo;
      try {
        await DB.upsert("autoreply_config", { corretor_id: state.profile.id, ativo: cfg.ativo, template: cfg.template, palavra_gatilho: cfg.palavra_gatilho || "QUERO" }, "corretor_id");
        state.autoReply = cfg; renderAutoReply();
        toast(cfg.ativo ? "Respostas automáticas ativadas." : "Respostas automáticas desativadas.");
      } catch (err) { toast("Erro: " + err.message); }
    };

    var card = document.getElementById("autoreply-card");
    card.style.opacity = cfg.ativo ? "1" : "0.55";
    var ta = document.getElementById("autoreply-template");
    ta.value = cfg.template || "";
    ta.disabled = !cfg.ativo;
    var saveTimer;
    ta.oninput = function () {
      cfg.template = ta.value;
      renderAutoReplyPreview();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async function () {
        try {
          await DB.upsert("autoreply_config", { corretor_id: state.profile.id, ativo: cfg.ativo, template: cfg.template, palavra_gatilho: cfg.palavra_gatilho || "QUERO" }, "corretor_id");
          state.autoReply = cfg;
        } catch (err) { toast("Erro ao salvar: " + err.message); }
      }, 700);
    };

    renderAutoReplyPreview();
  }

  function renderAutoReplyPreview() {
    var cfg = state.autoReply || { template: "" };
    var examples = [
      { nome: "Camila", comentario: "QUERO! Me manda mais informações 🙌" },
      { nome: "Rafael", comentario: "QUERO SABER MAIS" }
    ];
    document.getElementById("autoreply-preview").innerHTML = examples.map(function (ex) {
      var reply = applyReplyTemplate(cfg.template, ex.nome) || "—";
      return '<div class="areply-pair">' +
        '<div class="areply-ex">' +
        '<div class="who">' + escapeHtml(ex.nome.slice(0, 2).toUpperCase()) + '</div>' +
        '<div class="bubble"><b>' + escapeHtml(ex.nome) + ':</b> ' + escapeHtml(ex.comentario) + '</div>' +
        '</div>' +
        '<div class="reply"><div class="who">V</div><div class="bubble">' + escapeHtml(reply) + '</div></div>' +
        '</div>';
    }).join("");
  }

  function renderInstagram() {
    atualizarPillIg();
    var ativas = contasAtivas(), limite = limiteContasIg();
    var linhas = ativas.map(function (ct, i) {
      var sel = i === 0;
      return '<div class="ig-linha' + (sel ? ' ig-selecionada' : ' ig-escolher" data-ig-row="' + ct.id + '" title="Clique para postar nesta conta') + '"><div class="l"><div class="ig-icon">' + ICONS.ig + '</div><div><div style="font-weight:700;">@' + escapeHtml(ct.username) +
        '</div>' +
        '<div style="font-size:12px;color:var(--status-pub-fg);font-weight:600;">Conectado' + (ct.token_expires_at ? ' · acesso válido até ' + fmtDate(ct.token_expires_at) : '') + '</div></div></div>' +
        '<div class="ig-acoes">' +
        '<button class="btn btn-ghost btn-sm" data-ig-desc="' + ct.id + '">Desconectar</button></div></div>';
    }).join("");
    var podeMais = ativas.length < limite;
    document.getElementById("ig-connect").innerHTML = (ativas.length ? linhas :
      '<div class="ig-linha"><div class="l"><div class="ig-icon">' + ICONS.ig + '</div><div><div style="font-weight:700;">Nenhuma conta conectada</div>' +
        '<div style="font-size:12px;color:var(--ink-muted);">Conecte sua conta Profissional do Instagram para os posts agendados saírem sozinhos na hora marcada</div></div></div></div>') +
      '<div class="ig-linha ig-rodape"><div style="font-size:12.5px;color:var(--ink-muted);">' + ativas.length + ' de ' + limite + (limite === 1 ? ' conta' : ' contas') + ' do seu plano' +
        (!podeMais && ativas.length ? ' — para conectar outra, desconecte uma' + (limite === 1 ? ' ou mude de plano' : '') + '.' : '') + '</div>' +
        '<button class="btn ' + (ativas.length ? 'btn-ghost' : 'btn-primary') + ' btn-sm" id="ig-toggle"' + (podeMais ? '' : ' disabled') + '>' + (ativas.length ? 'Conectar outro Instagram' : 'Conectar Instagram') + '</button></div>' +
      (emTeste() && ativas.length ? '<div style="flex-basis:100%;font-size:12.5px;color:var(--ink-muted);margin-top:10px;">Teste grátis: você pode agendar até ' + limitePublicacoesTeste() + ' carrosséis (' + Math.max(limitePublicacoesTeste() - publicadosNoInstagram(), 0) + ' restante' + (limitePublicacoesTeste() - publicadosNoInstagram() === 1 ? "" : "s") + '). As imagens e a legenda levam o link da Vitrine.</div>' : "");
    var trocando = false;
    async function selecionarConta(id, linha) {
      if (trocando) return;
      trocando = true;
      if (linha) linha.classList.add("ig-trocando");
      try {
        await rpc("definir_instagram_principal", { p_conta: id });
        state.igContas = ordenarContas(contasAtivas().map(function (x) { x.principal = x.id === id; return x; }));
        state.igConta = state.igContas[0] || null;
        renderInstagram();
        toast("Pronto! @" + state.igConta.username + " agora vem marcada nos próximos agendamentos.");
      } catch (err) { toast("Erro ao trocar a conta: " + err.message); if (linha) linha.classList.remove("ig-trocando"); }
      finally { trocando = false; }
    }
    // clicar em qualquer parte da linha (ou no botão) seleciona a conta; "Desconectar" continua separado
    qsa("[data-ig-row]").forEach(function (linha) {
      linha.addEventListener("click", function (ev) {
        if (ev.target.closest("[data-ig-desc]")) return;
        selecionarConta(linha.dataset.igRow, linha);
      });
    });
    qsa("[data-ig-desc]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!confirm("Desconectar essa conta do Instagram?")) return;
        try {
          await callFunction("instagram-oauth-callback", { acao: "desconectar", conta_id: b.dataset.igDesc });
          state.igContas = contasAtivas().filter(function (x) { return x.id !== b.dataset.igDesc; });
          state.igConta = state.igContas[0] || null;
          atualizarPillIg();
          renderInstagram();
          toast("Conta desconectada.");
        } catch (err) { toast("Erro: " + err.message); }
      });
    });
    var tg = document.getElementById("ig-toggle");
    if (tg) tg.addEventListener("click", async function () {
      try {
        // abre o login do Instagram; ele volta pra Edge Function, que salva o token e redireciona pra cá
        var resp = await callFunction("instagram-oauth-callback", { acao: "iniciar" });
        irPara(resp.url, ["www.instagram.com", "api.instagram.com", "instagram.com"]);
      } catch (err) { toast("Erro: " + err.message); }
    });

    renderAutoReply();

    var sched = state.carrosseis.filter(function (c) { return c.status === "agendado"; }).sort(ordemRecente);
    var pub = state.carrosseis.filter(function (c) { return c.status === "publicado"; }).sort(ordemRecente);

    document.getElementById("queue-scheduled").innerHTML = sched.length ? sched.map(qitemHtml.bind(null, "Publica em")).join("")
      : '<div class="empty-col">Nada agendado no momento.</div>';
    document.getElementById("queue-published").innerHTML = pub.length ? pub.map(qitemHtml.bind(null, "Publicado em")).join("")
      : '<div class="empty-col">Nenhuma publicação ainda.</div>';

    function qitemHtml(label, c) {
      var meta = getSubjectMeta(c);
      var tpl = findTemplateById(c.template_id);
      var slide0 = (c.slides && c.slides[0]) || { tag: "", titulo: meta.titulo, corpo: "" };
      var when = label === "Publica em" ? fmtDateTime(c.data_agendada) : fmtDate(c.data_publicada);
      return '<div class="qitem"><div class="thumb">' + (ehReels(c) ? thumbReels(c) : slideTile(slide0, tpl && tpl.slug, true, 1, 1, null, c.fonte)) + '</div>' +
        '<div class="body"><h4>' + (ehReels(c) ? '<span class="tag-reels">▶ Reels</span> ' : '') + escapeHtml(meta.titulo) + '</h4><div class="when">' + label + ' ' + when +
        (destinosDoCarrossel(c).length ? ' · ' + escapeHtml(destinosDoCarrossel(c).join(", ")) : '') + '</div></div></div>';
    }
  }

  /* ============================================================
     PLANO / PAGAMENTO
  ============================================================ */
  var planPeriod = "mensal", planPending = null, payMethod = "cartao";

  function updateNavPlanBadge() {
    var badge = document.getElementById("nav-plan-count");
    if (!state.assinatura) { badge.hidden = true; return; }
    if (state.assinatura.status === "trial") {
      badge.hidden = false;
      badge.textContent = Math.max((state.profile.trial_limite || 0) - (state.profile.trial_usado || 0), 0) + "/" + (state.profile.trial_limite || 0);
    } else {
      badge.hidden = false;
      var plano = findPlano(state.assinatura.plano_id);
      badge.textContent = (plano ? plano.nome : "PRO").toUpperCase();
    }
  }

  /* ---------- Minha marca (kit da marca): logo, cor, nome e CRECI ---------- */
  // serviço pago de logo feito por designer (pedido vai direto pro WhatsApp do dono da Vitrine)
  var PRECO_LOGO_PRO = "99,90";
  var WHATS_LOGO_PRO = "5585981665189";

  // criador de logo grátis: tudo no navegador (canvas), sem IA e sem custo
  function desenharLogo(estilo, nome, sub, cor) {
    var S = 600, cv = document.createElement("canvas"); cv.width = S; cv.height = S;
    var c = cv.getContext("2d"), fam = "Geist, Manrope, Arial, sans-serif";
    var partes = nome.trim().split(/\s+/).filter(Boolean);
    var ini = ((partes[0] || "V")[0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
    var lum = (0.299 * parseInt(cor.slice(1, 3), 16) + 0.587 * parseInt(cor.slice(3, 5), 16) + 0.114 * parseInt(cor.slice(5, 7), 16)) / 255;
    var tinta = lum > 0.6 ? "#0A0A0A" : "#FFFFFF";
    function caber(txt, peso, max, larg) { var t = max; do { c.font = peso + " " + t + "px " + fam; t -= 2; } while (c.measureText(txt).width > larg && t > 12); }
    function telhado(x, y, w, h, esp) { c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w / 2, y); c.lineTo(x + w, y + h); c.lineWidth = esp; c.lineJoin = "round"; c.lineCap = "round"; c.stroke(); }
    c.textAlign = "center"; c.textBaseline = "middle";
    if (estilo === 0) {        // círculo com iniciais
      c.fillStyle = cor; c.beginPath(); c.arc(S / 2, 230, 170, 0, Math.PI * 2); c.fill();
      c.fillStyle = tinta; caber(ini, "800", 170, 260); c.fillText(ini, S / 2, 236);
      c.fillStyle = cor; caber(nome.toUpperCase(), "700", 46, 540); c.fillText(nome.toUpperCase(), S / 2, 470);
      c.globalAlpha = .8; caber(sub.toUpperCase(), "500", 26, 520); c.fillText(sub.toUpperCase(), S / 2, 525);
    } else if (estilo === 1) { // casa com iniciais
      c.strokeStyle = cor; c.fillStyle = cor; telhado(140, 60, 320, 140, 26);
      c.fillRect(185, 195, 230, 190); c.fillStyle = tinta; caber(ini, "800", 120, 190); c.fillText(ini, S / 2, 292);
      c.fillStyle = cor; caber(nome, "700", 50, 540); c.fillText(nome, S / 2, 460);
      c.globalAlpha = .8; caber(sub, "500", 28, 520); c.fillText(sub, S / 2, 515);
    } else if (estilo === 2) { // telhado sobre o nome
      c.strokeStyle = cor; telhado(200, 120, 200, 90, 18);
      c.fillStyle = cor; caber(nome, "800", 76, 540); c.fillText(nome, S / 2, 290);
      c.fillRect(150, 350, 300, 6);
      c.globalAlpha = .85; caber(sub.toUpperCase(), "600", 30, 520); c.fillText(sub.toUpperCase(), S / 2, 405);
    } else {                   // selo quadrado
      c.fillStyle = cor; var r = 60, x = 60, y = 60, w = 480, h = 480;
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.fill();
      c.strokeStyle = tinta; c.fillStyle = tinta; telhado(220, 120, 160, 70, 14);
      caber(nome, "800", 64, 400); c.fillText(nome, S / 2, 300);
      c.globalAlpha = .85; caber(sub.toUpperCase(), "600", 26, 400); c.fillText(sub.toUpperCase(), S / 2, 380);
    }
    return cv;
  }
  function abrirCriadorLogo(p, corIni, aoSalvar) {
    var nomeIni = (equipeInfo && equipeInfo.papel === "dono" && equipeInfo.equipe && equipeInfo.equipe.nome) || p.nome || "";
    document.getElementById("modal-body").innerHTML =
      '<div class="modal-head"><h3 style="font-size:19px;">Criar logo grátis</h3><button class="modal-close" id="modal-close">' + ICONS.close + '</button></div>' +
      '<div class="form-grid"><label>Nome no logo<input type="text" id="lg-nome" maxlength="30" value="' + escapeHtml(nomeIni) + '"></label>' +
      '<label>Frase de baixo<input type="text" id="lg-sub" maxlength="34" value="Corretor de Imóveis" list="lg-subs"></label>' +
      '<datalist id="lg-subs"><option value="Corretor de Imóveis"><option value="Corretora de Imóveis"><option value="Imóveis"><option value="Negócios Imobiliários"><option value="Consultoria Imobiliária"></datalist>' +
      '<label>Cor<input type="color" id="lg-cor" value="' + corIni + '"></label></div>' +
      '<p style="font-size:12.5px;color:var(--ink-muted);margin:10px 0 8px;">Toque no modelo que mais gostar para usar como seu logo.</p>' +
      '<div id="lg-op" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;"></div>';
    document.getElementById("overlay").hidden = false;
    document.getElementById("modal-close").onclick = closeModal;
    var cvs = [];
    function desenhar() {
      var nome = document.getElementById("lg-nome").value.trim() || "Seu Nome", sub = document.getElementById("lg-sub").value.trim(), cor = document.getElementById("lg-cor").value;
      var box = document.getElementById("lg-op"); box.innerHTML = ""; cvs = [];
      for (var i = 0; i < 4; i++) {
        var cv = desenharLogo(i, nome, sub, cor); cvs.push(cv);
        var b = document.createElement("button"); b.type = "button"; b.dataset.lg = i;
        b.style.cssText = "padding:8px;border:1px solid var(--border);border-radius:10px;background:repeating-conic-gradient(#1f1f22 0 25%,#141416 0 50%) 0 0/20px 20px;cursor:pointer;";
        cv.style.cssText = "width:100%;height:auto;display:block;"; b.appendChild(cv); box.appendChild(b);
      }
    }
    ["lg-nome", "lg-sub", "lg-cor"].forEach(function (id) { document.getElementById(id).addEventListener("input", desenhar); });
    document.getElementById("lg-op").addEventListener("click", function (e) {
      var b = e.target.closest("[data-lg]"); if (!b) return;
      cvs[+b.dataset.lg].toBlob(async function (blob) {
        try {
          toast("Salvando seu logo…");
          var url = await uploadArquivo(blob, p.id + "/marca/logo-" + Date.now() + ".png", "image/png");
          closeModal(); aoSalvar(url);
        } catch (err) { toast("Erro ao salvar o logo: " + err.message); }
      }, "image/png");
    });
    desenhar();
  }

  function renderMarca() {
    var box = document.getElementById("marca-box");
    if (!box || !state.profile) return;
    var p = state.profile, ativa = p.marca_ativa !== false, cor = /^#[0-9a-f]{6}$/i.test(p.cor_marca || "") ? p.cor_marca : "";
    var logo = safeUrl(p.logo_url);
    box.innerHTML = '<div class="section-head" style="margin-top:6px;"><h2>Minha marca</h2></div>' +
      '<div class="marca-card">' +
      '<p class="marca-sub">Seu logo, nome e CRECI aparecem em um rodapé discreto em todos os slides, e a cor da marca vira o destaque padrão dos títulos.</p>' +
      '<label class="melhorar-toggle"><input type="checkbox" id="marca-ativa"' + (ativa ? " checked" : "") + '> <span>Usar minha marca nos slides</span></label>' +
      '<div class="marca-grid">' +
      '<div class="marca-logo"><div class="marca-logo-img">' + (logo ? '<img src="' + escapeHtml(logo) + '" alt="Seu logo">' : '<span>Sem logo</span>') + '</div>' +
      '<label class="btn btn-ghost btn-sm">' + (logo ? "Trocar logo" : "Enviar logo") + '<input type="file" id="marca-logo-up" accept="image/png,image/jpeg,image/webp" hidden></label>' +
      (logo ? '<button type="button" class="btn btn-ghost btn-sm" id="marca-logo-rm">Remover</button>' : "") +
      '<button type="button" class="btn btn-ghost btn-sm" id="marca-logo-criar">✨ Criar logo grátis</button>' +
      '<small>PNG com fundo transparente fica melhor. Máx. 3 MB.</small></div>' +
      '<div class="marca-campos">' +
      '<label>Nome<input type="text" id="marca-nome" maxlength="60" value="' + escapeHtml(p.nome || "") + '"></label>' +
      '<label>CRECI<input type="text" id="marca-creci" maxlength="20" placeholder="Ex.: 12345-F" value="' + escapeHtml(p.creci || "") + '"></label>' +
      '<label>Cor da marca<span class="marca-cor"><input type="color" id="marca-cor" value="' + (cor || "#FFD60A") + '"><input type="text" id="marca-cor-hex" maxlength="7" placeholder="#FFD60A" value="' + escapeHtml(cor) + '"></span></label>' +
      '</div></div>' +
      '<div class="marca-aviso" id="marca-aviso" hidden>⚠️ Pela lei, anúncio de imóvel precisa do CRECI. Preencha o seu pra seus carrosséis ficarem em dia.</div>' +
      '<div class="marca-aviso cinza" id="marca-aviso-cor" hidden>Essa cor é bem escura: em slides de fundo escuro o destaque pode ficar difícil de ler.</div>' +
      '<div class="marca-previa" id="marca-previa"></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px;"><button class="btn btn-primary btn-sm" id="marca-salvar">Salvar minha marca</button></div></div>' +
      '<div class="marca-card" style="margin-top:12px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;">' +
      '<div style="flex:1 1 260px;min-width:0;"><b>🎨 Logo profissional feito por designer</b>' +
      '<p class="marca-sub" style="margin:4px 0 0;">3 propostas exclusivas para você ou sua imobiliária, 2 rodadas de ajuste e arquivos finais (PNG transparente, SVG e versão para Instagram). Entrega em até 5 dias úteis.</p></div>' +
      '<div style="text-align:right;"><div style="font-size:22px;font-weight:700;">R$ ' + PRECO_LOGO_PRO + '</div><div style="font-size:12px;color:var(--ink-muted);margin-bottom:6px;">pagamento único</div>' +
      '<a class="btn btn-primary btn-sm" id="marca-logo-pro" href="#">Quero meu logo</a></div></div>';

    function lerHex() { var v = document.getElementById("marca-cor-hex").value.trim(); if (v && v[0] !== "#") v = "#" + v; return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : ""; }
    function atualizar() {
      var nome = document.getElementById("marca-nome").value.trim(), creci = document.getElementById("marca-creci").value.trim(), hex = lerHex();
      document.getElementById("marca-aviso").hidden = !!creci;
      var lum = 0;
      if (hex) { lum = (0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16)) / 255; }
      document.getElementById("marca-aviso-cor").hidden = !(hex && lum < 0.28);
      document.getElementById("marca-previa").innerHTML = '<div class="marca-previa-barra" style="--m:' + (hex || "#FFD60A") + '">' +
        (logo ? '<span class="pl"><img src="' + escapeHtml(logo) + '" alt=""></span>' : "") +
        '<span class="pt"><b>' + escapeHtml(nome || "Seu nome") + '</b>' + (creci ? '<i>CRECI ' + escapeHtml(creci) + '</i>' : "") + '</span><span class="pd">Destaque</span></div>';
    }
    ["marca-nome", "marca-creci"].forEach(function (id) { document.getElementById(id).addEventListener("input", atualizar); });
    document.getElementById("marca-cor").addEventListener("input", function (e) { document.getElementById("marca-cor-hex").value = e.target.value.toUpperCase(); atualizar(); });
    document.getElementById("marca-cor-hex").addEventListener("input", function () { var h = lerHex(); if (h) document.getElementById("marca-cor").value = h; atualizar(); });
    atualizar();

    async function gravar(campos, msg) {
      try {
        await DB.update("profiles", "id=eq." + p.id, campos);
        Object.assign(state.profile, campos); syncMarcaCor();
        var sn = document.getElementById("sidebar-name"); if (sn) sn.textContent = state.profile.nome || state.profile.email;
        toast(msg);
      } catch (e) { toast("Erro ao salvar: " + e.message); return false; }
      return true;
    }
    document.getElementById("marca-logo-up").onchange = async function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (["image/png", "image/jpeg", "image/webp"].indexOf(f.type) < 0) { toast("Envie o logo em PNG, JPG ou WEBP."); return; }
      if (f.size > 3 * 1024 * 1024) { toast("Logo muito grande (máx. 3 MB)."); return; }
      try {
        toast("Enviando o logo…");
        var ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
        var url = await uploadArquivo(f, p.id + "/marca/logo-" + Date.now() + "." + ext, f.type);
        if (await gravar({ logo_url: url }, "Logo salvo.")) renderMarca();
      } catch (e) { toast("Erro ao enviar o logo: " + e.message); }
    };
    document.getElementById("marca-logo-criar").onclick = function () { abrirCriadorLogo(p, lerHex() || cor || "#D4FF3F", function (url) { gravar({ logo_url: url }, "Logo salvo.").then(function (ok) { if (ok) renderMarca(); }); }); };
    var lp = document.getElementById("marca-logo-pro");
    lp.target = "_blank"; lp.rel = "noopener noreferrer";
    lp.href = "https://wa.me/" + WHATS_LOGO_PRO + "?text=" + encodeURIComponent("Olá! Quero o logo profissional da Vitrine (R$ " + PRECO_LOGO_PRO + ").\n\nNome que vai no logo: " + (p.nome || "") + "\nCRECI: " + (p.creci || "") + "\nE-mail da conta: " + (p.email || "") + "\nCores que gosto: \nEstilo (moderno, clássico, luxo...): ");
    var rm = document.getElementById("marca-logo-rm");
    if (rm) rm.onclick = async function () { if (await gravar({ logo_url: null }, "Logo removido.")) renderMarca(); };
    document.getElementById("marca-salvar").onclick = async function () {
      var hexTxt = document.getElementById("marca-cor-hex").value.trim(), hex = lerHex();
      if (hexTxt && !hex) { toast("Cor inválida — use o formato #RRGGBB."); return; }
      var nome = document.getElementById("marca-nome").value.trim();
      if (!nome) { toast("Preencha o seu nome."); return; }
      var ok = await gravar({
        nome: nome, creci: document.getElementById("marca-creci").value.trim() || null,
        cor_marca: hex || null, marca_ativa: document.getElementById("marca-ativa").checked
      }, "Marca salva.");
      if (ok) renderMarca();
    };
  }

  /* ---------------- ABA "CONVIDAR CORRETORES" (dono de plano de imobiliária) ---------------- */
  var abaPlano = "plano";
  async function renderAbasPlano() {
    var abas = document.getElementById("plano-abas");
    if (!abas) return;
    if (!equipeInfo) { try { await carregarEquipe(); } catch (e) {} }
    var dono = !!(equipeInfo && equipeInfo.papel === "dono");
    abas.hidden = !dono;
    if (!dono) abaPlano = "plano";
    qsa("[data-plano-aba]", abas).forEach(function (b) {
      b.classList.toggle("active", b.dataset.planoAba === abaPlano);
      b.onclick = function () { abaPlano = b.dataset.planoAba; renderAbasPlano(); };
    });
    document.getElementById("plano-pane-plano").hidden = abaPlano !== "plano";
    var pane = document.getElementById("plano-pane-convites");
    pane.hidden = abaPlano !== "convites";
    if (abaPlano === "convites") renderConvites(pane);
  }
  function msgConvite(link, email) {
    var imob = (equipeInfo && equipeInfo.equipe && equipeInfo.equipe.nome) || "nossa imobiliária";
    var quem = (state.profile && state.profile.nome) ? state.profile.nome.split(" ")[0] : "";
    return "Oi! " + (quem ? quem + " aqui. " : "") + "Liberei pra você a Vitrine pelo plano da " + imob +
      ": ela cria carrosséis e posts de imóveis pro Instagram em 2 minutos, com IA.\n\nÉ só criar sua conta (ou entrar) com o e-mail " + email + " por este link:\n" + link;
  }
  function botoesEnvio(link, email, zap) {
    var msg = msgConvite(link, email);
    var num = String(zap || "").replace(/\D/g, "");
    if (num && num.length <= 11) num = "55" + num;
    var hrefZap = "https://wa.me/" + (num.length >= 12 ? num : "") + "?text=" + encodeURIComponent(msg);
    var hrefMail = "mailto:" + encodeURIComponent(email) + "?subject=" + encodeURIComponent("Seu acesso à Vitrine") + "&body=" + encodeURIComponent(msg);
    return '<a class="btn btn-primary btn-xs" target="_blank" rel="noopener noreferrer" href="' + escapeHtml(hrefZap) + '">WhatsApp</a>' +
      '<a class="btn btn-ghost btn-xs" href="' + escapeHtml(hrefMail) + '">E-mail</a>' +
      '<button class="btn btn-ghost btn-xs" type="button" data-copiar="' + escapeHtml(link) + '">Copiar link</button>';
  }
  function renderConvites(pane) {
    var d = equipeInfo || {}, eq = d.equipe || {}, membros = d.membros || [];
    var pend = membros.filter(function (m) { return m.status !== "ativo" && m.link; });
    var vagas = (eq.max || 0) - 1 - membros.length;
    pane.innerHTML =
      '<div class="eq-card"><h3 style="font-size:17px;margin:0 0 4px;">Convide um corretor da sua equipe</h3>' +
      '<p style="margin:0 0 12px;color:var(--ink-muted);font-size:13px;">Digite o e-mail que ele vai usar pra entrar e, se quiser, o WhatsApp. O convite já sai pronto pra enviar. ' +
      (vagas > 0 ? 'Você ainda tem <b>' + vagas + '</b> vaga' + (vagas > 1 ? "s" : "") + '.' : '<b>Todas as vagas estão ocupadas.</b>') + '</p>' +
      (eq.ativa === false ? '<p style="color:#ff9aab;font-size:13px;margin:0;">A assinatura da imobiliária não está ativa.</p>' :
      '<div class="form-grid"><label>E-mail do corretor<input type="email" id="cv-email" placeholder="corretor@email.com"></label>' +
      '<label>WhatsApp (opcional)<input type="tel" id="cv-zap" placeholder="(85) 99999-9999"></label></div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:12px;"><button class="btn btn-primary" id="cv-gerar"' + (vagas > 0 ? "" : " disabled") + '>Gerar convite</button></div>') +
      '<div id="cv-novo" style="margin-top:12px;"></div></div>' +
      '<div class="eq-card" style="margin-top:14px;"><h3 style="font-size:16px;margin:0 0 8px;">Convites aguardando</h3>' +
      (pend.length ? pend.map(function (m) {
        return '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--border);">' +
          '<span style="min-width:0;flex:1 1 200px;word-break:break-all;"><b>' + escapeHtml(m.email) + '</b></span>' +
          '<span style="display:flex;gap:6px;flex-wrap:wrap;">' + botoesEnvio(m.link, m.email, "") + '</span></div>';
      }).join("") : '<p style="margin:0;color:var(--ink-muted);font-size:13px;">Nenhum convite pendente.</p>') +
      '<p style="margin:10px 0 0;font-size:12.5px;color:var(--ink-muted);">Para ver quem já entrou, remover ou exigir aprovação dos posts, use a aba <a href="#" id="cv-ir-equipe">Equipe</a>.</p></div>';
    var g = document.getElementById("cv-gerar");
    if (g) g.onclick = async function () {
      var email = document.getElementById("cv-email").value.trim(), zap = document.getElementById("cv-zap").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("Digite um e-mail válido."); return; }
      g.disabled = true; g.textContent = "Gerando…";
      try {
        var r = await callFunction("equipe", { acao: "convidar", email: email });
        if (!r.link) { toast("Esse corretor já está na equipe."); g.disabled = false; g.textContent = "Gerar convite"; return; }
        await carregarEquipe();
        renderConvites(pane);
        var box = document.getElementById("cv-novo");
        box.innerHTML = '<div class="eq-link" style="flex-wrap:wrap;"><span style="flex:1 1 100%;">✅ Convite pronto para <b>' + escapeHtml(email) + '</b>. Escolha como enviar:</span>' +
          '<span style="display:flex;gap:6px;flex-wrap:wrap;">' + botoesEnvio(r.link, email, zap) + '</span></div>';
        qsa("[data-copiar]", box).forEach(function (b) { b.onclick = function () { copiarTexto(b.dataset.copiar); }; });
      } catch (e) { toast(e.message); g.disabled = false; g.textContent = "Gerar convite"; }
    };
    qsa("[data-copiar]", pane).forEach(function (b) { b.onclick = function () { copiarTexto(b.dataset.copiar); }; });
    var ir = document.getElementById("cv-ir-equipe");
    if (ir) ir.onclick = function (e) { e.preventDefault(); showScreen("equipe"); };
  }

  function renderPlano() {
    renderAbasPlano();
    renderMarca();
    var statusEl = document.getElementById("plan-status");
    if (!state.assinatura || state.assinatura.status === "trial") {
      var used = (state.profile.trial_usado || 0), limit = (state.profile.trial_limite || 0), left = Math.max(limit - used, 0);
      statusEl.innerHTML = '<div class="plan-banner"><div>' +
        '<h3 style="font-size:17px;margin-bottom:4px;">Teste grátis</h3>' +
        '<p style="margin:0;font-size:13px;color:var(--ink-muted);">' + used + ' de ' + limit + ' carrosséis grátis usados' + (left > 0 ? " · restam " + left : " · limite atingido") + '</p>' +
        '</div><span class="trial-pill' + (left <= 0 ? " full" : "") + '"><span class="dot"></span>' + (left > 0 ? left + " restante" + (left > 1 ? "s" : "") : "sem créditos") + '</span></div>';
    } else if (state.assinatura.equipe_id) {
      var planoEq = findPlano(state.assinatura.plano_id);
      statusEl.innerHTML = '<div class="plan-banner pro"><div>' +
        '<h3 style="font-size:17px;margin-bottom:4px;">Acesso pela imobiliária' + (equipeInfo && equipeInfo.equipe && equipeInfo.equipe.nome ? " · " + escapeHtml(equipeInfo.equipe.nome) : "") + '</h3>' +
        '<p style="margin:0;font-size:13px;color:var(--ink-muted);">' + (planoEq ? escapeHtml(planoEq.nome) + " · " : "") + 'carrosséis ilimitados, pago pela sua imobiliária</p>' +
        '</div><button class="btn btn-ghost btn-sm" id="ir-equipe">Ver equipe</button></div>';
      document.getElementById("ir-equipe").addEventListener("click", function () { showScreen("equipe"); });
    } else {
      var plano = findPlano(state.assinatura.plano_id);
      statusEl.innerHTML = '<div class="plan-banner pro"><div>' +
        '<h3 style="font-size:17px;margin-bottom:4px;">Vitrine ' + (plano ? escapeHtml(plano.nome) : "Pro") + ' ativo</h3>' +
        '<p style="margin:0;font-size:13px;color:var(--ink-muted);">Assinante desde ' + fmtDate(state.assinatura.data_inicio) + ' · carrosséis ilimitados</p>' +
        '</div><button class="btn btn-ghost btn-sm" id="cancel-plan">Cancelar assinatura</button></div>';
      var cancelBtn = document.getElementById("cancel-plan");
      if (cancelBtn) cancelBtn.addEventListener("click", async function () {
        try {
          // cancelamento e o reset do contador de trial são feitos pela Edge Function (service role) —
          // o cliente não tem mais permissão de escrever em assinaturas/trial_usado diretamente.
          if (!confirm("Cancelar a assinatura? A cobrança recorrente no cartão será encerrada.")) return;
          var resp = await callFunction("stripe-cancel", {});
          if (resp.pendente) { toast("Cancelamento enviado — atualize a página em instantes."); return; }
          state.assinatura = resp.assinatura;
          state.profile.trial_usado = 0;
          updateNavPlanBadge(); renderPlano(); toast("Assinatura cancelada — voltando ao teste grátis.");
        } catch (err) { toast("Erro: " + err.message); }
      });
    }

    var promoHtml = promoAtiva() ? '<div class="promo-plano" style="grid-column:1/-1;"><b>Oferta para novos assinantes:</b> 30% off no 1º mês do plano mensal, aplicado automaticamente no pagamento.</div>' : "";
    document.getElementById("plan-grid").innerHTML = promoHtml +
      '<div class="toggle-period" style="grid-column:1/-1;">' +
      '<button data-period="mensal" class="' + (planPeriod === "mensal" ? "active" : "") + '">Mensal</button>' +
      '<button data-period="anual" class="' + (planPeriod === "anual" ? "active" : "") + '">Anual · 2 meses grátis</button>' +
      '</div>' +
      state.planos.filter(function (p) { return p.tipo !== "equipe"; }).map(function (p) {
        var preco = planPeriod === "anual" ? p.preco_anual : p.preco_mensal;
        var isCurrent = state.assinatura && state.assinatura.status === "ativa" && state.assinatura.plano_id === p.id;
        return '<div class="plan-card ' + (p.destaque ? "featured" : "") + '">' +
          (p.destaque ? '<span class="badge">Mais escolhido</span>' : "") +
          '<h3>' + escapeHtml(p.nome) + '</h3>' +
          '<div class="plan-price mono">' + fmtBRL(preco) + ' <span>/' + (planPeriod === "anual" ? "ano" : "mês") + '</span></div>' +
          '<ul class="plan-feats">' + (p.recursos || []).map(function (f) { return '<li>' + ICONS.check + escapeHtml(f) + '</li>'; }).join("") + '</ul>' +
          '<button class="btn ' + (p.destaque ? "btn-primary" : "btn-2") + '" style="width:100%;justify-content:center;" data-subscribe="' + p.id + '" ' + (isCurrent ? "disabled" : "") + '>' +
          (isCurrent ? "Plano atual" : "Assinar " + escapeHtml(p.nome)) + '</button></div>';
      }).join("");

    var equipes = state.planos.filter(function (p) { return p.tipo === "equipe"; });
    document.getElementById("plan-grid-equipe").innerHTML = equipes.length ? '<h3 class="plan-sec-title">Planos para imobiliárias</h3><p class="plan-sec-sub">Você assina e convida seus corretores por link — cada um usa a própria conta com tudo do Pro. Você conta como 1 corretor.</p>' +
      equipes.map(function (p) {
        var preco = planPeriod === "anual" ? p.preco_anual : p.preco_mensal;
        var isCurrent = state.assinatura && state.assinatura.status === "ativa" && state.assinatura.plano_id === p.id && !state.assinatura.equipe_id;
        var porCorretor = Number(p.preco_mensal) / (p.max_corretores || 1);
        return '<div class="plan-card ' + (p.destaque ? "featured" : "") + '">' + (p.destaque ? '<span class="badge">Melhor custo</span>' : "") +
          '<h3>' + escapeHtml(p.nome) + '</h3>' +
          '<div class="plan-price mono">' + fmtBRL(preco) + ' <span>/' + (planPeriod === "anual" ? "ano" : "mês") + '</span></div>' +
          '<div style="font-size:12px;color:var(--ink-muted);margin:-4px 0 10px;">≈ R$ ' + porCorretor.toFixed(2).replace(".", ",") + ' por corretor/mês</div>' +
          '<ul class="plan-feats">' + (p.recursos || []).map(function (f) { return '<li>' + ICONS.check + escapeHtml(f) + '</li>'; }).join("") + '</ul>' +
          '<button class="btn ' + (p.destaque ? "btn-primary" : "btn-2") + '" style="width:100%;justify-content:center;" data-subscribe="' + escapeHtml(p.id) + '" ' + (isCurrent ? "disabled" : "") + '>' + (isCurrent ? "Plano atual" : "Assinar " + escapeHtml(p.nome)) + '</button></div>';
      }).join("") +
      '<div class="plan-card"><h3>50+ corretores</h3><div class="plan-price mono">R$ 59,90 <span>/corretor</span></div>' +
      '<ul class="plan-feats"><li>' + ICONS.check + 'Rede ou imobiliária grande</li><li>' + ICONS.check + 'Tudo do Pro para cada corretor</li><li>' + ICONS.check + 'Condição sob medida</li></ul>' +
      '<a class="btn btn-2" style="width:100%;justify-content:center;text-decoration:none;" href="mailto:' + SUPORTE_EMAIL + '?subject=' + encodeURIComponent("Plano 50+ corretores") + '">Falar com a Vitrine</a></div>' : "";
    qsa("[data-period]").forEach(function (b) { b.addEventListener("click", function () { planPeriod = b.dataset.period; renderPlano(); }); });
    qsa("[data-subscribe]").forEach(function (b) { b.addEventListener("click", function () { planPending = b.dataset.subscribe; renderCheckout(); }); });
    document.getElementById("checkout-box").hidden = !planPending;
    if (planPending) renderCheckout();
  }

  function renderCheckout() {
    var plano = findPlano(planPending);
    if (!plano) return;
    var preco = planPeriod === "anual" ? plano.preco_anual : plano.preco_mensal;
    var box = document.getElementById("checkout-box");
    box.hidden = false;
    box.innerHTML = '<div class="checkout-card">' +
      '<h3 style="font-size:16px;margin-bottom:14px;">Assinar Vitrine ' + escapeHtml(plano.nome) + '</h3>' +
      '<div class="checkout-summary"><span>' + escapeHtml(plano.nome) + ' · ' + (planPeriod === "anual" ? "anual" : "mensal") + '</span><span class="mono">' + fmtBRL(preco) + '</span></div>' +
      '<p style="font-size:12px;color:var(--ink-muted);margin:0 0 12px;">Você será levado ao checkout seguro do Stripe para pagar com cartão de crédito. A Vitrine não vê nem guarda os dados do seu cartão.</p>' +
      '<button class="btn btn-primary" id="confirm-sub" style="width:100%;justify-content:center;">Ir para o pagamento</button>' +
      '<button class="btn btn-ghost btn-sm" id="cancel-checkout" style="width:100%;justify-content:center;margin-top:8px;">Cancelar</button></div>';
    document.getElementById("cancel-checkout").addEventListener("click", function () { planPending = null; box.hidden = true; box.innerHTML = ""; });
    document.getElementById("confirm-sub").addEventListener("click", async function () {
      var btn = this;
      btn.disabled = true; btn.innerHTML = '<div class="spin" style="border-top-color:#fff; border-color:rgba(255,255,255,0.35);"></div> Abrindo checkout…';
      try {
        // a ativação do plano acontece só no servidor, pelo webhook do Stripe, depois do pagamento confirmado
        var resp = await callFunction("stripe-checkout", { plano_id: plano.id, periodo: planPeriod });
        irPara(resp.url, ["checkout.stripe.com"]);
      } catch (err) {
        toast("Erro: " + err.message);
        btn.disabled = false; btn.textContent = "Ir para o pagamento";
      }
    });
  }

  // trata o retorno do Stripe (?checkout=...) e do Instagram (?instagram=...)
  async function handleReturnParams() {
    var params = new URLSearchParams(location.search);
    var ck = params.get("checkout"), ig = params.get("instagram");
    if (!ck && !ig) return;
    history.replaceState(null, "", location.pathname);
    if (ck === "cancelado") toast("Pagamento cancelado — nada foi cobrado.");
    if (ck === "sucesso") {
      toast("Pagamento recebido! Ativando seu plano…");
      // o webhook pode levar alguns segundos: consulta até a assinatura virar "ativa"
      for (var i = 0; i < 10; i++) {
        var rows = await DB.select("assinaturas", "select=*&corretor_id=eq." + state.profile.id + "&status=eq.ativa&limit=1");
        if (rows && rows[0]) { state.assinatura = rows[0]; break; }
        await new Promise(function (r) { setTimeout(r, 1500); });
      }
      updateNavPlanBadge();
      showScreen("plano");
      toast(state.assinatura && state.assinatura.status === "ativa" ? "Plano ativado. Bem-vindo à Vitrine Pro!" : "Pagamento em processamento — o plano aparece em instantes.");
    }
    var igMsgs = { conectado: "Instagram conectado!", negado: "Conexão com o Instagram cancelada.", expirado: "O link de conexão expirou — tente de novo.", limite: "Seu plano não permite conectar mais contas de Instagram. Desconecte uma ou mude de plano.", ja_conectada: "Essa conta já estava conectada. Para conectar outra, entre com o outro usuário na tela de login do Instagram (ou saia do Instagram neste navegador antes).", erro: "Não foi possível conectar o Instagram. Verifique se a conta é Profissional (Empresa ou Criador)." };
    if (ig) {
      if (ig === "conectado") {
        var c = await DB.select("instagram_contas", "select=*&corretor_id=eq." + state.profile.id + "&status=eq.ativo&order=connected_at.asc");
        state.igContas = ordenarContas(c);
        state.igConta = state.igContas[0] || null;
      }
      showScreen("instagram");
      toast(igMsgs[ig] || igMsgs.erro);
    }
  }

  /* ============================================================
     BOOT
  ============================================================ */
  function wireNav() {
    qsa(".navitem").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.screen === "novo") { if (!tryStartWizard()) return; }
        showScreen(b.dataset.screen);
      });
    });
    document.getElementById("overlay").addEventListener("click", function (e) { if (e.target.id === "overlay") closeModal(); });
    document.getElementById("logout-btn").addEventListener("click", async function () {
      if (!window.confirm("Sair da sua conta na Vitrine?")) return;
      await Auth.signOut();
      document.getElementById("app-view").hidden = true;
      authMode = "login";
      document.getElementById("auth-view").hidden = false;
      renderAuthView();
    });
    wireStep1Once();
  }
  var navWired = false;

  async function loadAllData() {
    var uid = state.profile.id;
    var results = await Promise.all([
      DB.select("planos", "select=*&order=ordem.asc"),
      DB.select("topicos", "select=*&ativo=eq.true"),
      DB.select("templates", "select=*&ativo=eq.true"),
      DB.select("propriedades", "select=*&corretor_id=eq." + uid + "&order=created_at.desc"),
      DB.select("assinaturas", "select=*&corretor_id=eq." + uid + "&status=in.(trial,ativa)&limit=1"),
      DB.select("instagram_contas", "select=*&corretor_id=eq." + uid + "&status=eq.ativo&order=connected_at.asc"),
      DB.select("autoreply_config", "select=*&corretor_id=eq." + uid + "&limit=1"),
      DB.select("carrosseis", "select=*,slides(*)&corretor_id=eq." + uid + "&order=created_at.desc")
    ]);
    state.planos = results[0] || [];
    state.topicos = results[1] || [];
    state.templates = results[2] || [];
    state.propriedades = results[3] || [];
    state.assinatura = (results[4] || [])[0] || null;
    state.igContas = ordenarContas(results[5]);
    state.igConta = state.igContas[0] || null;
    atualizarPillIg();
    state.autoReply = (results[6] || [])[0] || { ativo: true, template: "Oi {{nome}}! Que bom o seu interesse 😊 Já te chamo aqui pra conversarmos com mais detalhes sobre esse imóvel. Precisa de mais alguma informação?", palavra_gatilho: "QUERO" };
    state.carrosseis = (results[7] || []).map(function (c) {
      c.slides = (c.slides || []).slice().sort(function (a, b) { return a.ordem - b.ordem; });
      return c;
    });

    if (!state.assinatura) {
      // rede de segurança: o trial já é criado pelo backend no cadastro (trigger handle_new_user).
      // Isso só roda se, por algum motivo, essa linha ainda não existir — e passa pela Edge Function
      // (não por um INSERT direto do cliente), porque o cliente não tem mais permissão de escrever em assinaturas.
      var resp = await callFunction("gerenciar-assinatura", { acao: "iniciar_trial" });
      state.assinatura = resp.assinatura;
    }
    // não trava a abertura do app: prepara em segundo plano as imagens de agendados antigos
    setTimeout(function () { prepararAgendadosPendentes(); }, 1500);
  }

  // visitante sem login vê a página de captação; os botões abrem o cadastro (teste grátis) ou o login
  var landingWired = false;
  var landingPlanPeriod = "monthly";
  var LANDING_INTENT_KEY = "vitrine_landing_checkout_intent";
  function saveLandingIntent(mode, planName) {
    try {
      sessionStorage.setItem(LANDING_INTENT_KEY, JSON.stringify({
        mode: mode === "login" ? "login" : "signup",
        period: landingPlanPeriod === "yearly" ? "anual" : "mensal",
        planName: planName || ""
      }));
    } catch (e) {}
  }
  function readLandingIntent() {
    try {
      var raw = sessionStorage.getItem(LANDING_INTENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearLandingIntent() {
    try { sessionStorage.removeItem(LANDING_INTENT_KEY); } catch (e) {}
  }
  function matchPlanoPorNome(nome) {
    var key = String(nome || "").toLowerCase().replace(/\s+/g, " ").trim();
    return state.planos.find(function (p) {
      return String(p.nome || "").toLowerCase().replace(/\s+/g, " ").trim() === key;
    }) || null;
  }
  function applyLandingIntent() {
    var intent = readLandingIntent();
    if (!intent) return false;
    clearLandingIntent();
    planPeriod = intent.period === "anual" ? "anual" : "mensal";
    if (state.assinatura && state.assinatura.status === "ativa") return false;
    planPending = null;
    var plano = matchPlanoPorNome(intent.planName);
    if (plano) planPending = plano.id;
    showScreen("plano");
    return true;
  }
  function renderLandingPlanPeriod() {
    qsa("#landing-view [data-plan-price]").forEach(function (el) {
      var html = el.dataset[landingPlanPeriod];
      if (html) el.innerHTML = html;
    });
    qsa("#landing-view [data-plan-sub]").forEach(function (el) {
      var txt = el.dataset[landingPlanPeriod];
      if (txt) el.textContent = txt;
    });
    qsa("#landing-view [data-plan-promo]").forEach(function (el) {
      var html = el.dataset[landingPlanPeriod];
      if (!html) return;
      el.innerHTML = html;
    });
    qsa("#landing-view [data-plan-note]").forEach(function (el) {
      var txt = el.dataset[landingPlanPeriod];
      if (txt) el.textContent = txt;
    });
    qsa("#landing-view [data-plan-note-secondary]").forEach(function (el) {
      var txt = el.dataset[landingPlanPeriod];
      if (txt) el.textContent = txt;
    });
    qsa("#landing-view [data-plan-team-note]").forEach(function (el) {
      var txt = el.dataset[landingPlanPeriod];
      if (txt) el.textContent = txt;
    });
    qsa("#landing-view [data-plan-period]").forEach(function (btn) {
      var on = btn.dataset.planPeriod === landingPlanPeriod;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  function showLanding() {
    document.getElementById("auth-view").hidden = true;
    document.getElementById("landing-view").hidden = false;
    if (!landingWired) {
      landingWired = true;
      qsa("#landing-view [data-cta]").forEach(function (b) {
        b.addEventListener("click", function () {
          openAuth(b.dataset.cta, { planName: b.dataset.planName || "" });
        });
      });
      qsa("#landing-view [data-plan-period]").forEach(function (b) {
        b.addEventListener("click", function () {
          landingPlanPeriod = b.dataset.planPeriod === "yearly" ? "yearly" : "monthly";
          renderLandingPlanPeriod();
        });
      });
    }
    renderLandingPlanPeriod();
    window.scrollTo(0, 0); document.body.scrollTop = 0; document.documentElement.scrollTop = 0;
  }
  function openAuth(mode, opts) {
    opts = opts || {};
    if (opts.planName) saveLandingIntent(mode, opts.planName);
    authMode = mode === "login" ? "login" : "signup";
    document.getElementById("landing-view").hidden = true;
    document.getElementById("auth-view").hidden = false;
    renderAuthView();
    window.scrollTo(0, 0); document.body.scrollTop = 0; document.documentElement.scrollTop = 0;
  }

  // anti-clickjacking: o GitHub Pages não deixa mandar X-Frame-Options, então o app se recusa a rodar dentro de iframe de outro site
  if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.innerHTML = ""; } }

  // fallback de imagem quebrada (substitui o antigo onerror inline)
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.tagName === "IMG" && t.dataset && t.dataset.fb) {
      var h = (window.__vitrineFallback || {})[t.dataset.fb];
      if (h) t.outerHTML = h; else t.remove();
    }
  }, true);

  async function bootApp() {
    document.getElementById("landing-view").hidden = true;
    var loading = document.getElementById("loading-shell");
    var authView = document.getElementById("auth-view");
    var appView = document.getElementById("app-view");
    loading.hidden = false; authView.hidden = true; appView.hidden = true;

    var temConvite = guardarConviteDaUrl();
    var session = Auth.load();
    if (!session) {
      loading.hidden = true;
      if (temConvite) { openAuth("signup"); toast("Você foi convidado para a equipe de uma imobiliária na Vitrine. Crie sua conta (ou entre) com o e-mail do convite."); }
      else if (/entrar|login/.test(location.hash)) openAuth("login");
      else if (/teste|cadastro/.test(location.hash)) openAuth("signup");
      else showLanding();
      return;
    }
    try {
      await Auth.ensureValidToken();
      if (!Auth.get()) throw new Error("sessão expirada");

      var uid = session.user ? session.user.id : (Auth.get().user ? Auth.get().user.id : null);
      var profiles = await DB.select("profiles", "select=*&id=eq." + uid);
      if (!profiles || !profiles.length) throw new Error("perfil não encontrado");
      state.profile = profiles[0];
      syncMarcaCor();

      await loadAllData();

      loading.hidden = true;
      authView.hidden = true;
      appView.hidden = false;

      document.getElementById("sidebar-avatar").textContent = (state.profile.nome || "?").slice(0, 1).toUpperCase();
      document.getElementById("sidebar-name").textContent = state.profile.nome || state.profile.email;
      document.getElementById("workspace-name").textContent = state.profile.nome ? state.profile.nome + " · Vitrine" : "Vitrine";

      document.getElementById("nav-admin").hidden = !ehAdmin();
      if (ehAdmin()) verificarAlertasSistema();
      carregarEquipe().then(aceitarConvitePendente);
      if (!navWired) { wireNav(); navWired = true; }
      updateNavPlanBadge();
      resetWizard();
      // se o usuário veio da landing escolhendo um plano/período, abre a contratação já no contexto correto
      if (!applyLandingIntent()) {
        // página inicial depois do login: criar carrossel (se o teste acabou, vai pro Plano)
        if (trialBlocked()) showScreen("painel"); else showScreen("novo");
      }
      prepararAssuntos();
      handleReturnParams().catch(function (e) { console.error(e); });
    } catch (err) {
      await Auth.signOut();
      loading.hidden = true;
      authMode = "login";
      authView.hidden = false;
      renderAuthView("Sua sessão expirou. Entre novamente.");
    }
  }

  window.Vitrine = Object.assign(window.Vitrine || {}, { state: state, DB: DB, toast: toast, escapeHtml: escapeHtml, fmtDate: fmtDate, fmtDateTime: fmtDateTime, contasAtivas: contasAtivas, callFunction: callFunction, fotosDe: fotosDe, fmtBRL: fmtBRL, closeModal: closeModal, remuxMp4: remuxMp4, agendarVideoNovo: agendarVideoNovo });
  bootApp();
})();
