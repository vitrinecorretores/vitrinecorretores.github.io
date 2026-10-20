/* Vídeo: Reels do imóvel (canvas + MediaRecorder), roteiro com IA + teleprompter + gravação,
   e legenda automática (Web Speech API). Depende de window.Vitrine (fim do app.js). */
(function () {
  "use strict";
  var V = window.Vitrine;
  if (!V) return;
  var esc = V.escapeHtml, state = V.state;
  var LIMA = "#D4FF3F", FONTE = "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif";
  var W = 1080, H = 1920;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var LEGENDA_OK = !!(SR && !IOS && window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && (window.AudioContext || window.webkitAudioContext));

  function $(id) { return document.getElementById(id); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  /* ---------- estilos ---------- */
  var css = document.createElement("style");
  css.textContent =
    "#vd-root{position:fixed;inset:0;z-index:300;background:#09090B;display:flex;justify-content:center;overflow-y:auto;color:#F4F4F5;font-family:" + FONTE + "}" +
    "#vd-root[hidden]{display:none}" +
    ".vd-card{width:100%;max-width:480px;min-height:100%;padding:16px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box}" +
    ".vd-head{display:flex;justify-content:space-between;align-items:center;gap:8px}" +
    ".vd-head h3{margin:0;font-size:18px}" +
    ".vd-x{background:#18181B;border:1px solid #27272A;color:#F4F4F5;border-radius:8px;width:34px;height:34px;font-size:18px;cursor:pointer}" +
    ".vd-card textarea,.vd-card select,.vd-card input[type=text]{width:100%;box-sizing:border-box;background:#111113;border:1px solid #27272A;color:#F4F4F5;border-radius:8px;padding:10px;font:inherit;font-size:15px}" +
    ".vd-card textarea{min-height:110px;resize:vertical}" +
    ".vd-tabs,.vd-row{display:flex;gap:8px;flex-wrap:wrap}" +
    ".vd-chip{background:#18181B;border:1px solid #27272A;color:#F4F4F5;border-radius:999px;padding:8px 14px;font-size:14px;font-weight:600;cursor:pointer}" +
    ".vd-chip.on{background:" + LIMA + ";color:#0A0A0A;border-color:" + LIMA + "}" +
    ".vd-btn{border:1px solid #27272A;background:#18181B;color:#F4F4F5;border-radius:10px;padding:12px 16px;font-size:15px;font-weight:700;cursor:pointer;flex:1;min-width:120px}" +
    ".vd-btn.pri{background:" + LIMA + ";color:#0A0A0A;border-color:" + LIMA + "}" +
    ".vd-btn:disabled{opacity:.5;cursor:default}" +
    ".vd-hint{font-size:13px;color:#A1A1AA;margin:0}" +
    ".vd-card video.vd-player{width:100%;max-height:68vh;background:#000;border-radius:12px;object-fit:contain}" +
    ".vd-bar{height:8px;background:#27272A;border-radius:6px;overflow:hidden}.vd-bar i{display:block;height:100%;width:0;background:" + LIMA + ";transition:width .2s}" +
    /* gravação: tela cheia */
    ".vd-rec{position:fixed;inset:0;background:#000;z-index:2}" +
    ".vd-rec video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}" +
    ".vd-pr{position:absolute;top:0;left:0;right:0;height:46%;overflow:hidden;background:linear-gradient(rgba(0,0,0,.72),rgba(0,0,0,.55) 75%,rgba(0,0,0,0));padding-top:env(safe-area-inset-top)}" +
    ".vd-pr-t{position:absolute;left:0;right:0;padding:0 22px;text-align:center;font-weight:800;color:#fff;line-height:1.35;text-shadow:0 2px 6px #000;will-change:transform}" +
    ".vd-pr-t p{margin:0 0 .6em}" +
    ".vd-line{position:absolute;left:0;right:0;top:14%;height:2px;background:" + LIMA + ";opacity:.35}" +
    ".vd-ctl{position:absolute;left:0;right:0;bottom:0;padding:12px 14px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.8) 40%);display:flex;flex-direction:column;gap:10px}" +
    ".vd-ctl label{font-size:12px;color:#E4E4E7;display:flex;align-items:center;gap:8px;flex:1}.vd-ctl input[type=range]{flex:1;accent-color:" + LIMA + "}" +
    ".vd-count{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:200px;font-weight:900;color:" + LIMA + ";text-shadow:0 4px 20px #000;z-index:3}" +
    ".vd-timer{position:absolute;top:calc(8px + env(safe-area-inset-top));right:12px;background:rgba(0,0,0,.6);border-radius:999px;padding:4px 10px;font-size:13px;display:none;z-index:3}" +
    ".vd-timer.on{display:block}.vd-timer:before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#f33;margin-right:6px}" +
    ".vd-cta-painel{display:flex;gap:10px;align-items:center;justify-content:space-between;background:#111113;border:1px solid #27272A;border-radius:12px;padding:12px 14px;margin-bottom:14px;flex-wrap:wrap}" +
    ".vd-cta-painel b{font-size:14px}.vd-cta-painel span{font-size:12px;color:#A1A1AA;display:block}";
  document.head.appendChild(css);

  /* ---------- casca em tela cheia ---------- */
  var root = null, urls = [], stream = null, cancelar = null;
  function url(blob) { var u = URL.createObjectURL(blob); urls.push(u); return u; }
  function abrir(html) {
    if (!root) { root = document.createElement("div"); root.id = "vd-root"; document.body.appendChild(root); }
    root.hidden = false; root.scrollTop = 0;
    root.innerHTML = '<div class="vd-card">' + html + '</div>';
    var x = $("vd-x"); if (x) x.onclick = fechar;
  }
  function fechar() {
    if (cancelar) { try { cancelar(); } catch (e) {} cancelar = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (root) { root.hidden = true; root.innerHTML = ""; }
    urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = [];
  }
  function cab(titulo) { return '<div class="vd-head"><h3>' + titulo + '</h3><button class="vd-x" id="vd-x" aria-label="Fechar">✕</button></div>'; }

  /* ---------- utilidades de vídeo ---------- */
  function escolherMime(lista) {
    if (!window.MediaRecorder) return "";
    return lista.find(function (t) { return MediaRecorder.isTypeSupported(t); }) || "";
  }
  var MIME_PRIORIDADE = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  function extDe(type) { return /mp4/.test(type) ? "mp4" : "webm"; }
  function tipoBase(mime, fallback) { return (mime || fallback || "video/webm").split(";")[0]; }
  function gravar(rec) {
    var partes = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) partes.push(e.data); };
    return { partes: partes, parar: function (type) { return new Promise(function (ok) { rec.onstop = function () { ok(new Blob(partes, { type: type })); }; if (rec.state !== "inactive") rec.stop(); else rec.onstop(); }); } };
  }
  function carregarImg(u) {
    return new Promise(function (ok) {
      var i = new Image(); i.crossOrigin = "anonymous";
      var t = setTimeout(function () { ok(null); }, 20000);
      i.onload = function () { clearTimeout(t); ok(i); }; i.onerror = function () { clearTimeout(t); ok(null); };
      i.src = u;
    });
  }
  function cover(ctx, img, zoom, px, py) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var s = Math.max(W / iw, H / ih) * zoom, dw = iw * s, dh = ih * s;
    var x = (W - dw) * (0.5 + px), y = (H - dh) * (0.5 + py);
    ctx.drawImage(img, x, y, dw, dh);
  }
  function quebrar(ctx, texto, maxW) {
    var pal = String(texto).split(/\s+/), linhas = [], at = "";
    pal.forEach(function (p) { var t = at ? at + " " + p : p; if (ctx.measureText(t).width > maxW && at) { linhas.push(at); at = p; } else at = t; });
    if (at) linhas.push(at);
    return linhas;
  }
  // desenha texto centralizado, reduzindo a fonte até caber em maxLinhas; devolve a altura usada
  function texto(ctx, t, cx, y, maxW, tam, minTam, maxLinhas, cor, peso, contorno) {
    var linhas;
    for (; tam >= minTam; tam -= 4) {
      ctx.font = (peso || 800) + " " + tam + "px " + FONTE;
      linhas = quebrar(ctx, t, maxW);
      if (linhas.length <= maxLinhas) break;
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.lineJoin = "round";
    linhas.slice(0, maxLinhas).forEach(function (l, i) {
      var yy = y + i * tam * 1.12;
      if (contorno) { ctx.lineWidth = contorno; ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.strokeText(l, cx, yy); }
      else { ctx.shadowColor = "rgba(0,0,0,.75)"; ctx.shadowBlur = 18; }
      ctx.fillStyle = cor; ctx.fillText(l, cx, yy); ctx.shadowBlur = 0;
    });
    return Math.min(linhas.length, maxLinhas) * tam * 1.12;
  }
  function pilula(ctx, cx, y, w, h, cor) {
    var r = h / 2, x = cx - w / 2;
    ctx.fillStyle = cor; ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function baixar(blob, nome) {
    var a = document.createElement("a"); a.href = url(blob); a.download = nome + "." + extDe(blob.type);
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function compartilhar(blob, nome, textoLeg) {
    var f = new File([blob], nome + "." + extDe(blob.type), { type: blob.type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], text: textoLeg || "" });
      else V.toast("Seu navegador não compartilha arquivos. Use Baixar vídeo.");
    } catch (e) { if (e && e.name !== "AbortError") V.toast("Não consegui compartilhar: " + e.message); }
  }
  var PODE_COMPARTILHAR = !!(navigator.share && navigator.canShare);

  /* ============================================================
     1) REELS DO IMÓVEL
  ============================================================ */
  function especs(p) {
    var l = (Array.isArray(p.diferenciais) ? p.diferenciais : []).map(function (d) { return String(d).trim(); }).filter(Boolean);
    if (p.quartos) l.push(p.quartos + (p.quartos > 1 ? " quartos" : " quarto"));
    if (p.area_m2) l.push(p.area_m2 + " m²");
    if (p.vagas) l.push(p.vagas + (p.vagas > 1 ? " vagas" : " vaga"));
    return l.slice(0, 3);
  }
  async function gerarReels(p, onProg) {
    var fotos = V.fotosDe(p).slice(0, 8);
    var imgs = (await Promise.all(fotos.map(carregarImg))).filter(Boolean);
    if (!imgs.length) throw new Error("Não consegui carregar as fotos do imóvel.");
    var mime = escolherMime(MIME_PRIORIDADE);
    if (!mime || !HTMLCanvasElement.prototype.captureStream) throw new Error("Seu navegador não consegue gerar vídeo. Use o Google Chrome atualizado.");
    var prof = state.profile || {};
    var logo = prof.logo_url && prof.marca_ativa !== false ? await carregarImg(prof.logo_url) : null;
    var n = imgs.length, total = Math.max(15000, Math.min(25000, n * 3200)), por = total / n, FADE = 400;
    var difs = especs(p);
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d");
    var topo = (String(p.tipo || "imóvel") + (p.bairro ? " · " + p.bairro : "")).toUpperCase();
    var preco = V.fmtBRL(p.preco) + (p.finalidade === "aluguel" ? "/mês" : "");
    var rodNome = prof.nome || "", rodCreci = prof.creci ? "CRECI " + String(prof.creci).replace(/^creci[\s:-]*/i, "") : "";

    function foto(i, local) {
      var pr = Math.min(1, local / por), z = i % 2 ? 1.14 - 0.14 * pr : 1 + 0.14 * pr;
      cover(ctx, imgs[i], z, (i % 3 - 1) * 0.12 * (pr - 0.5), 0);
    }
    function alfa(t, ini, fim) { return Math.max(0, Math.min(1, (t - ini) / 250, (fim - t) / 250)); }
    function quadro(t) {
      var i = Math.min(n - 1, Math.floor(t / por)), local = t - i * por;
      ctx.globalAlpha = 1; foto(i, local);
      if (local > por - FADE && i < n - 1) { ctx.globalAlpha = (local - (por - FADE)) / FADE; foto(i + 1, 0); ctx.globalAlpha = 1; }
      var g = ctx.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, "rgba(0,0,0,.65)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 520);
      g = ctx.createLinearGradient(0, 1000, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.45, "rgba(0,0,0,.6)"); g.addColorStop(1, "rgba(0,0,0,.85)");
      ctx.fillStyle = g; ctx.fillRect(0, 1000, W, H - 1000);
      // topo: tipo · bairro
      ctx.font = "800 58px " + FONTE; var w = Math.min(980, ctx.measureText(topo).width + 80);
      pilula(ctx, W / 2, 150, w, 100, LIMA);
      texto(ctx, topo, W / 2, 172, 900, 58, 36, 1, "#0A0A0A", 800);
      // preço
      texto(ctx, preco, W / 2, 1090, 980, 168, 90, 1, "#FFFFFF", 900);
      // diferenciais em sequência, depois o chamado
      var f = t / total, linha = "", cta = false;
      difs.forEach(function (d, k) { var ini = 0.1 + k * 0.25; if (f >= ini && f < ini + 0.23) linha = d; });
      if (f >= 0.84) cta = true;
      if (cta) {
        var a = alfa(t, total * 0.84, total + 1000);
        ctx.globalAlpha = a; pilula(ctx, W / 2, 1330, 900, 150, LIMA);
        texto(ctx, "Chame no direct", W / 2, 1362, 840, 92, 56, 1, "#0A0A0A", 900); ctx.globalAlpha = 1;
      } else if (linha) {
        var ini2 = 0.1 + difs.indexOf(linha) * 0.25;
        ctx.globalAlpha = alfa(t, total * ini2, total * (ini2 + 0.23));
        texto(ctx, "✓ " + linha, W / 2, 1340, 940, 88, 52, 2, LIMA, 800); ctx.globalAlpha = 1;
      }
      // rodapé: logo + nome + CRECI
      var cy = 1650, tx = W / 2, wmax = 960;
      if (logo) {
        var lh = 120, lw = Math.min(260, (logo.naturalWidth / logo.naturalHeight) * lh);
        ctx.drawImage(logo, 60, cy - lh / 2 + 40, lw, lh); wmax = W - 60 - lw - 40 - 60; tx = 60 + lw + 40 + wmax / 2;
      }
      texto(ctx, rodNome, tx, cy, wmax, 54, 34, 1, "#FFFFFF", 800);
      if (rodCreci) texto(ctx, rodCreci, tx, cy + 66, wmax, 38, 28, 1, "#E4E4E7", 600);
    }

    quadro(0);
    var rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8000000 });
    var g = gravar(rec), parar = false;
    cancelar = function () { parar = true; };
    rec.start(250);
    var t0 = performance.now();
    await new Promise(function (fim) {
      (function loop() {
        var t = performance.now() - t0;
        if (parar || t >= total) return fim();
        quadro(t); onProg(Math.min(99, Math.round(t / total * 100)));
        requestAnimationFrame(loop);
      })();
    });
    cancelar = null;
    var blob = await g.parar(tipoBase(rec.mimeType, mime));
    if (parar) return null;
    return blob;
  }

  async function abrirReels(id) {
    var p = state.propriedades.find(function (x) { return x.id === id; });
    if (!p) return;
    if (!V.fotosDe(p).length) { V.toast("Adicione fotos ao imóvel (botão Fotos) para gerar o Reels."); return; }
    abrir(cab("🎬 Reels do imóvel") + '<p class="vd-hint">Gerando o vídeo no seu aparelho. Mantenha esta tela aberta (~20 s).</p><div class="vd-bar"><i id="vd-pb"></i></div><p class="vd-hint" id="vd-pt">Carregando fotos…</p>');
    try {
      var blob = await gerarReels(p, function (n) { var b = $("vd-pb"); if (b) { b.style.width = n + "%"; $("vd-pt").textContent = "Gerando… " + n + "%"; } });
      if (!blob || !root || root.hidden) return;
      var nome = "reels-" + String(p.titulo || "imovel").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
      abrir(cab("🎬 Reels pronto") + '<video class="vd-player" controls playsinline loop autoplay src="' + url(blob) + '"></video>' +
        '<div class="vd-row"><button class="vd-btn pri" id="vd-dl">Baixar vídeo</button>' + (PODE_COMPARTILHAR ? '<button class="vd-btn" id="vd-sh">Compartilhar</button>' : "") + '</div>' +
        '<p class="vd-hint">Formato ' + extDe(blob.type).toUpperCase() + ' 9:16. ' + (extDe(blob.type) === "webm" ? "Se o Instagram não aceitar o WEBM, gere pelo Chrome/Safari que grava MP4." : "Pronto para postar no Instagram.") + '</p>');
      $("vd-dl").onclick = function () { baixar(blob, nome); };
      if ($("vd-sh")) $("vd-sh").onclick = function () { compartilhar(blob, nome, ""); };
    } catch (e) {
      abrir(cab("🎬 Reels do imóvel") + '<p>' + esc(e.message || "Erro ao gerar o vídeo.") + '</p>');
    }
  }

  /* ============================================================
     2) ROTEIRO + TELEPROMPTER
  ============================================================ */
  var fluxo = { modo: "assunto", duracao: 30, assunto: "", propId: "", roteiro: "", legenda: "" };

  function telaEscolha() {
    var props = state.propriedades || [];
    abrir(cab("🎥 Gravar vídeo com roteiro") +
      '<p class="vd-hint">A IA escreve o roteiro, você lê no teleprompter olhando para a câmera.</p>' +
      '<div class="vd-tabs"><button class="vd-chip' + (fluxo.modo === "assunto" ? " on" : "") + '" data-m="assunto">Assunto livre</button><button class="vd-chip' + (fluxo.modo === "imovel" ? " on" : "") + '" data-m="imovel">Um dos meus imóveis</button></div>' +
      (fluxo.modo === "assunto"
        ? '<textarea id="vd-ass" maxlength="300" placeholder="Ex.: 3 erros de quem compra o primeiro imóvel em Fortaleza">' + esc(fluxo.assunto) + '</textarea>'
        : (props.length ? '<select id="vd-prop">' + props.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === fluxo.propId ? " selected" : "") + '>' + esc(p.titulo || p.tipo) + '</option>'; }).join("") + '</select>' : '<p class="vd-hint">Você ainda não tem imóveis cadastrados.</p>')) +
      '<div class="vd-tabs"><button class="vd-chip' + (fluxo.duracao === 30 ? " on" : "") + '" data-d="30">30 segundos</button><button class="vd-chip' + (fluxo.duracao === 60 ? " on" : "") + '" data-d="60">60 segundos</button></div>' +
      '<button class="vd-btn pri" id="vd-gerar" style="flex:none">Gerar roteiro</button>' +
      (LEGENDA_OK ? "" : '<p class="vd-hint">Legenda automática funciona no Chrome.</p>'));
    Array.prototype.forEach.call(root.querySelectorAll("[data-m]"), function (b) { b.onclick = function () { lerEscolha(); fluxo.modo = b.dataset.m; telaEscolha(); }; });
    Array.prototype.forEach.call(root.querySelectorAll("[data-d]"), function (b) { b.onclick = function () { lerEscolha(); fluxo.duracao = +b.dataset.d; telaEscolha(); }; });
    $("vd-gerar").onclick = gerarRoteiro;
  }
  function lerEscolha() {
    if ($("vd-ass")) fluxo.assunto = $("vd-ass").value;
    if ($("vd-prop")) fluxo.propId = $("vd-prop").value;
  }
  async function gerarRoteiro() {
    lerEscolha();
    var corpo = { duracao: fluxo.duracao };
    if (fluxo.modo === "imovel") {
      var p = state.propriedades.find(function (x) { return x.id === (fluxo.propId || (state.propriedades[0] && state.propriedades[0].id)); });
      if (!p) { V.toast("Escolha um imóvel."); return; }
      corpo.propriedade = { tipo: p.tipo, bairro: p.bairro, cidade: p.cidade, preco: p.preco, finalidade: p.finalidade, quartos: p.quartos, area_m2: p.area_m2, diferenciais: p.diferenciais || [] };
    } else {
      if (fluxo.assunto.trim().length < 4) { V.toast("Escreva o assunto do vídeo."); return; }
      corpo.assunto = fluxo.assunto.trim();
    }
    var b = $("vd-gerar"); b.disabled = true; b.textContent = "Escrevendo o roteiro…";
    try {
      var r = await V.callFunction("gerar-roteiro", corpo);
      fluxo.roteiro = [r.gancho, r.roteiro, r.cta].filter(Boolean).join("\n");
      fluxo.legenda = r.legenda || "";
      telaRoteiro();
    } catch (e) { b.disabled = false; b.textContent = "Gerar roteiro"; V.toast(e.message); }
  }
  function telaRoteiro() {
    abrir(cab("Seu roteiro") + '<p class="vd-hint">Edite do seu jeito. Uma frase por linha.</p>' +
      '<textarea id="vd-rot" style="min-height:260px;font-size:17px;line-height:1.4">' + esc(fluxo.roteiro) + '</textarea>' +
      '<p class="vd-hint">Legenda do post (copie na hora de publicar):</p><textarea id="vd-leg" style="min-height:80px">' + esc(fluxo.legenda) + '</textarea>' +
      '<div class="vd-row"><button class="vd-btn" id="vd-volta">Voltar</button><button class="vd-btn pri" id="vd-grav">Ir para a gravação</button></div>');
    $("vd-volta").onclick = telaEscolha;
    $("vd-grav").onclick = function () {
      fluxo.roteiro = $("vd-rot").value.trim(); fluxo.legenda = $("vd-leg").value;
      if (!fluxo.roteiro) { V.toast("O roteiro está vazio."); return; }
      telaGravacao();
    };
  }

  async function telaGravacao() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      abrir(cab("Gravação") + '<p>Seu navegador não permite gravar vídeo aqui. Use o Chrome (Android/computador) ou o Safari atualizado no iPhone.</p>'); return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
    } catch (e) {
      abrir(cab("Gravação") + '<p>Não consegui acessar a câmera e o microfone. Libere a permissão no navegador e tente de novo.</p><button class="vd-btn" id="vd-volta">Voltar</button>');
      $("vd-volta").onclick = telaRoteiro; return;
    }
    var vel = 60, tam = 34;
    abrir('<div class="vd-rec" id="vd-rec"><video id="vd-cam" autoplay muted playsinline></video>' +
      '<div class="vd-pr" id="vd-pr"><div class="vd-pr-t" id="vd-prt"></div><div class="vd-line"></div></div>' +
      '<div class="vd-timer" id="vd-tm">00:00</div><div class="vd-count" id="vd-ct"></div>' +
      '<div class="vd-ctl"><div class="vd-row" style="flex-wrap:nowrap;gap:14px"><label>Velocidade<input type="range" id="vd-vel" min="15" max="220" value="' + vel + '"></label><label>Letra<input type="range" id="vd-tam" min="22" max="60" value="' + tam + '"></label></div>' +
      (LEGENDA_OK ? "" : '<p class="vd-hint" style="text-align:center">Legenda automática funciona no Chrome.</p>') +
      '<div class="vd-row" style="flex-wrap:nowrap"><button class="vd-btn" id="vd-sai">Sair</button><button class="vd-btn" id="vd-pausa" style="display:none">Pausar</button><button class="vd-btn pri" id="vd-ini">Iniciar</button></div></div></div>');
    var cam = $("vd-cam"); cam.srcObject = stream; cam.play().catch(function () {});
    var prt = $("vd-prt"), pr = $("vd-pr");
    fluxo.roteiro.split(/\n+/).forEach(function (l) { var el = document.createElement("p"); el.textContent = l; prt.appendChild(el); });
    var y = 0, rodando = false, gravando = false, ultimo = 0;
    function aplicaTam() { prt.style.fontSize = tam + "px"; }
    function pos() { prt.style.transform = "translateY(" + (pr.clientHeight * 0.14 - y) + "px)"; }
    aplicaTam(); pos();
    // velocidade inicial: percorre o texto em ~ a duração escolhida
    var total = prt.scrollHeight;
    vel = Math.max(15, Math.min(220, Math.round(total / (fluxo.duracao || 30)))); $("vd-vel").value = vel;
    $("vd-vel").oninput = function () { vel = +this.value; };
    $("vd-tam").oninput = function () { tam = +this.value; aplicaTam(); };
    function anim(ts) {
      if (!root || root.hidden || !$("vd-prt")) return;
      if (rodando) { y = Math.min(prt.scrollHeight, y + vel * (ts - ultimo) / 1000); pos(); }
      ultimo = ts; requestAnimationFrame(anim);
    }
    requestAnimationFrame(anim);

    var mime = escolherMime(MIME_PRIORIDADE), rec, g, tIni = 0, timer = null, palavras = [], reco = null;
    $("vd-sai").onclick = fechar;
    $("vd-pausa").onclick = function () { rodando = !rodando; this.textContent = rodando ? "Pausar" : "Retomar"; };
    $("vd-ini").onclick = async function () {
      var btn = this;
      if (!gravando) {
        btn.disabled = true;
        var ct = $("vd-ct"); ct.style.display = "flex";
        for (var k = 3; k >= 1; k--) { ct.textContent = k; await wait(1000); if (!root || root.hidden) return; }
        ct.style.display = "none"; btn.disabled = false;
        rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6000000 } : undefined);
        g = gravar(rec); rec.start(500); tIni = performance.now(); gravando = true; rodando = true; ultimo = performance.now();
        btn.textContent = "Parar"; $("vd-pausa").style.display = ""; $("vd-sai").style.display = "none";
        $("vd-tm").classList.add("on");
        timer = setInterval(function () { var s = Math.floor((performance.now() - tIni) / 1000); $("vd-tm").textContent = pad(Math.floor(s / 60)) + ":" + pad(s % 60); }, 500);
        if (LEGENDA_OK) reco = iniciarFala(tIni, palavras);
        cancelar = function () { gravando = false; clearInterval(timer); if (reco) reco.parar(); try { rec.stop(); } catch (e) {} };
      } else {
        gravando = false; rodando = false; clearInterval(timer); if (reco) reco.parar(); cancelar = null;
        btn.disabled = true; btn.textContent = "Salvando…";
        var blob = await g.parar(tipoBase(rec.mimeType, mime));
        var dur = (performance.now() - tIni) / 1000;
        stream.getTracks().forEach(function (t) { t.stop(); }); stream = null;
        telaPrevia(blob, palavras, dur);
      }
    };
  }

  /* ---------- reconhecimento de fala (legenda) ---------- */
  function iniciarFala(tIni, palavras) {
    var ativo = true, r = null, segIni = null, ultFim = 0;
    function nova() {
      r = new SR(); r.lang = "pt-BR"; r.continuous = true; r.interimResults = true;
      r.onresult = function (e) {
        var agora = (performance.now() - tIni) / 1000;
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (segIni === null) segIni = Math.max(ultFim, agora - 0.4);
          if (!e.results[i].isFinal) continue;
          var ws = e.results[i][0].transcript.trim().split(/\s+/).filter(Boolean);
          var ini = segIni, fim = Math.max(agora, ini + ws.length * 0.2);
          var soma = ws.reduce(function (s, w) { return s + w.length + 2; }, 0), c = ini;
          ws.forEach(function (w) { var d = (fim - ini) * (w.length + 2) / soma; palavras.push({ w: w, t0: c, t1: c + d }); c += d; });
          ultFim = fim; segIni = null;
        }
      };
      r.onerror = function () {};
      r.onend = function () { segIni = null; if (ativo) { try { nova(); } catch (e) {} } };
      try { r.start(); } catch (e) {}
    }
    nova();
    return { parar: function () { ativo = false; try { r.stop(); } catch (e) {} } };
  }

  /* ---------- prévia da gravação + legenda ---------- */
  function telaPrevia(blob, palavras, dur) {
    var nome = "video-vitrine";
    abrir(cab("Seu vídeo") + '<video class="vd-player" controls playsinline src="' + url(blob) + '"></video>' +
      '<div class="vd-row"><button class="vd-btn pri" id="vd-dl">Baixar vídeo</button>' + (PODE_COMPARTILHAR ? '<button class="vd-btn" id="vd-sh">Compartilhar</button>' : "") + '</div>' +
      (LEGENDA_OK
        ? (palavras.length >= 3 ? '<button class="vd-btn" id="vd-leg" style="flex:none">Gerar vídeo com legenda</button><p class="vd-hint">Refaz o vídeo com legenda animada em tempo real (dura o mesmo que o vídeo). Mantenha a tela aberta.</p>'
          : '<p class="vd-hint">Não captei fala suficiente para gerar legenda. Fale mais perto do microfone.</p>')
        : '<p class="vd-hint">Legenda automática funciona no Chrome.</p>') +
      '<div id="vd-lp"></div>' +
      (fluxo.legenda ? '<p class="vd-hint">Legenda do post:</p><textarea readonly>' + esc(fluxo.legenda) + '</textarea>' : "") +
      '<button class="vd-btn" id="vd-de-novo" style="flex:none">Gravar de novo</button>');
    $("vd-dl").onclick = function () { baixar(blob, nome); };
    if ($("vd-sh")) $("vd-sh").onclick = function () { compartilhar(blob, nome, fluxo.legenda); };
    $("vd-de-novo").onclick = telaGravacao;
    if ($("vd-leg")) $("vd-leg").onclick = async function () {
      var b = this; b.disabled = true;
      $("vd-lp").innerHTML = '<div class="vd-bar"><i id="vd-pb"></i></div><p class="vd-hint" id="vd-pt">Preparando…</p>';
      try {
        var out = await gerarLegenda(blob, palavras, function (n) { var el = $("vd-pb"); if (el) { el.style.width = n + "%"; $("vd-pt").textContent = "Gerando vídeo com legenda… " + n + "%"; } });
        if (!out || !root || root.hidden) return;
        abrir(cab("Vídeo com legenda") + '<video class="vd-player" controls playsinline src="' + url(out) + '"></video>' +
          '<div class="vd-row"><button class="vd-btn pri" id="vd-dl2">Baixar vídeo</button>' + (PODE_COMPARTILHAR ? '<button class="vd-btn" id="vd-sh2">Compartilhar</button>' : "") + '</div>' +
          '<button class="vd-btn" id="vd-orig" style="flex:none">Voltar ao vídeo original</button>');
        $("vd-dl2").onclick = function () { baixar(out, nome + "-legenda"); };
        if ($("vd-sh2")) $("vd-sh2").onclick = function () { compartilhar(out, nome + "-legenda", fluxo.legenda); };
        $("vd-orig").onclick = function () { telaPrevia(blob, palavras, dur); };
      } catch (e) { b.disabled = false; $("vd-lp").innerHTML = '<p class="vd-hint">Não consegui gerar a legenda: ' + esc(e.message) + '</p>'; }
    };
  }

  async function gerarLegenda(blob, palavras, onProg) {
    var AC = window.AudioContext || window.webkitAudioContext;
    var vid = document.createElement("video");
    vid.src = url(blob); vid.playsInline = true; vid.preload = "auto";
    await new Promise(function (ok, no) { vid.onloadeddata = ok; vid.onerror = function () { no(new Error("vídeo ilegível")); }; });
    // webm do MediaRecorder não traz duração: força o navegador a calculá-la
    if (!isFinite(vid.duration)) { vid.currentTime = 1e9; await new Promise(function (ok) { vid.onseeked = ok; vid.ontimeupdate = ok; setTimeout(ok, 3000); }); vid.currentTime = 0; await wait(150); }
    var dur = isFinite(vid.duration) ? vid.duration : (palavras.length ? palavras[palavras.length - 1].t1 + 1 : 30);
    var vw = vid.videoWidth || 720, vh = vid.videoHeight || 1280;
    var cv = document.createElement("canvas"); cv.width = 720; cv.height = 1280;   // 720p: leve e suficiente
    var ctx = cv.getContext("2d"), esc2 = cv.width / W;
    var ac = new AC(), dest = ac.createMediaStreamDestination();
    ac.createMediaElementSource(vid).connect(dest);       // áudio vai só pro gravador (não toca no alto-falante)
    await ac.resume();
    var saida = new MediaStream(cv.captureStream(30).getVideoTracks().concat(dest.stream.getAudioTracks()));
    var mime = escolherMime(["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]);
    var rec = new MediaRecorder(saida, mime ? { mimeType: mime, videoBitsPerSecond: 5000000 } : undefined);
    var g = gravar(rec), fim = false;
    cancelar = function () { fim = true; try { vid.pause(); rec.stop(); } catch (e) {} };

    // blocos de 4 palavras (3 a 5)
    var blocos = [], i = 0;
    while (i < palavras.length) {
      var q = palavras.length - i; var k = q <= 5 ? q : 4;
      blocos.push(palavras.slice(i, i + k)); i += k;
    }
    function desenha(t) {
      var s = Math.max(cv.width / vw, cv.height / vh), dw = vw * s, dh = vh * s;
      ctx.drawImage(vid, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
      var b = null;
      for (var j = 0; j < blocos.length; j++) {
        var ini = blocos[j][0].t0, prox = j + 1 < blocos.length ? blocos[j + 1][0].t0 : blocos[j][blocos[j].length - 1].t1 + 0.6;
        if (t >= ini - 0.05 && t < prox) { b = blocos[j]; break; }
      }
      if (!b) return;
      ctx.save(); ctx.scale(esc2, esc2);
      var tam = 96, maxW = 940, linhas;
      for (; tam >= 60; tam -= 4) {
        ctx.font = "900 " + tam + "px " + FONTE;
        linhas = []; var at = [], aw = 0;
        b.forEach(function (p) { var wd = ctx.measureText(p.w.toUpperCase() + " ").width; if (aw + wd > maxW && at.length) { linhas.push(at); at = []; aw = 0; } at.push(p); aw += wd; });
        if (at.length) linhas.push(at);
        if (linhas.length <= 2) break;
      }
      ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.lineJoin = "round"; ctx.lineWidth = tam * 0.16; ctx.strokeStyle = "#000";
      var y0 = 1180;
      linhas.forEach(function (ln, li) {
        var wt = ln.reduce(function (s, p) { return s + ctx.measureText(p.w.toUpperCase() + " ").width; }, 0) - ctx.measureText(" ").width;
        var x = (W - wt) / 2;
        ln.forEach(function (p) {
          var tx = p.w.toUpperCase();
          ctx.strokeText(tx, x, y0 + li * tam * 1.12);
          ctx.fillStyle = (t >= p.t0 && t < p.t1 + 0.05) ? LIMA : "#FFFFFF";
          ctx.fillText(tx, x, y0 + li * tam * 1.12);
          x += ctx.measureText(tx + " ").width;
        });
      });
      ctx.restore();
    }
    desenha(0);
    rec.start(500);
    await vid.play();
    await new Promise(function (ok) {
      vid.onended = ok;
      (function loop() {
        if (fim) return ok();
        var t = vid.currentTime; desenha(t); onProg(Math.min(99, Math.round(t / dur * 100)));
        if (vid.ended) return ok();
        requestAnimationFrame(loop);
      })();
    });
    cancelar = null;
    await wait(300);
    var out = await g.parar(tipoBase(rec.mimeType, mime));
    try { ac.close(); } catch (e) {}
    return fim ? null : out;
  }

  /* ---------- pontos de entrada na interface ---------- */
  function iniciarFluxo() { fluxo.roteiro = ""; telaEscolha(); }

  function injetarCards() {
    Array.prototype.forEach.call(document.querySelectorAll("#prop-grid .prop-acts"), function (ac) {
      if (ac.querySelector("[data-vd-reels]")) return;
      var card = ac.closest(".prop-card"), c = card && card.querySelector("[data-create]");
      if (!c) return;
      var b = document.createElement("button");
      b.className = "btn btn-ghost btn-sm"; b.textContent = "🎬 Reels"; b.setAttribute("data-vd-reels", c.dataset.create);
      b.title = "Gerar um vídeo Reels com as fotos deste imóvel";
      ac.insertBefore(b, ac.firstChild);
    });
  }
  var grid = $("prop-grid");
  if (grid) {
    new MutationObserver(injetarCards).observe(grid, { childList: true });
    grid.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-vd-reels]");
      if (b) abrirReels(b.dataset.vdReels);
    });
    injetarCards();
  }
  function injetarPainel() {
    var tela = $("screen-painel");
    if (!tela || $("vd-painel-cta")) return;
    var d = document.createElement("div"); d.id = "vd-painel-cta"; d.className = "vd-cta-painel";
    d.innerHTML = '<div><b>🎥 Gravar vídeo com roteiro</b><span>A IA escreve, você lê no teleprompter e grava na hora.</span></div><button class="btn btn-primary btn-sm" id="vd-painel-btn">Começar</button>';
    tela.insertBefore(d, tela.firstChild);
    $("vd-painel-btn").onclick = iniciarFluxo;
  }
  var anterior = V.aoMostrar;
  V.aoMostrar = function (nome) {
    if (anterior) anterior(nome);
    if (nome === "painel") injetarPainel();
    if (nome === "imoveis") injetarCards();
  };
  injetarPainel();
  V.video = { reels: abrirReels, roteiro: iniciarFluxo };
})();
