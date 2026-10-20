/* Vitrine — "A Vitrine te trouxe", primeiro uso guiado e PWA. Carrega depois do app.js. */
(function () {
  "use strict";
  var V = window.Vitrine = window.Vitrine || {};
  function esc(s) { return V.escapeHtml ? V.escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function num(n) { return Number(n || 0).toLocaleString("pt-BR"); }

  var css = document.createElement("style");
  css.textContent =
    ".rs-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px}" +
    ".rs-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:12px}" +
    ".rs-h b{font-size:15px}.rs-h span{font-size:12px;color:var(--ink-muted)}" +
    ".rs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}" +
    ".rs-n{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px}" +
    ".rs-n .v{font-family:'Geist Mono',monospace;font-size:24px;font-weight:700;color:var(--accent)}" +
    ".rs-n .l{font-size:12px;color:var(--ink-muted)}" +
    ".rs-low{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}" +
    "@media(max-width:640px){.rs-low{grid-template-columns:1fr}}" +
    ".rs-box{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px;font-size:13px}" +
    ".rs-box .t{font-size:12px;color:var(--ink-muted);margin-bottom:6px}" +
    ".rs-empty{text-align:center;padding:10px 4px}.rs-empty p{color:var(--ink-muted);margin:6px 0 14px}" +
    ".rs-chk{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}" +
    ".rs-chk li{display:flex;gap:8px;align-items:center;font-size:13.5px}" +
    ".rs-chk .ok{color:var(--accent);font-weight:700}.rs-chk .no{color:var(--ink-muted)}.rs-chk .done{text-decoration:line-through;color:var(--ink-muted)}" +
    ".rs-chk a{color:var(--accent2);text-decoration:underline;cursor:pointer}" +
    ".rs-guia{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9000;width:min(420px,calc(100vw - 32px));background:var(--surface);border:1px solid var(--accent);border-radius:16px;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.6)}" +
    ".rs-guia .p{font-size:11px;color:var(--accent);font-family:'Geist Mono',monospace;margin-bottom:4px}" +
    ".rs-guia h3{margin:0 0 4px;font-size:16px}.rs-guia p{margin:0 0 14px;color:var(--ink-muted);font-size:13.5px}" +
    ".rs-guia .row{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap}" +
    ".rs-hl{outline:2px solid var(--accent)!important;outline-offset:4px;border-radius:10px;transition:outline .2s}";
  document.head.appendChild(css);

  /* ---------------- painel: A Vitrine te trouxe ---------------- */
  function irCriar(texto) {
    var b = document.querySelector('.navitem[data-screen="novo"]');
    if (b) b.click();
    if (texto) setTimeout(function () {
      var t = document.getElementById("tema-livre-txt");
      if (t) { t.value = texto; t.focus(); }
    }, 60);
  }

  function semanas(eventos, tipo, agora) {
    var b = [0, 0, 0, 0, 0];
    eventos.forEach(function (e) {
      if (e.tipo !== tipo) return;
      var d = Math.floor((agora - new Date(e.created_at).getTime()) / 86400000);
      var i = Math.min(4, Math.max(0, Math.floor(d / 7)));
      b[4 - i]++;
    });
    return b;
  }
  function grafico(b) {
    var max = Math.max.apply(null, b.concat([1])), w = 220, h = 70, bw = 30, g = 14, x0 = 6;
    var lab = ["S-4", "S-3", "S-2", "S-1", "Esta"];
    var s = '<svg viewBox="0 0 ' + w + ' ' + (h + 18) + '" width="100%" role="img" aria-label="Cliques no WhatsApp por semana">';
    b.forEach(function (v, i) {
      var bh = Math.round((v / max) * (h - 14)), x = x0 + i * (bw + g);
      s += '<rect x="' + x + '" y="' + (h - bh) + '" width="' + bw + '" height="' + Math.max(bh, 2) + '" rx="4" fill="' + (v ? "#D4FF3F" : "#27272A") + '"/>';
      if (v) s += '<text x="' + (x + bw / 2) + '" y="' + (h - bh - 3) + '" text-anchor="middle" font-size="10" fill="#FAFAFA">' + v + '</text>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (h + 13) + '" text-anchor="middle" font-size="9" fill="#A1A1AA">' + lab[i] + '</text>';
    });
    return s + "</svg>";
  }

  function checklist(st) {
    var p = st.profile || {};
    var itens = [
      ["Criar meu 1º carrossel", (st.carrosseis || []).length > 0, "novo"],
      ["Conectar meu Instagram", !!((st.igContas && st.igContas.length) || st.igConta), "instagram"],
      ["Configurar minha marca (logo ou CRECI)", !!(p.logo_url || p.creci), "plano"],
      ["Cadastrar 1 imóvel", (st.propriedades || []).length > 0, "imoveis"]
    ];
    if (itens.every(function (i) { return i[1]; })) return "";
    return '<div class="rs-card"><div class="rs-h"><b>Primeiros passos</b><span>' + itens.filter(function (i) { return i[1]; }).length + ' de 4</span></div><ul class="rs-chk">' +
      itens.map(function (i) {
        return '<li>' + (i[1] ? '<span class="ok">✔</span><span class="done">' + i[0] + '</span>' : '<span class="no">○</span><a data-rs-go="' + i[2] + '">' + i[0] + '</a>') + '</li>';
      }).join("") + '</ul></div>';
  }

  var seq = 0;
  async function renderResultado() {
    var box = document.getElementById("resultado-card");
    if (!box || !V.state || !V.state.profile) return;
    var meu = ++seq;
    var st = V.state, DB = V.DB;
    var agora = Date.now(), desde = new Date(agora - 30 * 86400000).toISOString();
    var ev = [], leads = [], mets = [];
    try {
      var r = await Promise.all([
        DB.select("imovel_eventos", "select=tipo,created_at&created_at=gte." + desde + "&limit=5000").catch(function () { return []; }),
        DB.select("leads_instagram", "select=id&created_at=gte." + desde + "&limit=5000").catch(function () { return []; }),
        DB.select("ig_metricas_posts", "select=carrossel_id,legenda_inicio,permalink,curtidas,salvamentos,compartilhamentos,alcance,publicado_em&publicado_em=gte." + desde + "&limit=500").catch(function () { return []; })
      ]);
      ev = r[0] || []; leads = r[1] || []; mets = r[2] || [];
    } catch (e) { console.error(e); }
    if (meu !== seq) return;

    var visitas = ev.filter(function (e) { return e.tipo === "visita"; }).length;
    var cliques = ev.filter(function (e) { return e.tipo === "whatsapp"; }).length;
    var pubs = (st.carrosseis || []).filter(function (c) {
      return c.status === "publicado" && new Date(c.data_publicada || c.created_at).getTime() >= agora - 30 * 86400000;
    }).length;
    var alcance = 0, salv = 0, camp = null, campScore = 0;
    mets.forEach(function (m) {
      alcance += m.alcance || 0; salv += m.salvamentos || 0;
      var sc = (m.salvamentos || 0) + (m.compartilhamentos || 0) || (m.curtidas || 0);
      if (sc > campScore) { campScore = sc; camp = m; }
    });
    var ck = checklist(st);
    var tudoZero = !visitas && !cliques && !leads.length && !pubs && !alcance && !salv;
    var html = "";
    if (tudoZero) {
      html = '<div class="rs-card"><div class="rs-empty"><b style="font-size:16px">Seu primeiro resultado começa com um post</b>' +
        '<p>Aqui você vai ver quantas visitas, cliques no WhatsApp e contatos a Vitrine trouxe nos últimos 30 dias. Bora começar?</p>' +
        '<button type="button" class="btn btn-primary" id="rs-criar">Criar meu primeiro post</button></div></div>';
    } else {
      var nums = [["Visitas nas páginas", visitas], ["Cliques no WhatsApp", cliques], ["Leads de comentários", leads.length], ["Posts publicados", pubs], ["Alcance", alcance], ["Salvamentos", salv]];
      html = '<div class="rs-card"><div class="rs-h"><b>A Vitrine te trouxe</b><span>últimos 30 dias</span></div><div class="rs-grid">' +
        nums.map(function (n) { return '<div class="rs-n"><div class="v">' + num(n[1]) + '</div><div class="l">' + n[0] + '</div></div>'; }).join("") +
        '</div><div class="rs-low"><div class="rs-box"><div class="t">Cliques no WhatsApp por semana</div>' + grafico(semanas(ev, "whatsapp", agora)) + '</div>' +
        '<div class="rs-box"><div class="t">Post campeão</div>' +
        (camp ? '<div>' + esc((camp.legenda_inicio || "Post sem legenda").slice(0, 110)) + '</div><div style="margin-top:6px;color:var(--ink-muted)">' +
          num(camp.salvamentos) + ' salvamentos · ' + num(camp.compartilhamentos) + ' compart. · ' + num(camp.curtidas) + ' curtidas' +
          (/^https:\/\/(www\.)?instagram\.com\//.test(camp.permalink || "") ? ' · <a href="' + esc(camp.permalink) + '" target="_blank" rel="noopener" style="color:var(--accent2);text-decoration:underline">ver</a>' : '') + '</div>'
          : '<div style="color:var(--ink-muted)">Ainda sem dados de posts. Publique pelo Instagram conectado e as métricas aparecem aqui.</div>') +
        '</div></div></div>';
    }
    box.innerHTML = ck + html;
    var b = document.getElementById("rs-criar"); if (b) b.addEventListener("click", function () { irCriar(); });
    Array.prototype.forEach.call(box.querySelectorAll("[data-rs-go]"), function (a) {
      a.addEventListener("click", function () {
        var t = a.getAttribute("data-rs-go");
        var n = document.querySelector('.navitem[data-screen="' + t + '"]'); if (n) n.click();
      });
    });
  }

  /* ---------------- primeiro uso guiado ---------------- */
  var SUGESTAO = "3 erros que travam a venda do seu imóvel";
  var guiaAberto = false, guiaVisto = false;
  function fecharGuia(marcar) {
    var g = document.getElementById("rs-guia"); if (g) g.remove();
    var h = document.querySelector(".rs-hl"); if (h) h.classList.remove("rs-hl");
    guiaAberto = false;
    if (marcar) lsSet("vitrine_onboard_ok", "1");
  }
  var PASSOS = [
    ["Escreva sua ideia ou escolha uma sugestão", "Digite o assunto do post na caixa destacada, ou use uma das sugestões da Vitrine."],
    ["Confira a prévia e escolha o estilo", "A IA monta os slides. Você vê como vai ficar e troca o estilo antes de seguir."],
    ["Poste ou agende", "Publique direto no Instagram, agende um horário ou deixe como rascunho."]
  ];
  function passo(i) {
    fecharGuia(false); guiaAberto = true;
    if (i === 0) {
      var n = document.querySelector('.navitem[data-screen="novo"]'); if (n) n.click();
      setTimeout(function () {
        var t = document.getElementById("tema-livre-txt");
        var alvo = t && (t.closest(".card") || t.parentElement); if (alvo) alvo.classList.add("rs-hl");
      }, 80);
    }
    var g = document.createElement("div"); g.id = "rs-guia"; g.className = "rs-guia"; g.setAttribute("role", "dialog");
    var ult = i === PASSOS.length - 1;
    g.innerHTML = '<div class="p">PASSO ' + (i + 1) + ' DE 3</div><h3>' + PASSOS[i][0] + '</h3><p>' + PASSOS[i][1] + '</p><div class="row">' +
      '<button type="button" class="btn btn-ghost btn-sm" id="rs-pular">Pular guia</button>' +
      (ult ? '<button type="button" class="btn btn-primary btn-sm" id="rs-fim">Criar meu primeiro post agora</button>'
        : '<button type="button" class="btn btn-primary btn-sm" id="rs-prox">Próximo</button>') + '</div>';
    document.body.appendChild(g);
    document.getElementById("rs-pular").addEventListener("click", function () { fecharGuia(true); });
    var p = document.getElementById("rs-prox"); if (p) p.addEventListener("click", function () { passo(i + 1); });
    var f = document.getElementById("rs-fim"); if (f) f.addEventListener("click", function () { fecharGuia(true); irCriar(SUGESTAO); });
  }
  function talvezGuia() {
    if (guiaVisto || guiaAberto || !V.state || !V.state.profile) return;
    if (lsGet("vitrine_onboard_ok")) return;
    if ((V.state.carrosseis || []).length) return;
    guiaVisto = true;
    passo(0);
  }

  /* ---------------- PWA ---------------- */
  var pedidoInstalar = null;
  function botaoInstalar() {
    if (document.getElementById("rs-instalar")) return;
    var ref = document.querySelector(".sidebar-suporte"); if (!ref) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "rs-instalar"; b.className = "sidebar-suporte"; b.style.cssText = "background:none;border:none;width:100%;cursor:pointer;font-family:inherit;text-align:left;margin-top:auto";
    b.innerHTML = '<span aria-hidden="true">📲</span><span class="label">Instalar app</span>';
    ref.parentNode.insertBefore(b, ref); ref.style.marginTop = "0";
    b.addEventListener("click", function () {
      if (pedidoInstalar) { pedidoInstalar.prompt(); pedidoInstalar = null; b.remove(); }
      else if (V.toast) V.toast("No iPhone: toque em Compartilhar → Adicionar à Tela de Início.");
    });
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); pedidoInstalar = e; botaoInstalar(); });
  window.addEventListener("appinstalled", function () { var b = document.getElementById("rs-instalar"); if (b) b.remove(); });
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  if (ios && !standalone) window.addEventListener("load", function () { setTimeout(botaoInstalar, 1500); });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () { }); });
  }

  /* ---------------- gancho de telas ---------------- */
  var anterior = V.aoMostrar;
  V.aoMostrar = function (nome) {
    if (anterior) { try { anterior(nome); } catch (e) { console.error(e); } }
    if (nome === "painel") renderResultado();
    setTimeout(talvezGuia, 400);
  };
})();
