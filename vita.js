/* vita.js — Vita, assistente virtual da Vitrine (chat flutuante para tirar dúvidas da plataforma).
   Perguntas frequentes respondem na hora, sem gastar crédito. Perguntas livres vão para a função "vita"
   (Claude Haiku, resposta curta, limite diário por corretor). Depende de window.Vitrine (app.js). */
(function () {
  "use strict";
  var V = window.Vitrine;
  if (!V) return;

  var AVATAR = '<svg viewBox="0 0 64 64" aria-hidden="true"><defs>' +
    '<linearGradient id="vita-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D4FF3F"/><stop offset="1" stop-color="#5EEAD4"/></linearGradient>' +
    '<clipPath id="vita-clip"><circle cx="32" cy="32" r="32"/></clipPath></defs>' +
    '<g clip-path="url(#vita-clip)"><rect width="64" height="64" fill="url(#vita-bg)"/>' +
    '<path d="M10 64c0-14 9.5-22 22-22s22 8 22 22z" fill="#1F2937"/>' +
    '<path d="M26 40h12v7a6 6 0 0 1-12 0z" fill="#C68B67"/>' +
    '<path d="M15 33c-2-15 6-24 17-24s19 9 17 24c-1 7-3 12-6 15l-1-14H22l-1 14c-3-3-5-8-6-15z" fill="#3B2416"/>' +
    '<ellipse cx="32" cy="31" rx="11" ry="12.5" fill="#D9A07C"/>' +
    '<path d="M20.5 27c3-7 9-9.5 15-8.5 3.5.6 6.5 3 8 7-4-2.5-8-3.5-12-3-4 .4-8 2-11 4.5z" fill="#3B2416"/>' +
    '<ellipse cx="27.5" cy="31" rx="1.4" ry="1.7" fill="#1F1309"/><ellipse cx="36.5" cy="31" rx="1.4" ry="1.7" fill="#1F1309"/>' +
    '<path d="M28.5 37.2c2 1.6 5 1.6 7 0" stroke="#8C3F2B" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    '<circle cx="25" cy="35" r="1.8" fill="#F2A08A" opacity=".5"/><circle cx="39" cy="35" r="1.8" fill="#F2A08A" opacity=".5"/>' +
    '<circle cx="20.5" cy="35" r="1.3" fill="#D4FF3F"/><circle cx="43.5" cy="35" r="1.3" fill="#D4FF3F"/></g></svg>';

  var TELAS = { novo: "Criar carrossel", painel: "Painel", imoveis: "Meus imóveis", instagram: "Instagram", marca: "Minha marca", semana: "Semana pronta", resultados: "Resultados", datas: "Datas especiais", avisos: "Avisos no celular", indique: "Indique e ganhe", plano: "Plano" };

  // dúvidas comuns: resposta pronta (grátis, instantânea)
  var FAQ = [
    { q: "Como crio um carrossel?", a: "É rapidinho! Toque em **Criar carrossel**, escolha um dos 3 caminhos (sugestão da Vitrine, um imóvel seu ou um assunto próprio) e a IA monta os slides. Antes de publicar você vê a prévia e pode trocar as fotos.", ir: "novo" },
    { q: "Como agendo um post?", a: "No **Painel**, toque em **📅 Agendar** no carrossel. Escolha dia, horário e a conta do Instagram. Na hora marcada a Vitrine publica sozinha, mesmo com o app fechado.", ir: "painel" },
    { q: "Como cadastro um imóvel falando?", a: "Em **Meus imóveis**, toque em adicionar. No topo tem o **Cadastro rápido**: toque no microfone, descreva o imóvel, adicione as fotos e toque em **Preencher o cadastro**. Depois é só conferir e salvar.", ir: "imoveis" },
    { q: "Como conecto meu Instagram?", a: "Vá em **Instagram** e toque em conectar. Sua conta precisa ser **profissional** (comercial ou criador de conteúdo). Depois de conectar, os posts agendados saem sozinhos.", ir: "instagram" },
    { q: "O microfone não funciona", a: "No celular, use o Chrome (Android) ou o Safari (iPhone) e permita o microfone quando o navegador pedir. Se mesmo assim não der, toque no campo e use o **🎤 do próprio teclado** do celular: funciona igual." },
    { q: "Como recebo avisos no celular?", a: "Abra **Avisos no celular** e toque em ativar. No iPhone, antes, toque em Compartilhar → **Adicionar à Tela de Início** e abra a Vitrine pelo ícone.", ir: "avisos" }
  ];

  var hist = [];   // { de: "eu"|"vita", txt }
  var aberto = false, enviando = false;

  var css = document.createElement("style");
  css.textContent =
    "#vita-fab{position:fixed;right:18px;bottom:18px;z-index:900;display:flex;align-items:center;gap:8px;padding:5px 14px 5px 5px;border-radius:999px;border:1px solid rgba(212,255,63,.4);background:#111113;color:#fafafa;font:600 13px/1 inherit;cursor:pointer;box-shadow:0 10px 30px -8px rgba(0,0,0,.6),0 0 0 4px rgba(212,255,63,.06);transition:transform .15s;}" +
    "#vita-fab:hover{transform:translateY(-2px);} #vita-fab .vita-av{width:38px;height:38px;}" +
    "#vita-fab .vita-on{position:absolute;left:34px;top:6px;width:9px;height:9px;border-radius:50%;background:#4ADE80;border:2px solid #111113;}" +
    ".vita-av{display:inline-block;border-radius:50%;overflow:hidden;flex:none;} .vita-av svg{width:100%;height:100%;display:block;}" +
    "#vita-box{position:fixed;right:18px;bottom:76px;z-index:901;width:360px;max-width:calc(100vw - 24px);height:520px;max-height:calc(100vh - 100px);display:flex;flex-direction:column;background:#0F0F11;border:1px solid #26262B;border-radius:18px;box-shadow:0 24px 60px -12px rgba(0,0,0,.7);overflow:hidden;}" +
    "#vita-box[hidden]{display:none;}" +
    ".vita-top{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #1F1F23;background:linear-gradient(90deg,rgba(212,255,63,.08),rgba(94,234,212,.04));}" +
    ".vita-top .vita-av{width:40px;height:40px;} .vita-top b{display:block;font-size:15px;} .vita-top small{font-size:11.5px;color:#86efac;}" +
    ".vita-x{margin-left:auto;background:none;border:none;color:#a1a1aa;font-size:22px;line-height:1;cursor:pointer;padding:4px 6px;}" +
    ".vita-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}" +
    ".vita-m{max-width:86%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;}" +
    ".vita-m.vita{align-self:flex-start;background:#1A1A1E;border:1px solid #26262B;border-bottom-left-radius:4px;}" +
    ".vita-m.eu{align-self:flex-end;background:#D4FF3F;color:#0B0B0D;border-bottom-right-radius:4px;}" +
    ".vita-ir{display:inline-block;margin-top:8px;padding:6px 11px;border-radius:999px;border:1px solid rgba(212,255,63,.45);background:rgba(212,255,63,.1);color:#D4FF3F;font:600 12px inherit;cursor:pointer;}" +
    ".vita-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;}" +
    ".vita-chip{padding:6px 10px;border-radius:999px;border:1px solid #2A2A30;background:#141417;color:#d4d4d8;font:500 12px inherit;cursor:pointer;} .vita-chip:hover{border-color:rgba(212,255,63,.5);color:#fff;}" +
    ".vita-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #1F1F23;}" +
    ".vita-form input{flex:1;min-width:0;border:1px solid #2A2A30;border-radius:12px;background:#141417;color:#fafafa;padding:10px 12px;font-size:14px;}" +
    ".vita-form button{border:none;border-radius:12px;background:#D4FF3F;color:#0B0B0D;font-weight:700;padding:0 14px;cursor:pointer;} .vita-form button:disabled{opacity:.5;}" +
    ".vita-digit{display:inline-flex;gap:4px;} .vita-digit i{width:6px;height:6px;border-radius:50%;background:#71717a;animation:vitaD 1s infinite;} .vita-digit i:nth-child(2){animation-delay:.15s;} .vita-digit i:nth-child(3){animation-delay:.3s;}" +
    "@keyframes vitaD{0%,100%{opacity:.3}50%{opacity:1}}" +
    "@media (max-width:560px){#vita-fab{right:12px;bottom:12px;padding:4px;} #vita-fab .vita-lbl{display:none;} #vita-box{right:8px;left:8px;bottom:66px;width:auto;height:70vh;}}";
  document.head.appendChild(css);

  var fab = document.createElement("button");
  fab.id = "vita-fab"; fab.type = "button"; fab.hidden = true;
  fab.setAttribute("aria-label", "Falar com a Vita, assistente da Vitrine");
  fab.innerHTML = '<span class="vita-av">' + AVATAR + '</span><span class="vita-on"></span><span class="vita-lbl">Dúvidas? Fale com a Vita</span>';
  var box = document.createElement("div");
  box.id = "vita-box"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Chat com a Vita");
  box.innerHTML = '<div class="vita-top"><span class="vita-av">' + AVATAR + '</span><div><b>Vita</b><small>● assistente da Vitrine</small></div><button class="vita-x" type="button" aria-label="Fechar">×</button></div>' +
    '<div class="vita-msgs" id="vita-msgs"></div><div class="vita-chips" id="vita-chips"></div>' +
    '<form class="vita-form" id="vita-form"><input id="vita-in" maxlength="500" autocomplete="off" placeholder="Escreva sua dúvida…"><button type="submit" id="vita-env">Enviar</button></form>';
  document.body.appendChild(fab); document.body.appendChild(box);

  var msgsEl = box.querySelector("#vita-msgs"), chipsEl = box.querySelector("#vita-chips");
  var inp = box.querySelector("#vita-in"), env = box.querySelector("#vita-env");

  function fmt(t) { return V.escapeHtml(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
  function add(de, txt, ir) {
    var limpo = String(txt || "").replace(/\[ir:([a-z]+)\]\s*$/i, function (_, t) { if (!ir && TELAS[t]) ir = t; return ""; }).trim();
    hist.push({ de: de, txt: limpo });
    var d = document.createElement("div");
    d.className = "vita-m " + de;
    d.innerHTML = fmt(limpo) + (ir && TELAS[ir] ? '<br><button type="button" class="vita-ir" data-ir="' + ir + '">Abrir ' + TELAS[ir] + ' →</button>' : "");
    msgsEl.appendChild(d);
    var b = d.querySelector("[data-ir]");
    if (b) b.onclick = function () { if (V.showScreen) V.showScreen(b.dataset.ir); if (window.innerWidth < 700) fechar(); };
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return d;
  }
  function chips() {
    chipsEl.innerHTML = FAQ.map(function (f, i) { return '<button type="button" class="vita-chip" data-faq="' + i + '">' + V.escapeHtml(f.q) + '</button>'; }).join("");
    chipsEl.querySelectorAll("[data-faq]").forEach(function (b) {
      b.onclick = function () { var f = FAQ[+b.dataset.faq]; add("eu", f.q); add("vita", f.a, f.ir); };
    });
  }
  function abrir() {
    aberto = true; box.hidden = false;
    if (!msgsEl.children.length) {
      var nome = ((V.state.profile && V.state.profile.nome) || "").split(" ")[0];
      add("vita", "Oi" + (nome ? ", " + nome : "") + "! Eu sou a **Vita** 💚 Te ajudo a usar a Vitrine. Escolha uma dúvida abaixo ou escreva a sua.");
      chips();
    }
    setTimeout(function () { if (window.innerWidth > 700) inp.focus(); }, 50);
  }
  function fechar() { aberto = false; box.hidden = true; }
  fab.onclick = function () { aberto ? fechar() : abrir(); };
  box.querySelector(".vita-x").onclick = fechar;

  box.querySelector("#vita-form").onsubmit = async function (e) {
    e.preventDefault();
    var q = inp.value.trim();
    if (!q || enviando) return;
    inp.value = ""; add("eu", q); chipsEl.innerHTML = "";
    enviando = true; env.disabled = true;
    var dig = document.createElement("div"); dig.className = "vita-m vita"; dig.innerHTML = '<span class="vita-digit"><i></i><i></i><i></i></span>';
    msgsEl.appendChild(dig); msgsEl.scrollTop = msgsEl.scrollHeight;
    try {
      var r = await V.callFunction("vita", { pergunta: q, historico: hist.slice(-7, -1) });
      dig.remove(); add("vita", r.resposta || "Não entendi bem. Pode perguntar de outro jeito?");
    } catch (err) {
      dig.remove(); add("vita", err.message || "Não consegui responder agora. Tente de novo em instantes.");
    } finally { enviando = false; env.disabled = false; }
  };

  // só aparece com o app aberto (depois do login)
  var appView = document.getElementById("app-view");
  function sync() { var on = appView && !appView.hidden; fab.hidden = !on; if (!on) fechar(); }
  if (appView) new MutationObserver(sync).observe(appView, { attributes: true, attributeFilter: ["hidden"] });
  sync();
})();
