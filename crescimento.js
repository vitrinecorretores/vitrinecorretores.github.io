/* Crescimento: preço do m² por bairro (com fonte citada), indique um colega e números reais da landing.
   Carrega depois do app.js e do vitrine-leads.js; usa window.Vitrine (state, DB, toast, escapeHtml). */
(function () {
  "use strict";
  var V = window.Vitrine || {};
  var SUPABASE_URL = "https://qbfmozumntequvecttfs.supabase.co";
  var SUPABASE_KEY = "sb_publishable_xXZFK2Pzq7MHsMv2f_iISw_yriYjMvv";
  var SITE = "https://vitrinecorretores.github.io/";
  var ADMIN_ID = "f13c2703-8848-485a-ae60-97e139a2b0a6";

  function esc(s) { return V.escapeHtml ? V.escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function aviso(m) { if (V.toast) V.toast(m); }
  function rpc(nome, args) { return V.DB.rest("rpc/" + nome, { method: "POST", body: JSON.stringify(args || {}) }); }
  function milhar(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function reais(v) { return "R$ " + milhar(v); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) { } }

  /* ============ 2) indicação: guarda ?ref= e registra depois do cadastro ============ */
  try {
    var ref = new URLSearchParams(location.search).get("ref");
    if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) { ssSet("vitrine-ref", ref.toUpperCase()); lsSet("vitrine-ref", ref.toUpperCase()); }
  } catch (e) { }
  var refTentado = false;
  async function tentarRegistrarIndicacao() {
    if (refTentado) return;
    var cod = ssGet("vitrine-ref") || lsGet("vitrine-ref");
    if (!cod || !V.state || !V.state.profile) return;
    refTentado = true;
    try { await rpc("registrar_indicacao", { p_codigo: cod }); } catch (e) { console.error(e); }
    ssDel("vitrine-ref"); lsDel("vitrine-ref");   // tenta uma vez só; o servidor confere se a conta é nova
  }

  async function desenharIndique() {
    var st = document.getElementById("plan-status");
    if (!st || !V.state || !V.state.profile) return;
    var box = document.getElementById("cresc-indique");
    if (!box) { box = document.createElement("div"); box.id = "cresc-indique"; box.className = "cresc-card"; st.parentNode.insertBefore(box, st.nextSibling); }
    var cod = V.state.profile.codigo_indicacao;
    if (!cod || !/^[A-Za-z0-9]+$/.test(cod)) { box.hidden = true; return; }
    box.hidden = false;
    var link = SITE + "?ref=" + cod;
    box.innerHTML = '<h3>🎁 Indique e ganhe 1 mês grátis</h3><p>Quando seu indicado assinar, vocês dois ganham 1 mês grátis.</p>' +
      '<div class="cresc-row"><input type="text" readonly id="cresc-link" value="' + esc(link) + '">' +
      '<a class="btn btn-primary btn-sm" id="cresc-wa" target="_blank" rel="noopener" href="' + esc("https://wa.me/?text=" + encodeURIComponent("Estou criando carrosséis de Instagram com IA na Vitrine, em 2 minutos. Testa grátis pelo meu link: " + link)) + '">Enviar no WhatsApp</a>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="cresc-copiar">Copiar link</button></div>' +
      '<div class="cresc-cont" id="cresc-cont">Carregando suas indicações…</div>';
    document.getElementById("cresc-copiar").onclick = async function () {
      var inp = document.getElementById("cresc-link");
      try { await navigator.clipboard.writeText(link); }
      catch (e) { inp.select(); try { document.execCommand("copy"); } catch (e2) { } }
      aviso("Link copiado!");
    };
    try {
      var lista = await V.DB.select("indicacoes", "select=status");
      var cad = (lista || []).length, ass = (lista || []).filter(function (i) { return i.status === "assinou"; }).length;
      var el = document.getElementById("cresc-cont");
      if (el) el.textContent = cad + " cadastrado" + (cad === 1 ? "" : "s") + " · " + ass + " assinaram";
    } catch (e) { var el2 = document.getElementById("cresc-cont"); if (el2) el2.textContent = ""; }
  }

  async function desenharAdminIndicacoes() {
    var tela = document.getElementById("screen-admin");
    if (!tela || !V.state || !V.state.profile || V.state.profile.id !== ADMIN_ID) return;
    var box = document.getElementById("cresc-admin");
    if (!box) { box = document.createElement("div"); box.id = "cresc-admin"; box.className = "cresc-card"; tela.appendChild(box); }
    box.innerHTML = '<h3>Indicações que assinaram (recompensa pendente)</h3><div id="cresc-adm-lista">Carregando…</div>';
    var lista;
    try { lista = await rpc("indicacoes_pendentes", {}); }
    catch (e) { document.getElementById("cresc-adm-lista").textContent = e.message; return; }
    var cont = document.getElementById("cresc-adm-lista");
    if (!lista || !lista.length) { cont.innerHTML = '<p style="margin:0;">Nenhuma recompensa pendente.</p>'; return; }
    cont.innerHTML = lista.map(function (i) {
      return '<div class="cresc-adm-li"><span><b>' + esc(i.indicador_nome || i.indicador_email) + '</b> indicou <b>' + esc(i.indicado_nome || i.indicado_email) + '</b><br><small style="color:var(--ink-muted);">' + esc(i.indicador_email) + ' · ' + esc(i.indicado_email) + '</small></span>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-aplicar="' + esc(i.id) + '">Marcar como aplicada</button></div>';
    }).join("");
    Array.prototype.forEach.call(cont.querySelectorAll("[data-aplicar]"), function (b) {
      b.onclick = async function () {
        b.disabled = true;
        try { await rpc("marcar_indicacao_aplicada", { p_id: b.dataset.aplicar }); desenharAdminIndicacoes(); }
        catch (e) { aviso("Erro: " + e.message); b.disabled = false; }
      };
    });
  }

  var aoMostrarAnterior = V.aoMostrar;
  V.aoMostrar = function (nome) {
    if (aoMostrarAnterior) aoMostrarAnterior(nome);
    tentarRegistrarIndicacao();
    if (nome === "plano") desenharIndique();
    if (nome === "admin") desenharAdminIndicacoes();
  };

  /* ============ 3) números reais na landing ============ */
  (async function numerosLanding() {
    var sec = document.getElementById("lp-numeros"), grid = document.getElementById("lp-numeros-grid");
    if (!sec || !grid) return;
    try {
      var res = await fetch(SUPABASE_URL + "/rest/v1/rpc/numeros_vitrine", {
        method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" }, body: "{}"
      });
      if (!res.ok) return;
      var n = await res.json();
      var itens = [["carrosseis", "carrosséis criados"], ["publicados", "carrosséis publicados"], ["corretores", "corretores cadastrados"], ["imoveis", "imóveis cadastrados"]]
        .filter(function (it) { return Number(n && n[it[0]]) >= 10; });
      if (!itens.length) return;
      grid.innerHTML = itens.map(function (it) { return '<div><b>' + milhar(n[it[0]]) + '+</b><span>' + it[1] + '</span></div>'; }).join("");
      sec.hidden = false;
    } catch (e) { }
  })();

  /* ============ 1) preço do m² por bairro (slides locais, sem IA) ============ */
  var MAX_BAIRROS = 5;
  var cacheLista = {};   // cidade -> linhas da RPC
  function cidadeDoPerfil() {
    var c = V.state && V.state.profile && V.state.profile.cidade || "";
    return c.replace(/\s*[·,\/-].*$/, "").trim() || "Fortaleza";
  }
  function estado(wiz) {
    wiz.calc = wiz.calc || {};
    var p = wiz.calc.precos = wiz.calc.precos || {};
    if (!p.cidade) p.cidade = cidadeDoPerfil();
    p.finalidade = p.finalidade || "venda";
    p.sel = p.sel || []; p.manual = p.manual || [];
    return p;
  }
  function parseValor(v) { return parseFloat(String(v).replace(/\./g, "").replace(",", ".")); }
  // Só entra valor que o corretor digitou, que veio de fonte citada da internet ou da média real dos anúncios da Vitrine.
  function entradas(p) {
    var l = [];
    p.sel.forEach(function (b) { var r = (p.lista || []).filter(function (x) { return x.bairro === b && x.finalidade === p.finalidade; })[0]; if (r) l.push({ bairro: r.bairro, valor: Number(r.mediana_m2), qtd: r.qtd, origem: "vitrine" }); });
    p.manual.forEach(function (m) {
      var v = parseValor(m.valor);
      if (!(m.bairro.trim() && v > 0)) return;
      var web = m.fonte && m.fonte.nome && String(m.valor) === String(m.webVal);
      l.push({ bairro: m.bairro.trim(), valor: v, qtd: 0, origem: web ? "web" : "corretor", fonte: web ? m.fonte : null });
    });
    return l.slice(0, MAX_BAIRROS);
  }
  function fonteHtml(m) {
    if (m.naoAchou) return '<div class="calc-sub" style="margin:-2px 0 10px;">Não encontrei um valor publicado para esse bairro — preencha com o seu dado.</div>';
    if (m.fonte && String(m.valor) === String(m.webVal)) {
      var url = /^https:\/\//i.test(m.fonte.url) ? m.fonte.url : "";
      return '<div class="calc-sub" style="margin:-2px 0 10px;">Fonte: ' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(m.fonte.nome) + '</a>' : esc(m.fonte.nome)) + (m.fonte.ref ? " (" + esc(m.fonte.ref) + ")" : "") + '</div>';
    }
    return "";
  }

  function renderPrecos(box, wiz) {
    var p = estado(wiz);
    var linhas = (p.lista || []).filter(function (x) { return x.finalidade === p.finalidade; });
    var totalSel = entradas(p).length;
    box.innerHTML = '<div class="calc-form"><h4>📍 Preço do m² por bairro</h4>' +
      '<p class="calc-sub">Escolha até ' + MAX_BAIRROS + ' bairros e a Vitrine monta o carrossel comparando o preço do m². Você digita o valor ou busca a média publicada na internet, sempre com a fonte.</p>' +
      '<div class="calc-grid"><label>Cidade<input type="text" id="pb-cidade" value="' + esc(p.cidade) + '"></label>' +
      '<label>Finalidade<select id="pb-fin"><option value="venda"' + (p.finalidade === "venda" ? " selected" : "") + '>Venda</option><option value="aluguel"' + (p.finalidade === "aluguel" ? " selected" : "") + '>Aluguel</option></select></label></div>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="pb-buscar">Buscar bairros</button> <span class="calc-sub" id="pb-status"></span>' +
      '<div class="cresc-chips" id="pb-chips">' + linhas.map(function (r) {
        var on = p.sel.indexOf(r.bairro) >= 0;
        return '<button type="button" class="mode-tab cresc-bairro' + (on ? " active" : "") + '" data-bairro="' + esc(r.bairro) + '">' + esc(r.bairro) + '<small>' + reais(r.mediana_m2) + '/m² · ' + r.qtd + ' anúncios</small></button>';
      }).join("") + '</div>' +
      (p.buscou && linhas.length < 2 ? '<p class="calc-sub">Ainda há poucos anúncios nessa cidade para mostrar bairros (só aparecem bairros com 3 ou mais imóveis). Digite os valores por bairro abaixo.</p>' : "") +
      '<div id="pb-manual">' + p.manual.map(function (m, i) {
        return '<div class="cresc-row" style="margin-bottom:8px;"><input type="text" data-mb="' + i + '" placeholder="Bairro" value="' + esc(m.bairro) + '"><input type="text" inputmode="decimal" data-mv="' + i + '" placeholder="R$ por m²" value="' + esc(m.valor) + '"><button class="btn btn-ghost btn-sm" type="button" data-mw="' + i + '">🔎 Buscar média na internet</button><button class="btn btn-ghost btn-sm" type="button" data-mx="' + i + '">Remover</button></div><div data-mf="' + i + '">' + fonteHtml(m) + '</div>';
      }).join("") + '</div>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="pb-add"' + (totalSel >= MAX_BAIRROS ? " disabled" : "") + '>+ Digitar valor de um bairro</button>' +
      '<p class="calc-sub">' + totalSel + ' de ' + MAX_BAIRROS + ' bairros escolhidos (mínimo 2). Cada valor vem do que você digitou, de uma fonte da internet citada ou da média dos anúncios da Vitrine. Não são avaliação oficial.</p></div>';
    var st = box.querySelector("#pb-status");
    box.querySelector("#pb-cidade").oninput = function (e) { p.cidade = e.target.value; };
    box.querySelector("#pb-fin").onchange = function (e) { p.finalidade = e.target.value; p.sel = []; renderPrecos(box, wiz); };
    box.querySelector("#pb-buscar").onclick = async function () {
      var c = p.cidade.trim(); if (!c) { aviso("Digite a cidade."); return; }
      st.textContent = "Buscando…";
      try { p.lista = cacheLista[c.toLowerCase()] || (cacheLista[c.toLowerCase()] = await rpc("precos_bairro", { p_cidade: c })); p.buscou = true; p.sel = []; }
      catch (e) { st.textContent = ""; aviso("Não consegui buscar agora: " + e.message); return; }
      renderPrecos(box, wiz);
    };
    Array.prototype.forEach.call(box.querySelectorAll("[data-bairro]"), function (b) {
      b.onclick = function () {
        var k = p.sel.indexOf(b.dataset.bairro);
        if (k >= 0) p.sel.splice(k, 1);
        else if (entradas(p).length >= MAX_BAIRROS) { aviso("Máximo de " + MAX_BAIRROS + " bairros."); return; }
        else p.sel.push(b.dataset.bairro);
        renderPrecos(box, wiz);
      };
    });
    box.querySelector("#pb-add").onclick = function () { p.manual.push({ bairro: "", valor: "" }); renderPrecos(box, wiz); };
    Array.prototype.forEach.call(box.querySelectorAll("[data-mb]"), function (i) { i.oninput = function () { p.manual[+i.dataset.mb].bairro = i.value; }; });
    Array.prototype.forEach.call(box.querySelectorAll("[data-mv]"), function (i) {
      i.oninput = function () {
        var m = p.manual[+i.dataset.mv]; m.valor = i.value; m.naoAchou = false;
        var f = box.querySelector('[data-mf="' + i.dataset.mv + '"]'); if (f) f.innerHTML = fonteHtml(m);   // editou: deixa de ser dado da internet
      };
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-mw]"), function (btn) {
      btn.onclick = async function () {
        var m = p.manual[+btn.dataset.mw], c = (p.cidade || "").trim();
        if (!m.bairro.trim() || !c) { aviso("Digite a cidade e o nome do bairro."); return; }
        btn.disabled = true; btn.textContent = "Buscando…";
        try {
          var r = await V.callFunction("preco-bairro-web", { cidade: c, bairro: m.bairro.trim(), finalidade: p.finalidade });
          if (r && r.encontrado && Number(r.valor_m2) > 0 && r.fonte_nome) {
            m.valor = String(Math.round(Number(r.valor_m2) * 100) / 100).replace(".", ","); m.webVal = m.valor; m.naoAchou = false;
            m.fonte = { nome: r.fonte_nome, url: r.fonte_url, ref: r.referencia || "" };
          } else { m.fonte = null; m.webVal = null; m.naoAchou = true; if (r && r.erro) aviso(r.erro); }
        } catch (e) { m.naoAchou = false; aviso(/Muitas buscas/.test(e.message) ? e.message : "Busca indisponível agora"); }
        renderPrecos(box, wiz);
      };
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-mx]"), function (b) { b.onclick = function () { p.manual.splice(+b.dataset.mx, 1); renderPrecos(box, wiz); }; });
    if (!p.buscou && !p.lista) box.querySelector("#pb-buscar").click();   // primeira vez: já busca a cidade do perfil
  }

  var AVISO = "Valores médios de referência, não são avaliação do imóvel.";
  function rotuloFonte(b) {
    if (b.origem === "web" && b.fonte) return "Fonte: " + b.fonte.nome + (b.fonte.ref ? ", " + b.fonte.ref : "");
    if (b.origem === "vitrine") return "Média dos anúncios cadastrados na Vitrine (" + b.qtd + " imóveis)";
    return "Dado do corretor";
  }
  function slidesPrecos(lista, cidade, aluguel) {
    var un = aluguel ? "/m² por mês" : "/m²", ex = 80;
    var fmt = function (v) { return reais(v) + un; };
    var tot = function (v) { var t = v * ex; return aluguel ? reais(t) + " por mês" : reais(Math.round(t / 1e3) * 1e3); };
    var ord = lista.slice().sort(function (a, b) { return b.valor - a.valor; });
    var s = [{ tag: "PREÇO DO M²", titulo: "Quanto custa o m² em *" + lista[0].bairro + "*?", corpo: "Comparei o preço do m² " + (aluguel ? "de aluguel " : "") + "em " + lista.length + " bairros de " + cidade + ". Arrasta e veja." }];
    lista.forEach(function (b) {
      s.push({ tag: b.bairro.toUpperCase(), titulo: "*" + b.bairro + "*: " + fmt(b.valor), corpo: "Um imóvel de " + ex + " m² sai por volta de " + tot(b.valor) + ".\n" + rotuloFonte(b) });
    });
    var top = ord[0], bot = ord[ord.length - 1], dif = bot.valor > 0 ? Math.round((top.valor / bot.valor - 1) * 100) : 0;
    var rank = ord.map(function (b, i) { return (i + 1) + ". " + b.bairro + ": " + fmt(b.valor); }).join("\n");
    s.push({ tag: "COMPARATIVO", titulo: "*" + top.bairro + "* é o mais caro", corpo: rank + "\n" + (ord.length > 1 ? top.bairro + " custa " + dif + "% a mais que " + bot.bairro + " por m².\n" : "") + AVISO });
    if (lista.length <= 3) s.push({ tag: "RESUMO", titulo: "Resumo do *m²* em " + cidade, corpo: rank + "\nCada imóvel é único: padrão, andar e estado de conservação mudam o preço.\n" + AVISO });
    s.push({ tag: "PRÓXIMO PASSO", titulo: "Comenta *" + lista[0].bairro.toUpperCase() + "*", corpo: "Eu te mando um estudo de preços do bairro que você procura, sem compromisso. Salva este post pra consultar depois." });
    return s;
  }

  function gerarSlides(wiz) {
    var p = estado(wiz), lista = entradas(p);
    var sem = p.manual.filter(function (m) { return m.bairro.trim() && !(parseValor(m.valor) > 0); }).map(function (m) { return m.bairro.trim(); });
    if (lista.length < 2) { aviso("Escolha ou digite pelo menos 2 bairros com valor." + (sem.length ? " Sem valor: " + sem.join(", ") + "." : "")); return false; }
    if (sem.length) aviso("Sem valor, não entram no carrossel: " + sem.join(", ") + ".");
    var sig = "precos" + JSON.stringify([p.cidade, p.finalidade, lista]);
    if (wiz.slides && wiz.calcSig === sig) return true;   // nada mudou: mantém as edições feitas no texto
    var cidade = p.cidade.trim();
    wiz.slides = slidesPrecos(lista, cidade, p.finalidade === "aluguel");
    wiz.customTopic = "Preço do m² por bairro em " + cidade + ": " + lista.map(function (b) { return b.bairro; }).join(", ");
    wiz.customCategoria = "Mercado";
    wiz.calcSig = sig;
    return true;
  }

  window.VitrineCresc = { renderPrecos: renderPrecos, gerarSlides: gerarSlides, slidesPrecos: slidesPrecos };
})();
