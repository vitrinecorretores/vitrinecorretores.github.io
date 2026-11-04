/* demo.js — "Veja agora, sem cadastro" na página inicial: gera um carrossel de amostra (texto + fotos reais do banco da Vitrine) pela função
   demo-carrossel (sem login, com limite por aparelho/IP no servidor). Pra publicar, a pessoa cria a conta e o
   assunto já abre pronto no app (localStorage vitrine-demo-tema, lido no app.js).
   04/11/2026: amostra de 2 opções de cada personalização que já existe no app (mesmos nomes e valores do app.js):
     público (vai pro texto, na mesma chamada de IA), modelo de montagem, fonte e cor do destaque (trocam na hora, sem custo).
   Os totais do bloco "na Vitrine tem muito mais" vêm das listas reais: FONTES (6), CORES (12 + cor da marca),
   tabela templates (13 ativos) e FORMATOS_VIRAIS (13) — atualizar aqui se mudarem. */
(function () {
  "use strict";
  var URL_FN = "https://qbfmozumntequvecttfs.supabase.co/functions/v1/demo-carrossel";
  var KEY = "sb_publishable_xXZFK2Pzq7MHsMv2f_iISw_yriYjMvv";
  var form = document.getElementById("demo-form"); if (!form) return;
  var inp = document.getElementById("demo-assunto"), btn = document.getElementById("demo-btn"), res = document.getElementById("demo-res");
  function esc(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function destaque(s) { return esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>"); }

  // mesmos valores do app.js (FONTES, CORES) e da tabela templates
  var MODELOS = { manchete: "Manchete", "post-social": "Post de rede social" };
  var FONTES = {
    impacto: { nome: "Impacto", fam: '"Anton", sans-serif', peso: 400 },
    elegante: { nome: "Elegante", fam: '"Playfair Display", serif', peso: 800 }
  };
  var CORES = { amarelo: { nome: "Amarelo", hex: "#FFD60A" }, dourado: { nome: "Dourado", hex: "#E9C46A" } };
  var PUBLICOS = { "primeira-compra": "Primeira compra", investidor: "Investidores" };

  var escolha = { modelo: "manchete", fonte: "impacto", cor: "amarelo", publico: "" };
  var slidesAtuais = null, assuntoAtual = "";

  // público: escolhido antes de gerar (muda o texto); tocar de novo desmarca (texto geral)
  document.querySelectorAll("[data-publico]").forEach(function (b) {
    b.onclick = function () {
      escolha.publico = escolha.publico === b.dataset.publico ? "" : b.dataset.publico;
      document.querySelectorAll("[data-publico]").forEach(function (x) {
        var on = x.dataset.publico === escolha.publico; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on ? "true" : "false");
      });
    };
  });

  function grupo(rotulo, chave, opcoes) {
    return '<div class="lp-demo-grupo"><span>' + rotulo + '</span>' + Object.keys(opcoes).map(function (k) {
      var nome = typeof opcoes[k] === "string" ? opcoes[k] : opcoes[k].nome;
      var on = escolha[chave] === k;
      var amostra = chave === "fonte" ? ' style="font-family:' + opcoes[k].fam.replace(/"/g, "&quot;") + ';font-weight:' + opcoes[k].peso + '"' : "";
      var bolinha = chave === "cor" ? '<i style="background:' + opcoes[k].hex + '"></i>' : "";
      return '<button type="button" class="' + (on ? "on" : "") + '" aria-pressed="' + on + '" data-opt="' + chave + '" data-val="' + k + '"' + amostra + '>' + bolinha + esc(nome) + '</button>';
    }).join("") + '</div>';
  }

  function slideHtml(s, i, total) {
    var foto = s.imagem && /^https:\/\/images\.(unsplash|pexels)\.com\//.test(s.imagem) ? s.imagem : "";
    var capa = i === 0 ? " capa" : "";
    if (escolha.modelo === "post-social") {
      return '<div class="lp-demo-slide ps' + capa + '"><div class="ps-card">' +
        '<div class="ps-head"><span class="ps-av">V</span><div><b class="ps-user">@seu_perfil <span class="ps-ok">✓</span></b><small>' + esc(String(s.tag || "").toLowerCase()) + '</small></div></div>' +
        '<b class="ps-tit">' + destaque(s.titulo) + '</b><p>' + esc(s.corpo) + '</p>' +
        (foto ? '<div class="ps-foto" style="background-image:url(&quot;' + esc(foto) + '&quot;)"></div>' : "") +
        '<div class="ps-acoes"><span>♥ Curtir · Comentar · Salvar</span><i>' + (i + 1) + '/' + total + '</i></div></div>' +
        (foto && s.credito ? '<span class="lp-demo-cred">' + esc(s.credito) + '</span>' : "") + '</div>';
    }
    return '<div class="lp-demo-slide mc' + capa + (foto ? " com-foto" : "") + '"' +
      (foto ? ' style="background-image:linear-gradient(180deg,rgba(8,10,16,.35) 0%,rgba(8,10,16,.6) 45%,rgba(8,10,16,.94) 100%),url(&quot;' + esc(foto) + '&quot;)"' : "") + '>' +
      '<div class="lp-demo-top"><small>' + esc(s.tag) + '</small><i>' + (i + 1) + '/' + total + '</i></div>' +
      '<div class="lp-demo-txt"><b>' + destaque(s.titulo) + '</b><p>' + esc(s.corpo) + '</p></div>' +
      (foto && s.credito ? '<span class="lp-demo-cred">' + esc(s.credito) + '</span>' : "") + '</div>';
  }

  function render() {
    if (!slidesAtuais) return;
    var f = FONTES[escolha.fonte], c = CORES[escolha.cor], total = slidesAtuais.length;
    res.innerHTML =
      '<div class="lp-demo-opcoes">' +
        grupo("Modelo", "modelo", MODELOS) + grupo("Fonte", "fonte", FONTES) + grupo("Cor", "cor", CORES) +
        (escolha.publico ? '<div class="lp-demo-grupo"><span>Público</span><button type="button" class="on fixo" aria-pressed="true" disabled>' + esc(PUBLICOS[escolha.publico]) + '</button></div>' : "") +
      '</div>' +
      '<div class="lp-demo-strip" style="--demo-fonte:' + f.fam.replace(/"/g, "'") + ';--demo-peso:' + f.peso + ';--demo-hl:' + c.hex + '">' +
        slidesAtuais.map(function (s, i) { return slideHtml(s, i, total); }).join("") + '</div>' +
      '<div class="lp-demo-mais"><b>Isso é só uma amostra.</b> Dentro da Vitrine você tem muito mais: ' +
        '<span>6 fontes</span><span>12 cores + a cor da sua marca</span><span>13 modelos de montagem</span><span>13 formatos virais (mito x verdade, antes e depois, checklist…)</span>' +
        '<span>público e tom do seu jeito</span><span>troca de qualquer foto</span><span>feed, Reels e Stories</span><span>sua logo e CRECI no post</span></div>' +
      '<div class="lp-demo-cta"><span><b>Gostou?</b> Na Vitrine você personaliza tudo isso e publica direto no seu Instagram.</span>' +
        '<button class="btn btn-primary" id="demo-publicar" type="button">Quero publicar este post · 7 dias grátis</button></div>';
    res.querySelectorAll("[data-opt]").forEach(function (b) {
      b.onclick = function () { escolha[b.dataset.opt] = b.dataset.val; render(); };
    });
    document.getElementById("demo-publicar").onclick = function () {
      try { localStorage.setItem("vitrine-demo-tema", assuntoAtual); } catch (e) { }
      var cta = document.querySelector('[data-cta="signup"]'); if (cta) cta.click();
    };
  }

  async function gerar(assunto) {
    assuntoAtual = assunto;
    btn.disabled = true; btn.textContent = "Criando…";
    res.hidden = false; res.innerHTML = '<p style="text-align:center;color:var(--ink-muted);">A IA está escrevendo o seu carrossel e escolhendo as fotos… (uns 15 segundos)</p>';
    try {
      var r = await fetch(URL_FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY }, body: JSON.stringify({ assunto: assunto, publico: escolha.publico || undefined }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || !j.slides) throw new Error(j.error || "Não consegui criar agora. Tente de novo em instantes.");
      slidesAtuais = j.slides;
      render();
    } catch (e) { res.innerHTML = '<p style="text-align:center;color:#ff9aab;">' + esc(e.message) + '</p>'; }
    finally { btn.disabled = false; btn.textContent = "Criar meu carrossel"; }
  }
  form.addEventListener("submit", function (e) { e.preventDefault(); var a = inp.value.trim(); if (a.length >= 4) gerar(a); });
  document.querySelectorAll("[data-demo]").forEach(function (b) { b.onclick = function () { inp.value = b.dataset.demo; gerar(b.dataset.demo); }; });
})();
