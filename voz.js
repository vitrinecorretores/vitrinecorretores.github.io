/* voz.js — "Falar em vez de digitar": microfone nos campos de texto da Vitrine.
   Usa o reconhecimento de voz do próprio navegador (Chrome, Edge, Safari/iPhone): não gasta crédito.
   Em navegador sem suporte (ex.: Firefox) o botão simplesmente não aparece.
   Campos: tema livre e "meu próprio assunto" (Criar carrossel), direcionamento pra IA (etapa Conteúdo),
   legendas (agendar / Reels) e diferenciais do imóvel. Novos campos: basta pôr o id em ALVOS
   ou o atributo data-voz-auto no textarea/input. */
(function () {
  "use strict";
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  // celular: o modo contínuo do Android repete frases e o do iPhone para sozinho.
  // Lá a gente grava em "rodadas" curtas e religa até a pessoa tocar pra parar.
  var CELULAR = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

  var ALVOS = ["tema-livre-txt", "custom-topic", "custom-prompt", "ag-leg", "rm-leg", "np-dif"];
  var ROTULO = "🎤 Falar em vez de digitar";
  var ativo = null;   // { rec, ta, btn }

  var css = document.createElement("style");
  css.textContent =
    ".voz-bar{display:flex;align-items:center;gap:8px;margin:6px 0 2px;}" +
    ".voz-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid rgba(212,255,63,.45);" +
    "background:rgba(212,255,63,.08);color:var(--ink,#fafafa);font:600 12.5px/1.2 inherit;cursor:pointer;}" +
    ".voz-btn:hover{background:rgba(212,255,63,.16);}" +
    ".voz-btn.on{border-color:#ff5c5c;background:rgba(255,92,92,.14);color:#ffd6d6;}" +
    ".voz-btn.on::before{content:'';width:8px;height:8px;border-radius:50%;background:#ff5c5c;animation:vozPulso 1s infinite;}" +
    ".voz-dica{font-size:11.5px;color:var(--ink-muted,#a1a1aa);}" +
    "@keyframes vozPulso{0%,100%{opacity:1}50%{opacity:.25}}";
  document.head.appendChild(css);

  function avisar(msg) {
    var V = window.Vitrine;
    if (V && V.toast) V.toast(msg); else console.log(msg);
  }
  function maiuscula(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function parar() { if (ativo) ativo.parar(); }

  function comecar(ta, btn, dica) {
    var base = ta.value || "";
    if (base && !/\s$/.test(base)) base += " ";
    var falado = "";          // tudo que já foi confirmado nas rodadas anteriores
    var ouviu = false, querParar = false, rec = null;
    ativo = { ta: ta, btn: btn, parar: function () { querParar = true; try { rec && rec.stop(); } catch (e) { } } };
    btn.classList.add("on");
    btn.textContent = "Ouvindo… toque para parar";
    if (dica) dica.textContent = "Fale normalmente. O texto aparece no campo.";

    function escrever(parcial) {
      var t = (falado + " " + parcial).replace(/\s+/g, " ").replace(/^\s+/, "");
      var txt = base ? base + t : maiuscula(t);
      if (ta.maxLength > 0) txt = txt.slice(0, ta.maxLength);
      ta.value = txt;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function encerrar() {
      btn.classList.remove("on");
      btn.textContent = ROTULO;
      if (dica) dica.textContent = ouviu ? "Confira o texto e ajuste se quiser." : "";
      ta.value = ta.value.replace(/\s+$/, "");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
      ativo = null;
    }
    function rodada() {
      rec = new SR();
      rec.lang = "pt-BR";
      rec.continuous = !CELULAR;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      var desta = "";
      rec.onresult = function (e) {
        // remonta a partir de TODOS os resultados (evita texto repetido no Android)
        var fin = "", interim = "";
        for (var i = 0; i < e.results.length; i++) {
          var r = e.results[i];
          if (r.isFinal) fin += r[0].transcript + " "; else interim += r[0].transcript;
        }
        // Android às vezes manda o mesmo trecho final cumulativo: fica só com o mais longo
        desta = fin.trim();
        ouviu = true;
        escrever((desta + " " + interim).trim());
      };
      rec.onerror = function (e) {
        if (e.error === "no-speech" || e.error === "aborted") return;   // celular: religa sozinho
        querParar = true;
        if (e.error === "not-allowed" || e.error === "service-not-allowed") avisar("Libere o microfone para a Vitrine nas configurações do navegador e tente de novo. No iPhone: Ajustes → Safari → Microfone.");
        else if (e.error === "audio-capture") avisar("Não encontrei microfone neste aparelho.");
        else if (e.error === "network") avisar("O reconhecimento de voz precisa de internet. Confira a conexão e tente de novo.");
        else if (e.error === "language-not-supported") avisar("Este navegador não reconhece português. Use o microfone do teclado do celular.");
      };
      rec.onend = function () {
        if (desta) falado = (falado + " " + desta).trim();
        escrever("");
        if (!querParar && CELULAR && ativo && document.body.contains(ta)) { try { rodada(); return; } catch (e) { } }
        encerrar();
      };
      try { rec.start(); }
      catch (err) { querParar = true; encerrar(); avisar("Não consegui ligar o microfone: " + err.message); }
    }
    rodada();
  }

  function ligar(ta) {
    if (!ta || ta.dataset.voz === "1" || ta.disabled || ta.readOnly) return;
    ta.dataset.voz = "1";
    var bar = document.createElement("div");
    bar.className = "voz-bar";
    bar.innerHTML = '<button type="button" class="voz-btn" aria-label="Falar em vez de digitar">' + ROTULO + '</button><span class="voz-dica"></span>';
    ta.insertAdjacentElement("afterend", bar);
    var btn = bar.querySelector(".voz-btn"), dica = bar.querySelector(".voz-dica");
    btn.addEventListener("click", function () {
      if (!SR) {
        ta.focus();
        dica.textContent = CELULAR ? "Toque no 🎤 do teclado do celular para ditar." : "Este navegador não tem ditado. Use Chrome, Edge ou Safari.";
        return;
      }
      if (ativo && ativo.ta === ta) { parar(); return; }
      parar();
      comecar(ta, btn, dica);
    });
  }

  function varrer() {
    for (var i = 0; i < ALVOS.length; i++) { var el = document.getElementById(ALVOS[i]); if (el) ligar(el); }
    var extras = document.querySelectorAll("[data-voz-auto]");
    for (var j = 0; j < extras.length; j++) ligar(extras[j]);
    // campo que saiu da tela (modal fechado, passo trocado) com microfone ligado: desliga
    if (ativo && !document.body.contains(ativo.ta)) parar();
  }

  var agendado = false;
  new MutationObserver(function () {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(function () { agendado = false; varrer(); });
  }).observe(document.body, { childList: true, subtree: true });
  varrer();
})();
