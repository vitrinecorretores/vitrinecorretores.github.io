/* voz.js — "Falar em vez de digitar": microfone nos campos de texto da Vitrine.
   Usa o reconhecimento de voz do próprio navegador (Chrome, Edge, Safari/iPhone): não gasta crédito.
   Em navegador sem suporte (ex.: Firefox) o botão simplesmente não aparece.
   Campos: tema livre e "meu próprio assunto" (Criar carrossel), direcionamento pra IA (etapa Conteúdo),
   legendas (agendar / Reels) e diferenciais do imóvel. Novos campos: basta pôr o id em ALVOS
   ou o atributo data-voz-auto no textarea/input. */
(function () {
  "use strict";
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;

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

  function parar() { if (ativo) { try { ativo.rec.stop(); } catch (e) { } } }

  function comecar(ta, btn, dica) {
    var rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    var base = ta.value || "";
    if (base && !/\s$/.test(base)) base += " ";
    var finalTxt = "";
    var ouviu = false;
    ativo = { rec: rec, ta: ta, btn: btn };
    btn.classList.add("on");
    btn.textContent = "Ouvindo… toque para parar";
    if (dica) dica.textContent = "Fale normalmente. O texto aparece no campo.";

    rec.onresult = function (e) {
      var interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var r = e.results[i];
        if (r.isFinal) finalTxt += r[0].transcript; else interim += r[0].transcript;
      }
      ouviu = true;
      var falado = (finalTxt + interim).replace(/^\s+/, "");
      var txt = base ? base + falado : maiuscula(falado);
      if (ta.maxLength > 0) txt = txt.slice(0, ta.maxLength);
      ta.value = txt;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    };
    rec.onerror = function (e) {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") avisar("Libere o microfone para a Vitrine no navegador (ícone de cadeado ao lado do endereço) e tente de novo.");
      else if (e.error === "no-speech") avisar("Não ouvi nada. Toque no microfone e fale perto do aparelho.");
      else if (e.error === "audio-capture") avisar("Não encontrei microfone neste aparelho.");
      else if (e.error === "network") avisar("O reconhecimento de voz precisa de internet. Confira a conexão e tente de novo.");
    };
    rec.onend = function () {
      btn.classList.remove("on");
      btn.textContent = ROTULO;
      if (dica) dica.textContent = ouviu ? "Confira o texto e ajuste se quiser." : "";
      ta.value = ta.value.replace(/\s+$/, "");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
      if (ativo && ativo.rec === rec) ativo = null;
    };
    try { rec.start(); }
    catch (err) { btn.classList.remove("on"); btn.textContent = ROTULO; ativo = null; avisar("Não consegui ligar o microfone: " + err.message); }
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
