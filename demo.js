/* demo.js — "Veja agora, sem cadastro" na página inicial: gera um carrossel de amostra (só texto) pela função
   demo-carrossel (sem login, com limite por aparelho/IP no servidor). Pra publicar, a pessoa cria a conta e o
   assunto já abre pronto no app (localStorage vitrine-demo-tema, lido no app.js). */
(function () {
  "use strict";
  var URL_FN = "https://qbfmozumntequvecttfs.supabase.co/functions/v1/demo-carrossel";
  var KEY = "sb_publishable_xXZFK2Pzq7MHsMv2f_iISw_yriYjMvv";
  var form = document.getElementById("demo-form"); if (!form) return;
  var inp = document.getElementById("demo-assunto"), btn = document.getElementById("demo-btn"), res = document.getElementById("demo-res");
  function esc(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function destaque(s) { return esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>"); }
  var assuntoAtual = "";
  async function gerar(assunto) {
    assuntoAtual = assunto;
    btn.disabled = true; btn.textContent = "Criando…";
    res.hidden = false; res.innerHTML = '<p style="text-align:center;color:var(--ink-muted);">A IA está escrevendo o seu carrossel… (uns 15 segundos)</p>';
    try {
      var r = await fetch(URL_FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY }, body: JSON.stringify({ assunto: assunto }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || !j.slides) throw new Error(j.error || "Não consegui criar agora. Tente de novo em instantes.");
      res.innerHTML = '<div class="lp-demo-strip">' + j.slides.map(function (s, i) {
        return '<div class="lp-demo-slide' + (i === 0 ? " capa" : "") + '"><small>' + esc(s.tag) + '</small><b>' + destaque(s.titulo) + '</b><p>' + esc(s.corpo) + '</p></div>';
      }).join("") + '</div>' +
        '<div class="lp-demo-cta"><span><b>Gostou?</b> Na Vitrine ele ganha fotos reais, sua marca e vai direto pro seu Instagram.</span>' +
        '<button class="btn btn-primary" id="demo-publicar" type="button">Quero publicar este post · 7 dias grátis</button></div>';
      document.getElementById("demo-publicar").onclick = function () {
        try { localStorage.setItem("vitrine-demo-tema", assuntoAtual); } catch (e) { }
        var cta = document.querySelector('[data-cta="signup"]'); if (cta) cta.click();
      };
    } catch (e) { res.innerHTML = '<p style="text-align:center;color:#ff9aab;">' + esc(e.message) + '</p>'; }
    finally { btn.disabled = false; btn.textContent = "Criar meu carrossel"; }
  }
  form.addEventListener("submit", function (e) { e.preventDefault(); var a = inp.value.trim(); if (a.length >= 4) gerar(a); });
  document.querySelectorAll("[data-demo]").forEach(function (b) { b.onclick = function () { inp.value = b.dataset.demo; gerar(b.dataset.demo); }; });
})();
