/* Vídeo: Reels do imóvel (3 estilos, canvas + MediaRecorder + música via WebAudio),
   gravação estilo câmera com roteiro/teleprompter e legenda automática (Web Speech API).
   Depende de window.Vitrine (fim do app.js). */
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
  var VOZ_OK = !!(SR && !IOS);

  function $(id) { return document.getElementById(id); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function c01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  /* ---------- preferências (localStorage com try/catch) ---------- */
  var PREF_KEY = "vd-prefs-v2";
  var prefs = { v2: true, facing: "user", res: "1080", fonte: 34, vel: 1, larg: 100, fundo: 55, espTxt: false, grade: false, voz: false, contagem: true, atraso: 0 };
  try { var salvo = JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); if (salvo && !salvo.v2) { delete salvo.res; salvo.v2 = true; }   /* v2: padrão passou a 1080p */ if (salvo && typeof salvo === "object") Object.keys(prefs).forEach(function (k) { if (salvo[k] !== undefined && typeof salvo[k] === typeof prefs[k]) prefs[k] = salvo[k]; }); } catch (e) {}
  function salvarPrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} }

  /* ---------- estilos ---------- */
  var css = document.createElement("style");
  css.textContent = [
    "#vd-root{position:fixed;inset:0;z-index:300;background:#09090B;display:flex;justify-content:center;overflow-y:auto;color:#F4F4F5;font-family:" + FONTE + "}",
    "#vd-root[hidden]{display:none}#vd-root.cheio{overflow:hidden;background:#000}",
    ".vd-card{width:100%;max-width:480px;min-height:100%;padding:16px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box}",
    ".vd-head{display:flex;justify-content:space-between;align-items:center;gap:8px}",
    ".vd-head h3{margin:0;font-size:18px}",
    ".vd-x{background:#18181B;border:1px solid #27272A;color:#F4F4F5;border-radius:8px;width:34px;height:34px;font-size:18px;cursor:pointer}",
    ".vd-card textarea,.vd-card select,.vd-card input[type=text]{width:100%;box-sizing:border-box;background:#111113;border:1px solid #27272A;color:#F4F4F5;border-radius:8px;padding:10px;font:inherit;font-size:15px}",
    ".vd-card textarea{min-height:110px;resize:vertical}",
    ".vd-tabs,.vd-row{display:flex;gap:8px;flex-wrap:wrap}",
    ".vd-chip{background:#18181B;border:1px solid #27272A;color:#F4F4F5;border-radius:999px;padding:8px 14px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}",
    ".vd-chip.on{background:" + LIMA + ";color:#0A0A0A;border-color:" + LIMA + "}",
    ".vd-btn{border:1px solid #27272A;background:#18181B;color:#F4F4F5;border-radius:10px;padding:12px 16px;font-size:15px;font-weight:700;cursor:pointer;flex:1;min-width:120px;font-family:inherit}",
    ".vd-btn.pri{background:" + LIMA + ";color:#0A0A0A;border-color:" + LIMA + "}",
    ".vd-btn:disabled{opacity:.5;cursor:default}",
    ".vd-hint{font-size:13px;color:#A1A1AA;margin:0;line-height:1.4}",
    ".vd-card video.vd-player{width:100%;max-height:68vh;background:#000;border-radius:12px;object-fit:contain}",
    ".vd-bar{height:8px;background:#27272A;border-radius:6px;overflow:hidden}.vd-bar i{display:block;height:100%;width:0;background:" + LIMA + ";transition:width .2s}",
    ".vd-cta-painel{display:flex;gap:10px;align-items:center;justify-content:space-between;background:#111113;border:1px solid #27272A;border-radius:12px;padding:12px 14px;margin-bottom:14px;flex-wrap:wrap}",
    ".vd-cta-painel b{font-size:14px}.vd-cta-painel span{font-size:12px;color:#A1A1AA;display:block}",
    ".vd-op{background:#111113;border:1px solid #27272A;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}.vd-op b{font-size:15px}.vd-op em{font-style:normal;font-size:11px;color:#0A0A0A;background:" + LIMA + ";border-radius:999px;padding:2px 8px;margin-left:6px;font-weight:700}",
    ".vd-op.dest{border-color:" + LIMA + ";box-shadow:0 0 0 1px " + LIMA + " inset}",
    ".vd-rg{display:flex;align-items:center;gap:10px;font-size:14px;margin:6px 0}.vd-rg span{width:104px;flex:none}.vd-rg input[type=range]{flex:1;accent-color:" + LIMA + "}.vd-rg em{background:none;color:#A1A1AA;font-weight:400;width:44px;text-align:right;padding:0;margin:0}.vd-rg select{flex:1}",
    ".lt .cm-top{z-index:5}.lt-bar{position:absolute;left:0;right:0;bottom:0;display:flex;gap:8px;justify-content:center;align-items:center;padding:12px 12px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.75));z-index:5;flex-wrap:wrap}.lt-bar button{min-width:44px;height:44px;border-radius:12px;border:0;background:rgba(255,255,255,.16);font-size:18px;font-weight:700;cursor:pointer}.lt-bar button.on{background:" + LIMA + ";color:#0A0A0A}.lt-bar span{font-size:14px;font-weight:700;min-width:44px;text-align:center}",
    /* editor de Reels */
    ".rl-pv{align-self:center;height:min(52vh,560px);aspect-ratio:9/16;background:#000;border-radius:16px;overflow:hidden;position:relative;border:1px solid #27272A;flex:none}",
    ".rl-pv canvas{width:100%;height:100%;display:block}",
    ".rl-est{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
    ".rl-e{background:#18181B;border:1px solid #27272A;color:#F4F4F5;border-radius:12px;padding:10px 8px;text-align:left;cursor:pointer;font-family:inherit}",
    ".rl-e b{display:block;font-size:15px}.rl-e span{display:block;font-size:11px;color:#A1A1AA;margin-top:2px;line-height:1.3}",
    ".rl-e.on{border-color:" + LIMA + ";box-shadow:0 0 0 1px " + LIMA + " inset}.rl-e.on b{color:" + LIMA + "}",
    ".rl-ov{position:absolute;inset:0;background:rgba(0,0,0,.45);overflow:hidden}.rl-ovt{position:absolute;left:0;right:0;padding:0 14px;text-align:center;font-weight:900;font-size:21px;line-height:1.3;text-shadow:0 2px 6px #000;white-space:pre-line}.rl-ovc{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:120px;font-weight:900;color:" + LIMA + "}.rl-ovb{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:2}.rl-rec{display:inline-block;width:9px;height:9px;border-radius:50%;background:#FF3B30;margin-right:6px}",
    ".rl-chips{display:flex;flex-wrap:wrap;gap:8px}.rl-c{background:#18181B;border:1px solid #27272A;color:#F4F4F5;border-radius:999px;padding:8px 13px;font-size:14px;cursor:pointer;font-family:inherit;line-height:1.1}",
    ".rl-c.on{background:rgba(212,255,63,.14);border-color:" + LIMA + ";box-shadow:0 0 0 1px " + LIMA + " inset;color:" + LIMA + "}.rl-c.on::after{content:' ✓'}",
    ".rl-cor{width:36px;height:36px;border-radius:50%;border:2px solid #27272A;cursor:pointer;position:relative;padding:0}.rl-cor.on{border-color:#fff;box-shadow:0 0 0 3px " + LIMA + "}.rl-cor.on::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:900;color:#0A0A0A;text-shadow:0 0 3px #fff}",
    ".rl-lb{font-size:12px;color:#A1A1AA;font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-bottom:-6px}",
    ".rl-sticky{position:sticky;bottom:0;background:linear-gradient(rgba(9,9,11,0),#09090B 30%);padding:14px 0 calc(6px + env(safe-area-inset-bottom));margin-top:auto}",
    /* câmera */
    ".cm{position:fixed;inset:0;background:#000;color:#fff;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}",
    ".cm button{font-family:inherit;color:inherit;-webkit-tap-highlight-color:transparent}",
    ".cm-v{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
    ".cm-v.esp{transform:scaleX(-1)}",
    ".cm-zi{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);background:rgba(0,0,0,.55);color:#fff;font-size:22px;font-weight:800;padding:8px 18px;border-radius:999px;opacity:0;transition:opacity .25s;pointer-events:none;z-index:6}",
    ".cm-zi.on{opacity:1}",
    ".cm-grade{position:absolute;inset:0;pointer-events:none;display:none;background:linear-gradient(90deg,transparent 33.2%,rgba(255,255,255,.35) 33.3%,transparent 33.5%,transparent 66.5%,rgba(255,255,255,.35) 66.6%,transparent 66.8%),linear-gradient(0deg,transparent 33.2%,rgba(255,255,255,.35) 33.3%,transparent 33.5%,transparent 66.5%,rgba(255,255,255,.35) 66.6%,transparent 66.8%)}",
    ".cm-grade.on{display:block}",
    ".cm-top{position:absolute;top:0;left:0;right:0;padding:calc(10px + env(safe-area-inset-top)) 12px 18px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,0));z-index:5}",
    ".cm-tb{display:flex;gap:8px}",
    ".cm-ic{width:42px;height:42px;border-radius:50%;border:0;background:rgba(0,0,0,.42);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}",
    ".cm-ic svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".cm-ic.on{background:" + LIMA + ";color:#0A0A0A}",
    ".cm-ic[hidden]{display:none}",
    ".cm-tm{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;background:rgba(0,0,0,.45);border-radius:999px;padding:6px 12px;display:flex;align-items:center;gap:7px;visibility:hidden}",
    ".cm-tm.on{visibility:visible}.cm-tm:before{content:'';width:9px;height:9px;border-radius:50%;background:#FF3B30;animation:cm-blink 1s infinite}",
    "@keyframes cm-blink{50%{opacity:.25}}",
    /* teleprompter */
    ".cm-tp{position:absolute;top:calc(64px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);height:36%;border-radius:16px;overflow:hidden;z-index:3;touch-action:none;-webkit-mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(transparent,#000 12%,#000 88%,transparent)}",
    ".cm-tpf{position:absolute;inset:0}",
    ".cm-tpl{position:absolute;left:0;right:0;border-left:4px solid " + LIMA + ";background:rgba(212,255,63,.13);pointer-events:none}",
    ".cm-tpt{position:absolute;left:0;right:0;padding:0 20px;text-align:center;font-weight:800;line-height:1.38;text-shadow:0 2px 6px rgba(0,0,0,.9);will-change:transform;transform-origin:50% 0}",
    ".cm-tpt p{margin:0 0 .55em;color:rgba(255,255,255,.55);transition:color .2s}.cm-tpt p.on{color:#fff}",
    ".cm-tpt span.d{color:rgba(255,255,255,.4)}",
    ".cm-pausa{position:absolute;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top) + 36% + 8px);background:rgba(0,0,0,.6);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;z-index:4;display:none}",
    ".cm-pausa.on{display:block}",
    ".cm-side{position:absolute;right:10px;top:46%;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:5;background:rgba(0,0,0,.42);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:26px;padding:6px}",
    ".cm-side button{width:42px;height:42px;border-radius:50%;border:0;background:rgba(255,255,255,.14);font-size:24px;font-weight:700;line-height:1;cursor:pointer;padding:0}",
    ".cm-side span{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}",
    ".cm-bot{position:absolute;left:0;right:0;bottom:0;padding:40px 16px calc(18px + env(safe-area-inset-bottom));background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.6));display:flex;flex-direction:column;align-items:center;gap:16px;z-index:5}",
    ".cm-zoom{display:flex;gap:6px;background:rgba(0,0,0,.42);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:999px;padding:4px}",
    ".cm-zoom:empty{display:none}",
    ".cm-zoom button{min-width:40px;height:34px;border-radius:999px;border:0;background:transparent;font-size:13px;font-weight:700;cursor:pointer;padding:0 8px}",
    ".cm-zoom button.on{background:" + LIMA + ";color:#0A0A0A}",
    ".cm-shut{width:100%;display:flex;align-items:center;justify-content:space-between}",
    ".cm-shut .cm-ic{width:48px;height:48px}",
    ".cm-rec{width:80px;height:80px;border-radius:50%;border:4px solid #fff;background:transparent;padding:5px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s}",
    ".cm-rec:active{transform:scale(.94)}",
    ".cm-rec i{display:block;width:100%;height:100%;border-radius:50%;background:#FF3B30;transition:all .25s cubic-bezier(.3,1.4,.5,1)}",
    ".cm-rec.on i{width:46%;height:46%;border-radius:10px}",
    ".cm-count{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:6;pointer-events:none}",
    ".cm-count.on{display:flex;background:rgba(0,0,0,.28)}",
    ".cm-count b{font-size:220px;font-weight:900;color:" + LIMA + ";text-shadow:0 6px 30px rgba(0,0,0,.6);animation:cm-pop 1s cubic-bezier(.2,.9,.3,1) forwards}",
    "@keyframes cm-pop{0%{transform:scale(1.9);opacity:0}25%{transform:scale(1);opacity:1}80%{opacity:1}100%{transform:scale(.7);opacity:0}}",
    ".cm-sheet{position:absolute;left:0;right:0;bottom:0;max-height:72%;overflow-y:auto;background:rgba(14,14,16,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:20px 20px 0 0;padding:14px 16px calc(16px + env(safe-area-inset-bottom));z-index:8;box-sizing:border-box}",
    ".cm-sheet[hidden]{display:none}",
    ".cm-sheet h4{margin:14px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#A1A1AA}.cm-sheet h4:first-child{margin-top:0}",
    ".cm-sheet .vd-row{margin-bottom:6px}",
    ".cm-rg{display:flex;align-items:center;gap:10px;font-size:14px;margin:8px 0}.cm-rg span{width:104px;flex:none}.cm-rg input{flex:1;accent-color:" + LIMA + "}",
    ".cm-rg em{font-style:normal;width:44px;text-align:right;font-size:12px;color:#A1A1AA;font-variant-numeric:tabular-nums}"
  ].join("");
  document.head.appendChild(css);

  /* ---------- casca em tela cheia ---------- */
  var root = null, urls = [], stream = null, cancelar = null, pararPrevia = function () {}, destravarTela = null;
  function url(blob) { var u = URL.createObjectURL(blob); urls.push(u); return u; }
  function garantirRoot() {
    if (!root) { root = document.createElement("div"); root.id = "vd-root"; document.body.appendChild(root); }
    root.hidden = false; root.scrollTop = 0;
  }
  function abrir(html) {
    pararPrevia(); garantirRoot();
    root.className = "";
    root.innerHTML = '<div class="vd-card">' + html + '</div>';
    var x = $("vd-x"); if (x) x.onclick = fechar;
  }
  function abrirCheia(html) {
    pararPrevia(); garantirRoot();
    root.className = "cheio";
    root.innerHTML = html;
  }
  function fechar() {
    pararPrevia();
    if (cancelar) { try { cancelar(); } catch (e) {} cancelar = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (destravarTela) { try { destravarTela(); } catch (e) {} destravarTela = null; }
    if (root) { root.hidden = true; root.innerHTML = ""; root.className = ""; }
    urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = [];
  }
  function cab(titulo) { return '<div class="vd-head"><h3>' + titulo + '</h3><button class="vd-x" id="vd-x" aria-label="Fechar">✕</button></div>'; }

  /* ---------- utilidades de vídeo ---------- */
  function escolherMime(lista) {
    if (!window.MediaRecorder) return "";
    return lista.find(function (t) { return MediaRecorder.isTypeSupported(t); }) || "";
  }
  var MIME_PRIORIDADE = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.4D401F,mp4a.40.2", "video/mp4", "video/webm;codecs=h264,opus", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
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
  // Instagram só aceita MP4 normal: reorganiza o MP4 fragmentado do gravador (sem recomprimir)
  async function mp4Normal(blob) {
    if (!/mp4/i.test(blob.type || "") || !V.remuxMp4) return blob;
    try { return new Blob([V.remuxMp4(new Uint8Array(await blob.arrayBuffer()))], { type: "video/mp4" }); }
    catch (e) { console.warn("remux:", e); return blob; }
  }
  function podeAgendar(blob) { return !!(V.agendarVideoNovo && /mp4/i.test((blob && blob.type) || "")); }
  async function agendarGravado(blob) {
    var b = await mp4Normal(blob);
    var ttl = fluxo.modo === "imovel" ? ((state.propriedades || []).find(function (x) { return x.id === fluxo.propId; }) || {}).titulo : fluxo.assunto;
    fechar(); V.agendarVideoNovo(b, { titulo: (ttl || "Vídeo").slice(0, 120), legenda: fluxo.legenda || "", propriedade_id: fluxo.modo === "imovel" ? (fluxo.propId || null) : null });
  }

  /* ============================================================
     1) REELS DO IMÓVEL — motor de renderização
  ============================================================ */
  var EZ = {
    io3: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    o3: function (t) { return 1 - Math.pow(1 - t, 3); },
    o5: function (t) { return 1 - Math.pow(1 - t, 5); },
    oExp: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    oBack: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  };
  var SERIF = "'Cormorant Garamond','Playfair Display',Georgia,'Times New Roman',serif";
  // personalização do Reels (o corretor escolhe; vazio = o padrão do estilo)
  var FONTES_RL = {
    geist: { nome: "Geist", css: FONTE, peso: 900 },
    anton: { nome: "Anton", css: "Anton, Impact, 'Arial Narrow', sans-serif", peso: 400 },
    bricolage: { nome: "Bricolage", css: "'Bricolage Grotesque', Geist, sans-serif", peso: 800 },
    playfair: { nome: "Playfair", css: "'Playfair Display', Georgia, serif", peso: 800 },
    poppins: { nome: "Poppins", css: "Poppins, Geist, sans-serif", peso: 800 },
    unbounded: { nome: "Unbounded", css: "Unbounded, Geist, sans-serif", peso: 700 },
    space: { nome: "Space Grotesk", css: "'Space Grotesk', Geist, sans-serif", peso: 700 }
  };
  var CORES_RL = {
    lima: { nome: "Lima", hex: "#D4FF3F", txt: "#0A0A0A" }, branco: { nome: "Branco", hex: "#FFFFFF", txt: "#0A0A0A" },
    dourado: { nome: "Dourado", hex: "#E6C98F", txt: "#1A1408" }, rosa: { nome: "Rosa", hex: "#FF5FA2", txt: "#FFFFFF" },
    azul: { nome: "Azul", hex: "#4FC3FF", txt: "#04121C" }, laranja: { nome: "Laranja", hex: "#FF8A3D", txt: "#160A02" },
    verde: { nome: "Verde", hex: "#3DDC97", txt: "#04140C" }
  };
  var LAYOUTS_RL = {
    padrao: { nome: "Do estilo", desc: "painéis com os dados" }, centro: { nome: "Centro", desc: "frase gigante no meio" },
    faixa: { nome: "Faixa", desc: "faixa colorida na tela" }, caixa: { nome: "Marca-texto", desc: "frase em caixas" },
    esquerda: { nome: "Topo", desc: "título grande à esquerda" }, legenda: { nome: "Legenda", desc: "palavra por palavra embaixo" }
  };
  // trilhas instrumentais próprias da Vitrine (compostas por código em trilhas.js): sem direitos autorais, sem crédito
  var TRILHAS = [
    { id: "leve", nome: "Leve e positiva", desc: "pop acústico" }, { id: "lofi", nome: "Lo-fi tranquilo", desc: "calma" },
    { id: "house", nome: "House elegante", desc: "alto padrão" }, { id: "animada", nome: "Animada", desc: "anúncio com energia" },
    { id: "cinema", nome: "Cinematográfica", desc: "lançamento, luxo" }, { id: "corporativa", nome: "Corporativa", desc: "institucional" }
  ];
  // arquivos gerados uma vez com trilhas.js (no repositório) e guardados no Storage público da Vitrine
  var TRILHAS_URL = "https://qbfmozumntequvecttfs.supabase.co/storage/v1/object/public/slides-render/f13c2703-8848-485a-ae60-97e139a2b0a6/trilhas/";
  var trilhaCache = {};
  function carregarTrilha(id) {
    if (!trilhaCache[id]) trilhaCache[id] = fetch(TRILHAS_URL + id + ".wav").then(function (r) {
      if (!r.ok) throw new Error("Não consegui baixar a trilha.");
      return r.blob();
    }).then(function (b) { return new File([b], "trilha-" + id + ".wav", { type: "audio/wav" }); })
      .catch(function (e) { delete trilhaCache[id]; throw e; });
    return trilhaCache[id];
  }
  window.VitrineMusicas = { lista: TRILHAS, carregar: function (id) { return carregarTrilha(id); }, nome: function (id) { return nomeTrilha(id); } };
  function nomeTrilha(id) { var x = TRILHAS.find(function (t) { return t.id === id; }); return x ? x.nome : ""; }
  function carregarFonte(id) { var f = FONTES_RL[id]; if (!f || !document.fonts || !document.fonts.load) return Promise.resolve(); return document.fonts.load(f.peso + " 80px " + f.css.split(",")[0]).catch(function () {}); }
  var ESTILOS = {
    luxo: { nome: "Luxo", desc: "Lento e elegante, tons quentes", bpm: 80, beats: 4, tr: 0.9, trans: ["dissolve"], fonte: SERIF, peso: 500, acc: "#E6C98F", accTxt: "#1A1408", anim: "mask", grao: true, quente: 0.07, vig: 0.5, pulse: false, mov: EZ.io3, painel: "rgba(22,15,8,.58)" },
    moderno: { nome: "Moderno", desc: "Dinâmico, cortes no ritmo", bpm: 120, beats: 3, tr: 0.42, trans: ["slide", "zoom", "flash", "dissolve"], fonte: FONTE, peso: 900, acc: LIMA, accTxt: "#0A0A0A", anim: "words", grao: false, quente: 0, vig: 0.35, pulse: true, mov: EZ.o3, painel: "rgba(10,10,12,.68)" },
    direto: { nome: "Direto", desc: "Rápido, preço em destaque", bpm: 100, beats: 2, tr: 0.2, trans: ["dissolve", "slide"], fonte: FONTE, peso: 900, acc: LIMA, accTxt: "#0A0A0A", anim: "words", grao: false, quente: 0, vig: 0.3, pulse: false, mov: EZ.o3, painel: "rgba(10,10,12,.7)" },
    cinetico: { nome: "Motion", desc: "Texto gigante animado, frase por frase", bpm: 110, beats: 2, tr: 0.3, trans: ["zoom", "flash", "slide"], fonte: FONTE, peso: 900, acc: LIMA, accTxt: "#0A0A0A", anim: "words", grao: false, quente: 0, vig: 0.55, pulse: true, mov: EZ.o3, painel: "rgba(10,10,12,.7)" }
  };
  // movimentos de câmera nas fotos: z = [início, fim] de zoom; x/y = deslocamento (fração da sobra da foto)
  var MOV = [
    { z: [1.0, 1.17], x: [0, 0], y: [0, 0] },
    { z: [1.17, 1.02], x: [-0.3, 0.3], y: [0, 0] },
    { z: [1.04, 1.15], x: [0.38, -0.38], y: [0.05, -0.05] },
    { z: [1.16, 1.0], x: [0, 0], y: [0.3, -0.3] },
    { z: [1.0, 1.13], x: [-0.3, 0.2], y: [-0.25, 0.25] },
    { z: [1.1, 1.1], x: [-0.42, 0.42], y: [0, 0] }
  ];

  function cover(ctx, img, zoom, px, py) {
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    var s = Math.max(W / iw, H / ih) * zoom, dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (W - dw) * (0.5 + px), (H - dh) * (0.5 + py), dw, dh);
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function quebrar(ctx, texto, maxW) {
    var pal = String(texto).split(/\s+/), linhas = [], at = "";
    pal.forEach(function (p) { var t = at ? at + " " + p : p; if (ctx.measureText(t).width > maxW && at) { linhas.push(at); at = p; } else at = t; });
    if (at) linhas.push(at);
    return linhas;
  }
  // reduz a fonte até caber em maxLinhas; devolve {tam, linhas}
  function ajustar(ctx, t, maxW, tam, min, maxLinhas, peso, fonte) {
    var linhas = [], usado = min;
    for (; tam >= min; tam -= 4) {
      usado = tam; ctx.font = peso + " " + tam + "px " + fonte;
      linhas = quebrar(ctx, t, maxW);
      if (linhas.length <= maxLinhas) break;
    }
    return { tam: usado, linhas: linhas.slice(0, maxLinhas) };
  }
  /* texto animado. o: x,y,tam,peso,fonte,cor,alin,t,t0,modo(fade|mask|words),stag,dur,fim,esp (espaçamento de letras) */
  function bloco(ctx, linhas, o) {
    var lh = o.tam * (o.lh || 1.12), base = ctx.globalAlpha, idx = 0;
    var ao = o.fim != null ? c01((o.fim - o.t) / 0.28) : 1;
    if (ao <= 0 || o.t < o.t0) return lh * linhas.length;
    ctx.save();
    ctx.font = o.peso + " " + o.tam + "px " + o.fonte; ctx.textBaseline = "top"; ctx.textAlign = "left";
    if ("letterSpacing" in ctx) ctx.letterSpacing = (o.esp || 0) + "px";
    ctx.fillStyle = o.cor; ctx.lineJoin = "round";
    linhas.forEach(function (l, li) {
      var pals = o.modo === "words" ? l.split(" ") : [l];
      var sp = ctx.measureText(" ").width, ws = pals.map(function (w) { return ctx.measureText(w).width; });
      var tw = ws.reduce(function (s, w) { return s + w; }, 0) + sp * (pals.length - 1);
      var cx = o.alin === "left" ? o.x : o.x - tw / 2, yl = o.y + li * lh;
      pals.forEach(function (w, wi) {
        var k = o.modo === "words" ? idx : li; idx++;
        var q = c01((o.t - o.t0 - k * o.stag) / o.dur), e = EZ.o5(q);
        if (e > 0.003) {
          ctx.save();
          ctx.globalAlpha = base * ao * (o.modo === "mask" ? 1 : e);
          if (o.modo === "mask") {
            ctx.beginPath(); ctx.rect(cx - 12, yl - lh * 0.05, ws[wi] + 24, lh * 1.1); ctx.clip();
            ctx.translate(0, (1 - e) * lh * 0.9);
          } else ctx.translate(0, (1 - e) * (o.modo === "words" ? 46 : 30));
          if (o.sombra !== false) { ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 5; }
          ctx.fillText(w, cx, yl);
          ctx.restore();
        }
        cx += ws[wi] + sp;
      });
    });
    ctx.restore();
    return lh * linhas.length;
  }

  function curto(v) {
    v = +v; if (!v) return "";
    if (v >= 1e6) return "R$ " + String(Math.round(v / 1e4) / 100).replace(".", ",") + " mi";
    if (v >= 1000) return "R$ " + String(Math.round(v / 100) / 10).replace(".", ",") + " mil";
    return "R$ " + v;
  }
  function maiusc(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function telFmt(t) {
    var d = String(t || "").replace(/\D/g, ""); if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return t ? String(t) : "";
  }
  function hookPadrao(p, key) {
    var onde = p.bairro || p.cidade || "", tipo = String(p.tipo || "imóvel").toLowerCase();
    var difs = (Array.isArray(p.diferenciais) ? p.diferenciais : []).map(function (d) { return String(d).trim(); }).filter(function (d) { return d && d.length <= 24; });
    var dif = difs[0] ? " com " + difs[0].charAt(0).toLowerCase() + difs[0].slice(1) : "";
    var local = onde ? " em " + onde : "";
    var preco = curto(p.preco) + (p.finalidade === "aluguel" ? "/mês" : "");
    if (key === "direto") return (preco ? preco : maiusc(tipo)) + local + " — olha isso";
    if (key === "luxo") return "Exclusividade: " + maiusc(tipo) + local;
    if (key === "cinetico") return maiusc(tipo) + local + " — " + (dif ? dif.slice(5) : "olha isso");
    return "Acabou de entrar: " + tipo + local + dif;
  }
  function parseHook(h) {
    h = String(h || "").trim();
    var i = h.indexOf(":");
    if (i > 0 && i < h.length - 1) return { kicker: h.slice(0, i).trim(), main: h.slice(i + 1).trim(), sub: "" };
    var m = h.split(/\s[—–-]\s/);
    if (m.length > 1) return { kicker: "", main: m[0].trim(), sub: m.slice(1).join(" — ").trim() };
    return { kicker: "", main: h, sub: "" };
  }

  /* d: {imgs[], logo, avatar, p, prof, hook, itens}. Devolve {total, draw(t)} — desenha em coordenadas 1080x1920 */
  function criarRenderer(ctx, d, key, escala) {
    var E = Object.assign({}, ESTILOS[key]), beat = 60 / E.bpm, shotDur = E.beats * beat, n = d.imgs.length;
    var FX = (d.fonte && FONTES_RL[d.fonte]) || null, CX = (d.cor && CORES_RL[d.cor]) || null;
    var FT = FX ? FX.css : FONTE, PE = FX ? FX.peso : 900, FS = FX ? FX.css : SERIF;
    if (FX) E.fonte = FX.css;
    if (CX) { E.acc = CX.hex; E.accTxt = CX.txt; }
    var LAY = d.layout && LAYOUTS_RL[d.layout] && d.layout !== "padrao" ? d.layout : (key === "cinetico" ? "centro" : "");
    var outro = Math.ceil(3.2 / beat) * beat;
    function tot(k) { return k * shotDur + outro; }
    var nShots = n;
    while (tot(nShots) < 15 && nShots < Math.max(n * 4, 14) && tot(nShots + 1) <= 30) nShots++;
    while (tot(nShots) > 30 && nShots > 3) nShots--;
    var total = tot(nShots), tOutro = nShots * shotDur;
    var p = d.p, prof = d.prof || {};
    var hook = parseHook(d.hook);
    var HOOK_FIM = 2.4;

    // camadas pré-renderizadas (uma vez)
    function camada(fn) { var c = document.createElement("canvas"); c.width = W; c.height = H; fn(c.getContext("2d")); return c; }
    var scrim = camada(function (g) {
      var a = g.createLinearGradient(0, 0, 0, 560); a.addColorStop(0, "rgba(0,0,0,.5)"); a.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = a; g.fillRect(0, 0, W, 560);
      a = g.createLinearGradient(0, 1000, 0, H); a.addColorStop(0, "rgba(0,0,0,0)"); a.addColorStop(0.5, "rgba(0,0,0,.5)"); a.addColorStop(1, "rgba(0,0,0,.82)"); g.fillStyle = a; g.fillRect(0, 1000, W, H - 1000);
    });
    var vinheta = camada(function (g) {
      var a = g.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
      a.addColorStop(0, "rgba(0,0,0,0)"); a.addColorStop(1, "rgba(0,0,0," + E.vig + ")"); g.fillStyle = a; g.fillRect(0, 0, W, H);
    });
    var graos = [];
    if (E.grao) for (var gi = 0; gi < 3; gi++) {
      var gc = document.createElement("canvas"); gc.width = gc.height = 256; var gg = gc.getContext("2d"), id = gg.createImageData(256, 256);
      for (var q = 0; q < id.data.length; q += 4) { var v = 90 + Math.random() * 120; id.data[q] = id.data[q + 1] = id.data[q + 2] = v; id.data[q + 3] = 255; }
      gg.putImageData(id, 0, 0); graos.push(ctx.createPattern(gc, "repeat"));
    }

    // itens de informação (lower-thirds)
    var specs = [];
    if (p.quartos) specs.push([String(p.quartos), p.quartos > 1 ? "quartos" : "quarto"]);
    if (p.area_m2) specs.push([String(p.area_m2), "m²"]);
    if (p.vagas) specs.push([String(p.vagas), p.vagas > 1 ? "vagas" : "vaga"]);
    if (p.banheiros && specs.length < 3) specs.push([String(p.banheiros), p.banheiros > 1 ? "banheiros" : "banheiro"]);
    var difs = (Array.isArray(p.diferenciais) ? p.diferenciais : []).map(function (x) { return String(x).trim(); }).filter(Boolean).slice(0, 4);
    var itens = [];
    if (LAY) {
      // Motion / layouts de frase: cada informação vira uma frase animada (só dados do cadastro)
      var fr = specs.map(function (s) { return s[0] + " " + s[1]; }).concat(difs);
      if (+p.preco) fr.push(curto(p.preco) + (p.finalidade === "aluguel" ? "/mês" : ""));
      if (p.bairro) fr.push("Em " + String(p.bairro).trim());
      fr.filter(Boolean).forEach(function (x) { itens.push({ t: "frase", x: x }); });
    } else if (key === "direto") { if (+p.preco) itens.push({ t: "preco" }); if (specs.length) itens.push({ t: "specs" }); }
    else if (key === "luxo") { if (specs.length) itens.push({ t: "specs" }); }
    else { if (specs.length) itens.push({ t: "specs" }); if (+p.preco) itens.push({ t: "preco" }); }
    if (!LAY) difs.forEach(function (x) { itens.push({ t: "dif", x: x }); });
    if (key === "luxo" && +p.preco) itens.push({ t: "preco" });
    var ini = HOOK_FIM + 0.15, fimInfo = tOutro - 0.15, slot = itens.length ? Math.max(1.5, Math.min(2.6, (fimInfo - ini) / itens.length)) : 0;
    itens = itens.filter(function (it, i) { return ini + (i + 1) * slot <= fimInfo + 0.6; });
    itens.forEach(function (it, i) { it.a = ini + i * slot; it.b = Math.min(it.a + slot, fimInfo + 0.6); });

    var transTipos = [], TRs = [];
    for (var b = 0; b < nShots - 1; b++) {
      var tp = E.trans[b % E.trans.length]; transTipos.push(tp);
      TRs.push(tp === "dissolve" ? E.tr : Math.min(E.tr, 0.5));
    }
    var TRfim = 0.6;
    var pz = 1;

    function foto(k, tt, trDepois) {
      var m = MOV[k % MOV.length], img = d.imgs[k % n];
      var pr = E.mov(c01(tt / (shotDur + trDepois)));
      var z = (m.z[0] + (m.z[1] - m.z[0]) * pr) * pz;
      cover(ctx, img, z, m.x[0] + (m.x[1] - m.x[0]) * pr, m.y[0] + (m.y[1] - m.y[0]) * pr);
    }
    function transformar(fn, tx, ty, s, alfa) {
      ctx.save(); ctx.globalAlpha *= alfa;
      ctx.translate(W / 2 + tx, H / 2 + ty); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
      fn(); ctx.restore();
    }
    function cena(t) {
      var i = Math.min(nShots - 1, Math.floor(t / shotDur)), local = t - i * shotDur;
      var trAnt = i > 0 ? TRs[i - 1] : 0;
      var A = function () { foto(i - 1, t - (i - 1) * shotDur, TRs[i - 1] || 0); }, B = function () { foto(i, local, TRs[i] != null ? TRs[i] : TRfim); };
      if (i > 0 && local < trAnt) {
        var tipo = transTipos[i - 1], q = c01(local / trAnt), e = EZ.io3(q);
        if (tipo === "slide") {
          var vel = (EZ.io3(c01(q + 0.05)) - EZ.io3(c01(q - 0.05))) / 0.1, lag = vel * 90;
          transformar(A, -e * W * 0.3, 0, 1, 1);
          for (var g = 3; g >= 1; g--) transformar(B, (1 - e) * W + g * lag, 0, 1, 0.16);
          transformar(B, (1 - e) * W, 0, 1, 1);
        } else if (tipo === "zoom") {
          transformar(B, 0, 0, 0.78 + 0.22 * e, 1);
          transformar(A, 0, 0, 1 + e * 0.85, 1 - e * e);
        } else if (tipo === "flash") {
          if (q < 0.5) A(); else B();
          ctx.fillStyle = "rgba(255,255,255," + (Math.pow(Math.sin(Math.PI * q), 1.4) * 0.9) + ")"; ctx.fillRect(0, 0, W, H);
        } else { A(); ctx.globalAlpha = e; B(); ctx.globalAlpha = 1; }
      } else B();
      return i;
    }

    /* ----- painéis de informação ----- */
    function painel(it, t, x, y, w, h, solido, corpo) {
      var e = EZ.o5(c01((t - it.a) / 0.5)), s = EZ.io3(c01((t - (it.b - 0.35)) / 0.35)), pr = e * (1 - s);
      if (pr <= 0.002) return;
      ctx.save();
      ctx.globalAlpha *= c01(pr * 1.6);
      ctx.translate(-(1 - pr) * (x + w + 60), 0);
      rr(ctx, x, y, w, h, key === "luxo" ? 8 : 26); ctx.fillStyle = solido ? E.acc : E.painel; ctx.fill();
      if (key === "luxo") { ctx.strokeStyle = "rgba(230,201,143,.55)"; ctx.lineWidth = 2; ctx.stroke(); }
      else if (!solido) { ctx.fillStyle = E.acc; rr(ctx, x, y, 12, h, 6); ctx.fill(); }
      corpo(solido ? E.accTxt : "#FFFFFF", solido ? "rgba(10,10,10,.7)" : E.acc);
      ctx.restore();
    }
    var PY = 1160, PX = 64, PW = W - 128;
    /* frases animadas em 5 layouts (centro, faixa, caixa, esquerda, legenda) */
    function frase(it, idx, t) {
      var vis = c01((t - it.a) / 0.22) * c01((it.b - t) / 0.22), txt = String(it.x), r, lh;
      var corAlt = idx % 2 ? E.acc : "#FFFFFF";
      if (LAY === "faixa") {
        ctx.fillStyle = "rgba(0,0,0," + (0.22 * vis) + ")"; ctx.fillRect(0, 0, W, H);
        r = ajustar(ctx, txt.toUpperCase(), 920, 124, 64, 3, PE, FT); lh = r.tam * 1.08;
        var hb = r.linhas.length * lh + 96, yb = 1200 - hb / 2;
        var ent = EZ.o5(c01((t - it.a) / 0.42)), sai = EZ.io3(c01((t - (it.b - 0.32)) / 0.32));
        ctx.save(); ctx.translate((ent - 1) * W + sai * W, 0);
        ctx.fillStyle = E.acc; ctx.fillRect(0, yb, W, hb);
        ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(0, yb + hb - 10, W, 10);
        ctx.restore();
        if (ent > 0.55 && sai < 0.5) bloco(ctx, r.linhas, { x: W / 2, y: yb + 48, tam: r.tam, peso: PE, fonte: FT, cor: E.accTxt, alin: "center", t: t, t0: it.a + 0.22, modo: "words", stag: 0.08, dur: 0.28, fim: it.b - 0.3, lh: 1.08, sombra: false });
        return;
      }
      if (LAY === "caixa") {
        ctx.fillStyle = "rgba(0,0,0," + (0.42 * vis) + ")"; ctx.fillRect(0, 0, W, H);
        r = ajustar(ctx, txt.toUpperCase(), 860, 122, 62, 4, PE, FT); lh = r.tam * 1.34;
        var y0 = 920 - r.linhas.length * lh / 2, out = c01((it.b - t) / 0.25);
        ctx.save(); ctx.font = PE + " " + r.tam + "px " + FT; ctx.textBaseline = "top"; ctx.textAlign = "center";
        r.linhas.forEach(function (l, i) {
          var q = EZ.o5(c01((t - it.a - 0.08 - i * 0.13) / 0.34)); if (q <= 0 || out <= 0) return;
          var w = ctx.measureText(l).width + 54, y = y0 + i * lh;
          ctx.globalAlpha = out;
          ctx.save(); ctx.translate(W / 2 - w / 2, 0); ctx.scale(q, 1); rr(ctx, 0, y - r.tam * 0.12, w, r.tam * 1.18, 16); ctx.fillStyle = E.acc; ctx.fill(); ctx.restore();
          if (q > 0.65) { ctx.globalAlpha = out * c01((q - 0.65) / 0.35); ctx.fillStyle = E.accTxt; ctx.fillText(l, W / 2, y); }
        });
        ctx.restore();
        return;
      }
      if (LAY === "esquerda") {
        var g = ctx.createLinearGradient(0, 0, 0, 1100); g.addColorStop(0, "rgba(0,0,0," + (0.72 * vis) + ")"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, 1100);
        r = ajustar(ctx, txt, 870, 138, 72, 4, PE, FT);
        var hE = r.linhas.length * r.tam * 1.04, eb = EZ.o5(c01((t - it.a) / 0.45)) * vis;
        ctx.fillStyle = E.acc; ctx.fillRect(72, 250, 12, hE * eb);
        bloco(ctx, r.linhas, { x: 112, y: 250, tam: r.tam, peso: PE, fonte: FT, cor: corAlt, alin: "left", t: t, t0: it.a + 0.08, modo: "words", stag: 0.09, dur: 0.32, fim: it.b - 0.12, lh: 1.04 });
        return;
      }
      if (LAY === "legenda") {
        r = ajustar(ctx, txt, 900, 96, 58, 3, PE, FT); lh = r.tam * 1.2;
        var yL = 1450 - r.linhas.length * lh, k = 0, outL = c01((it.b - t) / 0.22), nPal = txt.split(/\s+/).length;
        var atual = Math.min(nPal - 1, Math.floor((t - it.a - 0.05) / 0.16));
        ctx.save(); ctx.font = PE + " " + r.tam + "px " + FT; ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.lineJoin = "round";
        var sp = ctx.measureText(" ").width;
        r.linhas.forEach(function (l, li) {
          var ws = l.split(" "), larg = ws.map(function (w) { return ctx.measureText(w).width; });
          var tw = larg.reduce(function (a, b) { return a + b; }, 0) + sp * (ws.length - 1), x = W / 2 - tw / 2, y = yL + li * lh;
          ws.forEach(function (w, wi) {
            var tk = it.a + 0.05 + k * 0.16, a = c01((t - tk) / 0.1) * outL;
            if (a > 0) {
              ctx.globalAlpha = a;
              if (k === atual) { rr(ctx, x - 12, y - r.tam * 0.08, larg[wi] + 24, r.tam * 1.12, 12); ctx.fillStyle = E.acc; ctx.fill(); ctx.fillStyle = E.accTxt; ctx.fillText(w, x, y); }
              else { ctx.lineWidth = Math.max(6, r.tam * 0.12); ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(w, x, y); ctx.fillStyle = "#FFFFFF"; ctx.fillText(w, x, y); }
            }
            x += larg[wi] + sp; k++;
          });
        });
        ctx.restore();
        return;
      }
      // centro (Motion): tela escurece e a frase entra palavra por palavra, gigante e centralizada
      ctx.fillStyle = "rgba(0,0,0," + (0.5 * vis) + ")"; ctx.fillRect(0, 0, W, H);
      var rf = ajustar(ctx, txt.toUpperCase(), 940, 176, 84, 3, PE, FT), hf = rf.linhas.length * rf.tam * 1.02;
      var pop = 1 + 0.06 * (1 - EZ.o5(c01((t - it.a) / 0.35)));
      ctx.save(); ctx.translate(W / 2, 900); ctx.scale(pop, pop); ctx.translate(-W / 2, -900);
      bloco(ctx, rf.linhas, { x: W / 2, y: 900 - hf / 2, tam: rf.tam, peso: PE, fonte: FT, cor: corAlt, alin: "center", t: t, t0: it.a + 0.05, modo: "words", stag: 0.09, dur: 0.32, fim: it.b - 0.12, lh: 1.02 });
      ctx.restore();
      var bw = 180 * EZ.io3(c01((t - it.a - 0.2) / 0.4)) * vis; ctx.fillStyle = E.acc; ctx.fillRect(W / 2 - bw / 2, 900 + hf / 2 + 30, bw, 10);
    }
    function info(t) {
      itens.forEach(function (it, idx) {
        if (t < it.a || t > it.b + 0.1) return;
        var tl = t;
        if (it.t === "frase") { frase(it, idx, t); return; }
        if (it.t === "preco") {
          painel(it, t, PX, PY, PW, 250, key === "direto", function (cor, sub) {
            bloco(ctx, [p.finalidade === "aluguel" ? "ALUGUEL" : "VALOR"], { x: PX + 56, y: PY + 28, tam: 32, peso: 700, fonte: FONTE, cor: sub, alin: "left", t: tl, t0: it.a + 0.1, modo: "fade", stag: 0, dur: 0.4, fim: it.b - 0.3, esp: 6, sombra: false });
            var q = c01((t - it.a - 0.15) / 1.3), v = (+p.preco) * EZ.oExp(q); v = v >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v);
            var txt = V.fmtBRL(q >= 1 ? +p.preco : v) + (p.finalidade === "aluguel" ? "/mês" : "");
            var r = ajustar(ctx, txt, PW - 112, 128, 70, 1, key === "luxo" ? 500 : 900, E.fonte);
            bloco(ctx, [txt], { x: PX + 56, y: PY + 82, tam: r.tam, peso: key === "luxo" ? 500 : 900, fonte: E.fonte, cor: cor, alin: "left", t: tl, t0: it.a + 0.15, modo: "fade", stag: 0, dur: 0.3, fim: it.b - 0.3, sombra: false });
          });
        } else if (it.t === "specs") {
          painel(it, t, PX, PY, PW, 210, false, function (cor, sub) {
            var cw = (PW - 80) / specs.length;
            specs.forEach(function (s, k) {
              var cx = PX + 40 + cw * (k + 0.5), t0 = it.a + 0.2 + k * 0.14;
              bloco(ctx, [s[0]], { x: cx, y: PY + 24, tam: 92, peso: key === "luxo" ? 500 : 900, fonte: E.fonte, cor: cor, alin: "center", t: tl, t0: t0, modo: "fade", stag: 0, dur: 0.4, fim: it.b - 0.3, sombra: false });
              bloco(ctx, [s[1]], { x: cx, y: PY + 132, tam: 36, peso: 600, fonte: FONTE, cor: sub, alin: "center", t: tl, t0: t0 + 0.06, modo: "fade", stag: 0, dur: 0.4, fim: it.b - 0.3, sombra: false });
            });
          });
        } else {
          painel(it, t, PX, PY + 40, PW, 150, false, function (cor) {
            var qa = EZ.oBack(c01((t - it.a - 0.2) / 0.4));
            ctx.save(); ctx.translate(PX + 86, PY + 115); ctx.scale(qa, qa);
            ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fillStyle = E.acc; ctx.fill();
            ctx.strokeStyle = E.accTxt; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-4, 11); ctx.lineTo(15, -10); ctx.stroke(); ctx.restore();
            var r = ajustar(ctx, it.x, PW - 220, 68, 40, 1, key === "luxo" ? 500 : 800, E.fonte);
            bloco(ctx, r.linhas, { x: PX + 146, y: PY + 115 - r.tam * 0.56, tam: r.tam, peso: key === "luxo" ? 500 : 800, fonte: E.fonte, cor: cor, alin: "left", t: tl, t0: it.a + 0.22, modo: key === "luxo" ? "mask" : "fade", stag: 0, dur: 0.45, fim: it.b - 0.3, sombra: false });
          });
        }
      });
    }

    /* ----- gancho ----- */
    function gancho(t) {
      if (t > HOOK_FIM + 0.1) return;
      var cx = W / 2, t0 = 0.15, o = { t: t, fim: HOOK_FIM, alin: "center", x: cx };
      var main = hook.main || "", r, y;
      if (key === "luxo") {
        r = ajustar(ctx, main, 900, 132, 76, 3, FX ? PE : 500, FS);
        var hTot = r.linhas.length * r.tam * 1.12 + (hook.kicker ? 90 : 0) + 40;
        y = 700 - hTot / 2;
        if (hook.kicker) { bloco(ctx, [hook.kicker.toUpperCase()], Object.assign({}, o, { y: y, tam: 38, peso: 600, fonte: FONTE, cor: E.acc, t0: t0, modo: "fade", stag: 0, dur: 0.7, esp: 10 })); y += 90; }
        bloco(ctx, r.linhas, Object.assign({}, o, { y: y, tam: r.tam, peso: FX ? PE : 500, fonte: FS, cor: "#FFF8EA", t0: t0 + 0.25, modo: "mask", stag: 0.22, dur: 0.9 }));
        var lw = 220 * EZ.io3(c01((t - 1.0) / 0.8)) * c01((HOOK_FIM - t) / 0.28);
        ctx.fillStyle = E.acc; ctx.fillRect(cx - lw / 2, y + r.linhas.length * r.tam * 1.12 + 26, lw, 3);
        if (hook.sub) bloco(ctx, [hook.sub], Object.assign({}, o, { y: y + r.linhas.length * r.tam * 1.12 + 56, tam: 44, peso: 500, fonte: SERIF, cor: "#F3E3C3", t0: 1.0, modo: "fade", stag: 0, dur: 0.6 }));
      } else {
        r = ajustar(ctx, main, 940, key === "direto" ? 150 : 128, 70, 4, PE, FT);
        var hh = r.linhas.length * r.tam * 1.08 + (hook.kicker ? 120 : 0) + (hook.sub ? 130 : 0);
        y = 720 - hh / 2;
        if (hook.kicker) {
          var kt = hook.kicker.toUpperCase(); ctx.font = "900 50px " + FONTE;
          var kw = ctx.measureText(kt).width + 80, ke = EZ.oBack(c01((t - t0) / 0.45));
          ctx.save(); ctx.globalAlpha *= c01(ke * 1.5) * c01((HOOK_FIM - t) / 0.28); ctx.translate(cx, y + 42); ctx.scale(ke, ke);
          rr(ctx, -kw / 2, -42, kw, 84, 42); ctx.fillStyle = E.acc; ctx.fill();
          ctx.fillStyle = E.accTxt; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(kt, 0, 3); ctx.restore();
          y += 120;
        }
        var h1 = bloco(ctx, r.linhas, Object.assign({}, o, { y: y, tam: r.tam, peso: PE, fonte: FT, cor: "#FFFFFF", t0: t0 + 0.2, modo: "words", stag: 0.12, dur: 0.5, lh: 1.08 }));
        if (hook.sub) bloco(ctx, [hook.sub.toUpperCase()], Object.assign({}, o, { y: y + h1 + 18, tam: 96, peso: PE, fonte: FT, cor: E.acc, t0: t0 + 0.2 + r.linhas.join(" ").split(" ").length * 0.12 + 0.1, modo: "words", stag: 0.14, dur: 0.5 }));
      }
    }

    /* ----- cartão final ----- */
    function cartao(t) {
      var a = c01((t - tOutro) / TRfim); if (a <= 0) return;
      var lt = t - tOutro, cx = W / 2;
      ctx.save(); ctx.globalAlpha = a;
      cover(ctx, d.imgs[0], 1.08 + 0.04 * c01(lt / 3.2), 0, 0);
      ctx.fillStyle = key === "luxo" ? "rgba(14,10,6,.8)" : "rgba(9,9,11,.8)"; ctx.fillRect(0, 0, W, H);
      var ay = 520, ae = EZ.oBack(c01((lt - 0.2) / 0.6));
      ctx.save(); ctx.translate(cx, ay); ctx.scale(ae, ae);
      if (d.avatar) {
        ctx.beginPath(); ctx.arc(0, 0, 140, 0, 7); ctx.fillStyle = E.acc; ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 132, 0, 7); ctx.clip();
        var iw = d.avatar.naturalWidth || d.avatar.width, ih = d.avatar.naturalHeight || d.avatar.height, sc = Math.max(264 / iw, 264 / ih);
        ctx.drawImage(d.avatar, -iw * sc / 2, -ih * sc / 2, iw * sc, ih * sc); ctx.restore();
      } else if (d.logo) {
        var lh = 150, lw = Math.min(520, (d.logo.naturalWidth / d.logo.naturalHeight) * lh);
        rr(ctx, -lw / 2 - 40, -lh / 2 - 30, lw + 80, lh + 60, 30); ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fill();
        ctx.drawImage(d.logo, -lw / 2, -lh / 2, lw, lh);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, 120, 0, 7); ctx.fillStyle = E.acc; ctx.fill();
        ctx.fillStyle = E.accTxt; ctx.font = "900 120px " + FONTE; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText((prof.nome || "V").trim().charAt(0).toUpperCase(), 0, 8);
      }
      ctx.restore();
      var nome = prof.nome || "", creci = prof.creci ? "CRECI " + String(prof.creci).replace(/^creci[\s:-]*/i, "") : "";
      var rn = ajustar(ctx, nome, 900, 84, 48, 2, key === "luxo" ? 500 : 800, E.fonte);
      var yy = 720;
      if (nome) yy += bloco(ctx, rn.linhas, { x: cx, y: yy, tam: rn.tam, peso: key === "luxo" ? 500 : 800, fonte: E.fonte, cor: "#FFFFFF", alin: "center", t: lt, t0: 0.35, modo: key === "luxo" ? "mask" : "fade", stag: 0, dur: 0.6 }) + 10;
      if (creci) bloco(ctx, [creci], { x: cx, y: yy, tam: 40, peso: 600, fonte: FONTE, cor: "#D4D4D8", alin: "center", t: lt, t0: 0.55, modo: "fade", stag: 0, dur: 0.5, esp: 3, sombra: false });
      // botão
      var cy = 1040, be = EZ.oBack(c01((lt - 0.8) / 0.5)), pulso = 1 + 0.025 * Math.sin(lt * 6);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(be * pulso, be * pulso); ctx.globalAlpha *= c01(be * 1.4);
      rr(ctx, -400, -78, 800, 156, key === "luxo" ? 14 : 78); ctx.fillStyle = E.acc; ctx.fill();
      ctx.fillStyle = E.accTxt; ctx.font = (key === "luxo" ? "600 " : "900 ") + "58px " + (key === "luxo" ? SERIF : FONTE); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(d.cta || "Chame no WhatsApp", 0, 4); ctx.restore();
      var tel = telFmt(prof.telefone);
      if (tel) bloco(ctx, [tel], { x: cx, y: 1150, tam: 46, peso: 700, fonte: FONTE, cor: "#FFFFFF", alin: "center", t: lt, t0: 1.1, modo: "fade", stag: 0, dur: 0.5, sombra: false });
      // barra de progresso
      var pw = 640, pg = c01((lt - 0.4) / Math.max(0.5, total - tOutro - 0.5));
      rr(ctx, cx - pw / 2, 1270, pw, 10, 5); ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.fill();
      if (pg > 0) { rr(ctx, cx - pw / 2, 1270, Math.max(10, pw * pg), 10, 5); ctx.fillStyle = E.acc; ctx.fill(); }
      ctx.restore();
    }

    function draw(t) {
      t = Math.max(0, Math.min(total, t));
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      var fb = (t / beat) % 1; pz = E.pulse ? 1 + 0.014 * Math.exp(-7 * fb) : 1;
      cena(t);
      if (E.quente) { ctx.fillStyle = "rgba(255,170,90," + E.quente + ")"; ctx.fillRect(0, 0, W, H); }
      if (key === "luxo") {   // vazamento de luz: dá profundidade sem mapa de profundidade
        ctx.save(); ctx.globalCompositeOperation = "screen";
        var lx = W * (0.15 + 0.7 * ((t / 9) % 1)), g = ctx.createRadialGradient(lx, 520, 0, lx, 520, 700);
        g.addColorStop(0, "rgba(255,190,110,.2)"); g.addColorStop(1, "rgba(255,190,110,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      ctx.drawImage(scrim, 0, 0); ctx.drawImage(vinheta, 0, 0);
      if (t < HOOK_FIM + 0.4) { ctx.fillStyle = "rgba(0,0,0," + (0.3 * c01(Math.min(t / 0.3, (HOOK_FIM + 0.4 - t) / 0.4))) + ")"; ctx.fillRect(0, 0, W, H); }
      if (graos.length) {
        ctx.save(); ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = "overlay";
        ctx.translate((Math.floor(t * 24) * 53) % 256, (Math.floor(t * 24) * 97) % 256);
        ctx.fillStyle = graos[Math.floor(t * 24) % graos.length]; ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
      }
      gancho(t); info(t); cartao(t);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return { total: total, draw: draw, beat: beat };
  }

  /* ---------- preparo e interface do Reels ---------- */
  var rs = null;   // estado do editor
  async function prepararReels(p) {
    var fotos = V.fotosDe(p).slice(0, 8);
    var brutas = await Promise.all(fotos.map(carregarImg));
    var imgs = [];
    brutas.forEach(function (im, i) {
      if (!im) return;
      imgs.push(window.VitrineFotos && window.VitrineFotos.melhorar ? window.VitrineFotos.melhorar(im, fotos[i]) : im);   // 1x por foto
    });
    if (!imgs.length) throw new Error("Não consegui carregar as fotos do imóvel.");
    var prof = state.profile || {};
    var logo = prof.logo_url && prof.marca_ativa !== false ? await carregarImg(prof.logo_url) : null;
    var avatar = prof.avatar_url ? await carregarImg(prof.avatar_url) : null;
    return { p: p, prof: prof, imgs: imgs, logo: logo, avatar: avatar };
  }

  function iniciarPrevia(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d"), r = criarRenderer(ctx, rs, rs.key, canvas.width / W);
    var vivo = true, t0 = performance.now(), ultimo = 0, audio = null, nar = null;
    if (rs.musica && !opts.mudo) { try { audio = new Audio(rs.musicaUrl || (rs.musicaUrl = url(rs.musica))); audio.loop = true; audio.volume = 0.8; audio.play().catch(function () {}); } catch (e) { audio = null; } }
    if (rs.narr && !opts.semNarr) { try { nar = new Audio(rs.narrUrl || (rs.narrUrl = url(rs.narr))); nar.play().catch(function () {}); } catch (e) { nar = null; } }
    function loop(ts) {
      if (!vivo || !canvas.isConnected) { if (audio) audio.pause(); if (nar) nar.pause(); return; }
      if (ts - ultimo >= 32) {
        ultimo = ts;
        var t = ((performance.now() - t0) / 1000) % (r.total + 0.8);
        r.draw(t);
        if (audio) audio.volume = (nar && !nar.ended ? 0.22 : 0.8) * c01(t / 1) * c01((r.total - t) / 1.5);
        if (t < 0.05) { if (audio) try { audio.currentTime = 0; } catch (e) {} if (nar) try { nar.currentTime = 0; nar.play().catch(function () {}); } catch (e) {} }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    pararPrevia = function () { vivo = false; if (audio) audio.pause(); if (nar) nar.pause(); pararPrevia = function () {}; };
    return r.total;
  }

  /* narração: grava a voz enquanto a prévia toca do início */
  async function gravarNarracao() {
    var ms;
    try { ms = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { V.toast("Libere o microfone no navegador para gravar a narração."); return; }
    pararPrevia();
    var pv = root.querySelector(".rl-pv"), canvas = $("rl-cv");
    var ov = document.createElement("div"); ov.className = "rl-ov";
    ov.innerHTML = '<div class="rl-ovt" id="rl-ovt">' + esc(rs.narrTexto || "") + '</div><div class="rl-ovc" id="rl-ovc"></div>';
    pv.appendChild(ov);
    var parou = false, rec = null, g = null, mime = "", tIni = 0;
    function soltar() { ms.getTracks().forEach(function (t) { t.stop(); }); }
    cancelar = function () { parou = true; soltar(); try { if (rec && rec.state !== "inactive") rec.stop(); } catch (e) {} };
    for (var k = 3; k >= 1; k--) {
      $("rl-ovc").innerHTML = "<b>" + k + "</b>"; await wait(1000);
      if (parou || !ov.isConnected) { soltar(); return; }
    }
    $("rl-ovc").innerHTML = "";
    mime = escolherMime(["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]);
    rec = new MediaRecorder(ms, mime ? { mimeType: mime } : undefined); g = gravar(rec); rec.start(500);
    tIni = performance.now();
    var total = iniciarPrevia(canvas, { mudo: true, semNarr: true });
    var b = document.createElement("button"); b.className = "vd-btn pri rl-ovb"; b.innerHTML = '<span class="rl-rec"></span>Parar'; b.style.flex = "none"; ov.appendChild(b);
    var txt = $("rl-ovt"), alto = ov.clientHeight;
    (function rola() {
      if (parou || !ov.isConnected) return;
      var pr = c01((performance.now() - tIni) / 1000 / total);
      txt.style.transform = "translateY(" + (alto * 0.2 - pr * Math.max(0, txt.scrollHeight - alto * 0.3)) + "px)";
      requestAnimationFrame(rola);
    })();
    var fim = setTimeout(function () { if (!parou) b.click(); }, (total + 0.3) * 1000);
    b.onclick = async function () {
      if (parou) return; parou = true; clearTimeout(fim); cancelar = null;
      var dur = (performance.now() - tIni) / 1000;
      var blob = await g.parar(tipoBase(rec.mimeType, mime || "audio/webm"));
      soltar();
      if (!root || root.hidden) return;
      rs.narr = blob; rs.narrUrl = null; rs.narrDur = dur;
      telaReels();
    };
  }

  async function exportarReels(onProg) {
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d"), r = criarRenderer(ctx, rs, rs.key, 1);
    var mime = escolherMime(MIME_PRIORIDADE);
    if (!mime || !HTMLCanvasElement.prototype.captureStream) throw new Error("Seu navegador não consegue gerar vídeo. Use o Google Chrome atualizado.");
    var AC = window.AudioContext || window.webkitAudioContext, ac = null, el = null, nel = null, gain = null, trilhas = [];
    function carregaAudio(u) {
      var a = new Audio(u); a.preload = "auto";
      return new Promise(function (ok, no) { a.onloadedmetadata = function () { ok(a); }; a.onerror = function () { no(new Error("áudio ilegível")); }; setTimeout(function () { ok(a); }, 4000); });
    }
    if ((rs.musica || rs.narr) && AC) {
      try {
        ac = new AC(); await ac.resume();
        var dest = ac.createMediaStreamDestination();
        if (rs.musica) {
          el = await carregaAudio(rs.musicaUrl || (rs.musicaUrl = url(rs.musica))); el.loop = true;
          gain = ac.createGain(); ac.createMediaElementSource(el).connect(gain); gain.connect(dest);   // só vai para o gravador, não para o alto-falante
        }
        if (rs.narr) {
          nel = await carregaAudio(rs.narrUrl || (rs.narrUrl = url(rs.narr)));
          var ng = ac.createGain(); ng.gain.value = 1.0; ac.createMediaElementSource(nel).connect(ng); ng.connect(dest);
        }
        trilhas = dest.stream.getAudioTracks();
      } catch (e) { V.toast("Não consegui usar o áudio escolhido; gerando sem ele."); ac = null; el = null; nel = null; trilhas = []; }
    }
    var saida = new MediaStream(cv.captureStream(30).getVideoTracks().concat(trilhas));
    var rec = new MediaRecorder(saida, { mimeType: mime, videoBitsPerSecond: 8000000, audioBitsPerSecond: 128000 });
    var g = gravar(rec), parar = false;
    cancelar = function () { parar = true; };
    r.draw(0);
    rec.start(250);
    if (el || nel) {
      var now = ac.currentTime;
      if (el) {
        // música: sobe com fade, baixa (ducking ~0.25) enquanto houver narração, volta e some no final
        var alto = 0.9, baixo = 0.9 * 0.25, nd = nel ? Math.min(r.total, (isFinite(nel.duration) && nel.duration > 0 ? nel.duration : (rs.narrDur || r.total))) : 0;
        var pts = [[0, 0]];
        if (nel) {
          pts.push([0.8, baixo]);
          if (nd + 1.2 < r.total - 1.8) { pts.push([nd, baixo]); pts.push([nd + 1.2, alto]); }
          else pts.push([Math.max(1, r.total - 1.8), baixo]);
        } else pts.push([1.2, alto]);
        pts.push([r.total, 0]);
        gain.gain.setValueAtTime(0, now);
        pts.forEach(function (p) { gain.gain.linearRampToValueAtTime(p[1], now + p[0]); });
        el.currentTime = 0; try { await el.play(); } catch (e) {}
      }
      if (nel) { nel.currentTime = 0; try { await nel.play(); } catch (e) {} }
    }
    var t0 = performance.now(), ultimo = 0;
    await new Promise(function (fim) {
      (function loop(ts) {
        var t = (performance.now() - t0) / 1000;
        if (parar || t >= r.total) return fim();
        if (ts - ultimo >= 30) { ultimo = ts; r.draw(t); onProg(Math.min(99, Math.round(t / r.total * 100))); }
        requestAnimationFrame(loop);
      })(0);
    });
    if (!parar) { r.draw(r.total); await wait(250); }
    cancelar = null;
    if (el) el.pause();
    if (nel) nel.pause();
    var blob = await g.parar(tipoBase(rec.mimeType, mime));
    try { if (ac) ac.close(); } catch (e) {}
    return parar ? null : blob;
  }

  async function abrirReels(id) {
    var p = (state.propriedades || []).find(function (x) { return x.id === id; });
    if (!p) return;
    if (!V.fotosDe(p).length) { V.toast("Adicione fotos ao imóvel (botão Fotos) para gerar o Reels."); return; }
    abrir(cab("🎬 Reels do imóvel") + '<p class="vd-hint">Preparando as fotos…</p><div class="vd-bar"><i style="width:60%"></i></div>');
    try {
      rs = await prepararReels(p);
      if (!root || root.hidden) return;
      rs.key = "moderno"; rs.hook = hookPadrao(p, rs.key); rs.hookEditado = false; rs.musica = null; rs.musicaNome = "";
      rs.fonte = ""; rs.cor = ""; rs.layout = ""; rs.trilha = null; rs.musicaInsta = false;
      telaReels();
    } catch (e) {
      abrir(cab("🎬 Reels do imóvel") + '<p>' + esc(e.message || "Erro ao preparar o vídeo.") + '</p>');
    }
  }

  function telaReels() {
    var mp4 = !!escolherMime(["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"]);
    abrir(cab("🎬 Reels do imóvel") +
      '<div class="rl-pv"><canvas id="rl-cv" width="540" height="960"></canvas></div>' +
      '<div class="rl-lb">Estilo</div><div class="rl-est">' + Object.keys(ESTILOS).map(function (k) {
        return '<button class="rl-e' + (k === rs.key ? " on" : "") + '" data-k="' + k + '"><b>' + ESTILOS[k].nome + '</b><span>' + ESTILOS[k].desc + '</span></button>';
      }).join("") + '</div>' +
      '<div class="rl-lb">Layout das frases</div><div class="rl-est rl-lay">' + Object.keys(LAYOUTS_RL).map(function (k) {
        var on = (rs.layout || "padrao") === k;
        return '<button class="rl-e' + (on ? " on" : "") + '" data-layout="' + k + '"><b>' + LAYOUTS_RL[k].nome + '</b><span>' + LAYOUTS_RL[k].desc + '</span></button>';
      }).join("") + '</div>' +
      '<div class="rl-lb">Fonte</div><div class="rl-chips">' + [["", "Do estilo"]].concat(Object.keys(FONTES_RL).map(function (k) { return [k, FONTES_RL[k].nome]; })).map(function (f) {
        var st = f[0] ? ' style="font-family:' + FONTES_RL[f[0]].css.replace(/"/g, "'") + ';font-weight:' + Math.min(FONTES_RL[f[0]].peso, 800) + '"' : "";
        return '<button class="rl-c' + ((rs.fonte || "") === f[0] ? " on" : "") + '" data-fonte="' + f[0] + '"' + st + '>' + f[1] + '</button>';
      }).join("") + '</div>' +
      '<div class="rl-lb">Cor de destaque</div><div class="rl-chips"><button class="rl-c' + (!rs.cor ? " on" : "") + '" data-cor="">Do estilo</button>' + Object.keys(CORES_RL).map(function (k) {
        return '<button class="rl-cor' + (rs.cor === k ? " on" : "") + '" data-cor="' + k + '" title="' + CORES_RL[k].nome + '" aria-label="' + CORES_RL[k].nome + '" style="background:' + CORES_RL[k].hex + '"></button>';
      }).join("") + '</div>' +
      '<div class="rl-lb">Frase de abertura (primeiros 2 segundos)</div><input type="text" id="rl-hook" maxlength="90" value="' + esc(rs.hook) + '">' +
      '<div class="rl-lb">Música</div><div class="rl-chips" id="rl-mus-op">' +
        '<button class="rl-c' + (!rs.musica && !rs.musicaInsta ? " on" : "") + '" data-mus="">Sem música</button>' +
        TRILHAS.map(function (t) { return '<button class="rl-c' + (rs.trilha === t.id ? " on" : "") + '" data-mus="t:' + t.id + '" title="' + t.desc + '">▶ ' + t.nome + '</button>'; }).join("") +
        '<button class="rl-c' + (rs.musica && !rs.trilha ? " on" : "") + '" data-mus="arquivo">📁 ' + (rs.musica && !rs.trilha ? esc(rs.musicaNome) : "Do aparelho") + '</button>' +
        '<button class="rl-c' + (rs.musicaInsta ? " on" : "") + '" data-mus="insta">🎵 Escolher no Instagram</button></div>' +
      '<p class="vd-hint dif">' + (rs.musicaInsta ? "O vídeo sai sem música. Na hora de postar, a Vitrine manda o vídeo para o app do Instagram e lá você escolhe a música da biblioteca deles."
        : "As trilhas ▶ são da própria Vitrine: livres de direitos autorais e sem custo. Ou use um arquivo seu, ou escolha a música no Instagram.") + '</p>' +
      '<input type="file" id="rl-file" accept="audio/*" hidden>' +
      '<div class="rl-lb">Narração</div>' +
      (rs.narr
        ? '<audio controls id="rl-nar-a" src="' + (rs.narrUrl || (rs.narrUrl = url(rs.narr))) + '" style="width:100%"></audio><div class="vd-row"><button class="vd-btn" id="rl-nar-rec">🎙️ Regravar</button><button class="vd-btn" id="rl-nar-x">Apagar</button></div>'
        : '<div class="vd-row"><button class="vd-btn" id="rl-nar-rec">🎙️ Gravar narração</button><button class="vd-btn" id="rl-nar-f">Escolher áudio</button></div>') +
      '<input type="file" id="rl-nar-file" accept="audio/*" hidden>' +
      '<textarea id="rl-nar-t" placeholder="Texto da narração (opcional, aparece grande sobre a prévia como guia de leitura)" style="min-height:70px">' + esc(rs.narrTexto || "") + '</textarea>' +
      '<button class="vd-btn" id="rl-nar-g" style="flex:none">Gerar texto da narração</button>' +
      '<p class="vd-hint">Use fone de ouvido para a música da prévia não entrar no microfone. Durante a gravação a prévia toca sem música.</p>' +
      '<div class="rl-sticky"><button class="vd-btn pri" id="rl-exp" style="width:100%;flex:none">Exportar vídeo</button>' +
      '<p class="vd-hint" style="margin-top:8px;text-align:center">' + (mp4 ? "Sai em MP4, pronto para o Instagram." : "Seu navegador grava em WEBM (o Instagram pode recusar). Prefira Chrome atualizado ou Safari 17+ para MP4.") + '</p></div>');
    iniciarPrevia($("rl-cv"));
    var deb = null;
    function reiniciar() { pararPrevia(); iniciarPrevia($("rl-cv")); }
    Array.prototype.forEach.call(root.querySelectorAll(".rl-e"), function (b) {
      b.onclick = function () {
        rs.key = b.dataset.k;
        if (!rs.hookEditado) { rs.hook = hookPadrao(rs.p, rs.key); $("rl-hook").value = rs.hook; }
        Array.prototype.forEach.call(root.querySelectorAll(".rl-e"), function (x) { x.classList.toggle("on", x === b); });
        reiniciar();
      };
    });
    $("rl-hook").oninput = function () {
      rs.hook = this.value; rs.hookEditado = true; clearTimeout(deb);
      deb = setTimeout(reiniciar, 350);
    };
    Array.prototype.forEach.call(root.querySelectorAll("[data-layout]"), function (b) {
      b.onclick = function () { rs.layout = b.dataset.layout === "padrao" ? "" : b.dataset.layout; Array.prototype.forEach.call(root.querySelectorAll("[data-layout]"), function (x) { x.classList.toggle("on", x === b); }); reiniciar(); };
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-fonte]"), function (b) {
      b.onclick = function () { rs.fonte = b.dataset.fonte; Array.prototype.forEach.call(root.querySelectorAll("[data-fonte]"), function (x) { x.classList.toggle("on", x === b); }); carregarFonte(rs.fonte).then(reiniciar); };
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-cor]"), function (b) {
      b.onclick = function () { rs.cor = b.dataset.cor; Array.prototype.forEach.call(root.querySelectorAll("[data-cor]"), function (x) { x.classList.toggle("on", x === b); }); reiniciar(); };
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-mus]"), function (b) {
      b.onclick = async function () {
        var v = b.dataset.mus;
        if (v === "arquivo") { $("rl-file").click(); return; }
        if (v === "insta") { rs.musica = null; rs.musicaUrl = null; rs.musicaNome = ""; rs.trilha = null; rs.musicaInsta = true; telaReels(); return; }
        if (!v) { rs.musica = null; rs.musicaUrl = null; rs.musicaNome = ""; rs.trilha = null; rs.musicaInsta = false; telaReels(); return; }
        var id = v.slice(2), txt = b.textContent; b.disabled = true; b.textContent = "Carregando…";
        try {
          var f = await carregarTrilha(id);
          if (!root || root.hidden) return;
          rs.musica = f; rs.musicaUrl = null; rs.musicaNome = nomeTrilha(id); rs.trilha = id; rs.musicaInsta = false; telaReels();
        } catch (e) { b.disabled = false; b.textContent = txt; V.toast(e.message || "Não consegui carregar a trilha."); }
      };
    });
    $("rl-file").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      rs.musica = f; rs.musicaUrl = null; rs.musicaNome = f.name.slice(0, 28); rs.trilha = null; rs.musicaInsta = false; telaReels();
    };
    $("rl-nar-t").oninput = function () { rs.narrTexto = this.value; };
    $("rl-nar-rec").onclick = gravarNarracao;
    if ($("rl-nar-f")) $("rl-nar-f").onclick = function () { $("rl-nar-file").click(); };
    $("rl-nar-file").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      rs.narr = f; rs.narrUrl = null; rs.narrDur = 0;
      var a = new Audio(url(f)); a.onloadedmetadata = function () { rs.narrDur = isFinite(a.duration) ? a.duration : 0; };
      telaReels();
    };
    if ($("rl-nar-x")) $("rl-nar-x").onclick = function () { rs.narr = null; rs.narrUrl = null; telaReels(); };
    $("rl-nar-g").onclick = async function () {
      var b = this; b.disabled = true; b.textContent = "Escrevendo…";
      try {
        var p = rs.p, r = await V.callFunction("gerar-roteiro", { duracao: 30, propriedade: { tipo: p.tipo, bairro: p.bairro, cidade: p.cidade, preco: p.preco, finalidade: p.finalidade, quartos: p.quartos, area_m2: p.area_m2, diferenciais: p.diferenciais || [] } });
        rs.narrTexto = [r.gancho, r.roteiro, r.cta].filter(Boolean).join("\n"); $("rl-nar-t").value = rs.narrTexto;
      } catch (e) { V.toast(e.message || "Não consegui gerar o texto."); }
      b.disabled = false; b.textContent = "Gerar texto da narração";
    };
    $("rl-exp").onclick = async function () {
      pararPrevia();
      abrir(cab("🎬 Exportando…") + '<p class="vd-hint">Gerando o vídeo no seu aparelho em tempo real. Mantenha esta tela aberta e o aparelho desbloqueado.</p>' +
        '<div class="vd-bar"><i id="vd-pb"></i></div><p class="vd-hint" id="vd-pt">Começando…</p><button class="vd-btn" id="rl-cancel" style="flex:none">Cancelar</button>');
      $("rl-cancel").onclick = function () { if (cancelar) cancelar(); telaReels(); };
      try {
        var blob = await exportarReels(function (n) { var b = $("vd-pb"); if (b) { b.style.width = n + "%"; $("vd-pt").textContent = "Exportando… " + n + "%"; } });
        if (!blob || !root || root.hidden) return;
        blob = await mp4Normal(blob);
        var nome = "reels-" + String(rs.p.titulo || "imovel").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
        abrir(cab("🎬 Reels pronto") + '<video class="vd-player" controls playsinline loop autoplay src="' + url(blob) + '"></video>' +
          (rs.musicaInsta ? '<p class="vd-hint">🎵 Sem música, como você escolheu: poste pelo app do Instagram (botão Compartilhar no celular) e escolha a música lá. Se agendar, a Vitrine te avisa na hora de postar.</p>' : "") +
          (podeAgendar(blob) ? '<button class="vd-btn pri" id="vd-ag" style="flex:none">' + (rs.musicaInsta ? "📅 Agendar para postar pelo app" : "📅 Agendar no Instagram") + '</button>' : "") +
          '<div class="vd-row"><button class="vd-btn' + (podeAgendar(blob) ? "" : " pri") + '" id="vd-dl">Baixar vídeo</button>' + (PODE_COMPARTILHAR ? '<button class="vd-btn" id="vd-sh">Compartilhar</button>' : "") + '</div>' +
          '<button class="vd-btn" id="rl-volta" style="flex:none">Editar de novo</button>' +
          '<p class="vd-hint">Formato ' + extDe(blob.type).toUpperCase() + ' 9:16. ' + (extDe(blob.type) === "webm" ? "Se o Instagram não aceitar o WEBM, gere pelo Chrome atualizado, que grava MP4." : "Pronto para postar no Instagram.") + '</p>');
        $("vd-dl").onclick = function () { baixar(blob, nome); };
        if ($("vd-sh")) $("vd-sh").onclick = function () { compartilhar(blob, nome, ""); };
        if ($("vd-ag")) $("vd-ag").onclick = function () {
          var p = rs.p || {};
          var leg = [rs.hook, "📲 Fotos e detalhes: link na bio"].filter(Boolean).join("\n\n");
          var ttl = rs.hook || p.titulo || "Reels do imóvel";
          var manual = !!rs.musicaInsta;
          fechar(); V.agendarVideoNovo(blob, { titulo: ttl, legenda: leg, propriedade_id: p.id || null, manual: manual });
        };
        $("rl-volta").onclick = telaReels;
      } catch (e) {
        abrir(cab("🎬 Reels do imóvel") + '<p>' + esc(e.message || "Erro ao gerar o vídeo.") + '</p><button class="vd-btn" id="rl-volta" style="flex:none">Voltar</button>');
        $("rl-volta").onclick = telaReels;
      }
    };
  }

  /* ============================================================
     2) ROTEIRO + TELEPROMPTER + CÂMERA
  ============================================================ */
  var fluxo = { modo: "assunto", duracao: 30, assunto: "", propId: "", roteiro: "", legenda: "" };

  function telaEscolha() {
    var props = state.propriedades || [];
    abrir(cab("🎥 Gravar vídeo com roteiro") +
      '<p class="vd-hint dif">A IA escreve o roteiro, você lê no teleprompter olhando para a câmera.</p>' +
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
  /* ---------- tela do roteiro: 3 jeitos de usar ---------- */
  var OPCAO_KEY = "vd-opcao-v1";
  function lerOpcao() { try { return localStorage.getItem(OPCAO_KEY) || "pip"; } catch (e) { return "pip"; } }
  function salvarOpcao(o) { try { localStorage.setItem(OPCAO_KEY, o); } catch (e) {} }
  var PIP_OK = (function () {
    try {
      if (!HTMLCanvasElement.prototype.captureStream || typeof window.MediaRecorder !== "function") return false;
      var v = document.createElement("video");
      return !!((document.pictureInPictureEnabled && typeof v.requestPictureInPicture === "function") || typeof v.webkitSetPresentationMode === "function");
    } catch (e) { return false; }
  })();

  function copiar(texto, msg) {
    function ok() { V.toast(msg || "Copiado!"); }
    function antigo() {
      try {
        var t = document.createElement("textarea"); t.value = texto; t.style.cssText = "position:fixed;left:-9999px;top:0"; document.body.appendChild(t);
        t.select(); t.setSelectionRange(0, 999999); var r = document.execCommand("copy"); document.body.removeChild(t);
        if (r) ok(); else V.toast("Não consegui copiar. Selecione o texto e copie.");
      } catch (e) { V.toast("Não consegui copiar. Selecione o texto e copie."); }
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(texto).then(ok, antigo); return; } } catch (e) {}
    antigo();
  }

  /* relógio que continua com a aba em segundo plano: Web Worker (timers de worker não sofrem a limitação das abas ocultas);
     se o navegador bloquear o worker, cai para setInterval(33ms) na própria página. */
  function criarRelogio(fn) {
    var w = null, iv = null, ult = performance.now(), vivo = true;
    function bate() { if (!vivo) return; var n = performance.now(), dt = Math.min(0.5, (n - ult) / 1000); ult = n; fn(dt); }
    try {
      w = new Worker("relogio-worker.js");   // arquivo do próprio site (a CSP não permite worker de blob:)
      w.onmessage = bate; w.onerror = function () { try { w.terminate(); } catch (e) {} w = null; if (!iv && vivo) iv = setInterval(bate, 33); };
    } catch (e) { w = null; }
    if (!w) iv = setInterval(bate, 33);
    return function () { vivo = false; if (iv) clearInterval(iv); if (w) { try { w.postMessage(0); w.terminate(); } catch (e) {} } };
  }

  /* motor do teleprompter em canvas: rolagem por tempo (dt), frase atual em lima */
  function criarMotor(cv, o) {
    var ctx = cv.getContext("2d"), esc = o.escala || 1.7;
    var paras = [], total = 0, base = 40, readY = 0, m = { y: 0, fase: "parado", ft: 0 };
    function px() { return Math.round(prefs.fonte * esc); }
    m.layout = function () {
      var ratio = total > 0 ? m.y / total : 0, p = px(), lh = p * 1.38, gap = p * 0.55, maxW = cv.width - p * 1.2;
      ctx.font = "800 " + p + "px " + FONTE;
      paras = []; var t = 0;
      fluxo.roteiro.split(/\n+/).filter(function (l) { return l.trim(); }).forEach(function (l) {
        var ls = quebrar(ctx, l.trim(), maxW), h = ls.length * lh; paras.push({ ls: ls, top: t, h: h }); t += h + gap;
      });
      total = t; readY = cv.height * 0.34;
      base = Math.max(12, Math.min(400, total / (fluxo.duracao || 30)));
      m.y = ratio * total; m.total = total;
    };
    m.tocar = function () {
      if (m.fase === "rodando" || m.fase === "contagem") return;
      if (m.fase === "fim") m.y = 0;
      if (m.y < 1 && prefs.contagem) { m.fase = "contagem"; m.ft = 3; } else m.fase = "rodando";
    };
    m.pausar = function () { m.fase = "parado"; };
    m.alternar = function () { if (m.fase === "parado" || m.fase === "fim") m.tocar(); else m.pausar(); };
    m.inicio = function () { m.y = 0; m.fase = "parado"; };
    m.agendar = function (s) { if (s > 0) { m.fase = "espera"; m.ft = s; } else m.tocar(); };
    m.tick = function (dt) {
      if (m.fase === "espera") { m.ft -= dt; if (m.ft <= 0) { m.fase = "parado"; m.tocar(); } }
      else if (m.fase === "contagem") { m.ft -= dt; if (m.ft <= 0) m.fase = "rodando"; }
      else if (m.fase === "rodando") { m.y += base * prefs.vel * dt; if (m.y >= total) { m.y = total; m.fase = "fim"; } }
      m.desenhar();
    };
    m.desenhar = function () {
      var W2 = cv.width, H2 = cv.height, p = px(), lh = p * 1.38;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W2, H2);
      ctx.save();
      if (o.espelho && prefs.espTxt) { ctx.translate(W2, 0); ctx.scale(-1, 1); }
      ctx.fillStyle = "rgba(212,255,63,.12)"; ctx.fillRect(0, readY - p * 0.2, W2, lh + p * 0.1);
      ctx.fillStyle = LIMA; ctx.fillRect(0, readY - p * 0.2, Math.max(4, p * 0.1), lh + p * 0.1);
      ctx.font = "800 " + p + "px " + FONTE; ctx.textAlign = "center"; ctx.textBaseline = "top";
      var cur = -1;
      paras.forEach(function (q, i) { if (m.y >= q.top && m.y < q.top + q.h + p * 0.55) cur = i; });
      paras.forEach(function (q, i) {
        var yy = readY + q.top - m.y; if (yy > H2 || yy + q.h < 0) return;
        ctx.fillStyle = i === cur ? LIMA : "rgba(255,255,255,.62)";
        q.ls.forEach(function (l, k) { ctx.fillText(l, W2 / 2, yy + k * lh); });
      });
      if (m.fase === "fim") { ctx.fillStyle = LIMA; ctx.fillText("FIM", W2 / 2, Math.min(H2 - lh * 2, readY + 40)); }
      ctx.restore();
      // máscara de fade em cima e embaixo
      var g = ctx.createLinearGradient(0, 0, 0, H2); g.addColorStop(0, "rgba(0,0,0,.9)"); g.addColorStop(0.1, "rgba(0,0,0,0)"); g.addColorStop(0.9, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.9)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W2, H2);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (m.fase === "contagem") {
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, 0, W2, H2);
        ctx.fillStyle = LIMA; ctx.font = "900 " + Math.round(W2 * 0.5) + "px " + FONTE; ctx.fillText(String(Math.max(1, Math.ceil(m.ft))), W2 / 2, H2 / 2);
      } else if (m.fase === "espera") {
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(0, 0, W2, H2);
        ctx.fillStyle = "#fff"; ctx.font = "800 " + Math.round(W2 * 0.07) + "px " + FONTE; ctx.fillText("Começa em", W2 / 2, H2 * 0.4);
        ctx.fillStyle = LIMA; ctx.font = "900 " + Math.round(W2 * 0.3) + "px " + FONTE; ctx.fillText(String(Math.ceil(m.ft)), W2 / 2, H2 / 2);
      } else if (m.fase === "parado") {
        ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillRect(0, H2 - H2 * 0.14, W2, H2 * 0.14);
        ctx.fillStyle = "#fff"; ctx.font = "700 " + Math.round(W2 * 0.045) + "px " + FONTE;
        ctx.fillText(m.y < 1 ? o.dica : "PAUSADO", W2 / 2, H2 - H2 * 0.07);
      }
    };
    m.layout();
    return m;
  }

  function telaRoteiro() {
    var ult = lerOpcao(); if (ult === "pip" && !PIP_OK) ult = "tela";
    function card(id, tit, corpo) {
      return '<div class="vd-op' + (id === "pip" ? " dest" : "") + (ult === id ? " ult" : "") + '" id="op-' + id + '"><b>' + tit + (ult === id ? ' <em>última usada</em>' : '') + '</b>' + corpo + '</div>';
    }
    function range(id, rot, min, max, step, val, fmt) {
      return '<label class="vd-rg"><span>' + rot + '</span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"><em id="' + id + '-v">' + fmt(val) + '</em></label>';
    }
    var fPx = function (v) { return v + "px"; }, fVel = function (v) { return (+v).toFixed(1).replace(".", ",") + "x"; };
    var opPip = PIP_OK
      ? card("pip", "📱 Teleprompter flutuante (gravar no app Câmera)",
        '<p class="vd-hint">O app prepara um vídeo do roteiro rolando (leva cerca de 1 vez o tempo de leitura). Depois você abre esse vídeo numa janelinha flutuante e grava no app Câmera.</p>' +
        '<div id="pip-cfg">' + range("pp-fonte", "Letra", 22, 64, 1, prefs.fonte, fPx) + range("pp-vel", "Velocidade", 0.3, 2.5, 0.1, prefs.vel, fVel) +
        '<button class="vd-btn pri" id="pp-ini" style="flex:none;width:100%">Preparar teleprompter</button></div>' +
        '<div id="pip-prog" hidden><p class="vd-hint" id="pp-pr">Preparando teleprompter… 0%</p><div style="height:8px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden"><div id="pp-bar" style="height:100%;width:0;background:#D4FF3F"></div></div>' +
        '<p class="vd-hint"><b>Deixe esta página aberta e a tela ligada até terminar.</b></p><button class="vd-btn" id="pp-cancel" style="flex:none;width:100%">Cancelar</button></div>' +
        '<div id="pip-res" hidden><div id="pp-vbox" style="text-align:center"></div>' +
        '<button class="vd-btn pri" id="pp-abrir" style="flex:none;width:100%;font-size:18px;padding:16px">Abrir janelinha flutuante</button>' +
        '<p class="vd-hint">Se a janelinha não abrir, toque no ícone de janelinha (⧉) no canto do vídeo.</p>' +
        '<p class="vd-hint">Com a janelinha aberta, abra o app Câmera em Vídeo, posicione a janelinha perto da lente, toque ▶ na janelinha e grave.</p>' +
        '<div class="vd-row"><button class="vd-btn" id="pp-baixar">Baixar vídeo do teleprompter</button><button class="vd-btn" id="pp-refaz">Refazer com outra velocidade</button></div></div>')
      : '<div class="vd-op" id="op-pip"><b>📱 Teleprompter flutuante</b><p class="vd-hint">Seu navegador não permite janela flutuante — use a opção 2.</p></div>';
    abrir(cab("Seu roteiro") + '<p class="vd-hint">Edite do seu jeito. Uma frase por linha.</p>' +
      '<textarea id="vd-rot" style="min-height:220px;font-size:17px;line-height:1.4">' + esc(fluxo.roteiro) + '</textarea>' +
      '<div class="vd-row"><button class="vd-btn" id="vd-cp-r">Copiar roteiro</button></div>' +
      '<p class="vd-hint">Legenda do post (copie na hora de publicar):</p><textarea id="vd-leg" style="min-height:80px">' + esc(fluxo.legenda) + '</textarea>' +
      '<div class="vd-row"><button class="vd-btn" id="vd-cp-l">Copiar legenda</button></div>' +
      '<div class="rl-lb" style="margin-top:6px">Como você quer gravar?</div>' + opPip +
      card("tela", "🖥️ Ler em outra tela",
        '<p class="vd-hint">Teleprompter em tela cheia, sem câmera. Use num notebook, tablet ou outro celular apoiado atrás do celular que grava. Para abrir no outro aparelho, copie o roteiro ou mande por WhatsApp.</p>' +
        '<button class="vd-btn' + (PIP_OK ? "" : " pri") + '" id="op-tela-go" style="flex:none;width:100%">Abrir em tela cheia</button>' +
        '<div class="vd-row"><button class="vd-btn" id="vd-cp-r2">Copiar roteiro</button><button class="vd-btn" id="vd-wa">Enviar pro WhatsApp</button></div>') +
      card("cam", "🎥 Gravar aqui mesmo", '<p class="vd-hint">Câmera do navegador com o texto rolando por cima. A qualidade é menor que a do app Câmera.</p><button class="vd-btn" id="vd-grav" style="flex:none;width:100%">Ir para a gravação</button>') +
      '<div class="vd-row"><button class="vd-btn" id="vd-volta">Voltar</button></div>');
    function ler() { fluxo.roteiro = $("vd-rot").value.trim(); fluxo.legenda = $("vd-leg").value; return fluxo.roteiro; }
    function lerNaoVazio() { if (!ler()) { V.toast("O roteiro está vazio."); return false; } return true; }
    $("vd-volta").onclick = function () { ler(); telaEscolha(); };
    $("vd-cp-r").onclick = function () { if (lerNaoVazio()) copiar(fluxo.roteiro, "Roteiro copiado!"); };
    $("vd-cp-r2").onclick = $("vd-cp-r").onclick;
    $("vd-cp-l").onclick = function () { ler(); if (!fluxo.legenda.trim()) { V.toast("A legenda está vazia."); return; } copiar(fluxo.legenda, "Legenda copiada!"); };
    $("vd-wa").onclick = function () { if (!lerNaoVazio()) return; salvarOpcao("tela"); window.open("https://wa.me/?text=" + encodeURIComponent(fluxo.roteiro), "_blank", "noopener"); };
    $("vd-grav").onclick = function () { if (!lerNaoVazio()) return; salvarOpcao("cam"); telaGravacao(); };
    $("op-tela-go").onclick = function () { if (!lerNaoVazio()) return; salvarOpcao("tela"); telaLeitura(); };
    var pip = null;
    if (PIP_OK) {
      $("pp-fonte").oninput = function () { prefs.fonte = +this.value; $("pp-fonte-v").textContent = fPx(prefs.fonte); salvarPrefs(); };
      $("pp-vel").oninput = function () { prefs.vel = +this.value; $("pp-vel-v").textContent = fVel(prefs.vel); salvarPrefs(); };
      $("pp-ini").onclick = function () { if (lerNaoVazio()) prepararPip(); };
      $("pp-cancel").onclick = function () { pararPrevia(); };
      $("pp-refaz").onclick = function () { pararPrevia(); };
    }
    function mostra(qual) {
      ["pip-cfg", "pip-prog", "pip-res"].forEach(function (i) { var e = $(i); if (e) e.hidden = (i !== qual); });
    }
    function prepararPip() {
      salvarOpcao("pip");
      if (pip) pararPrevia();
      var cv = document.createElement("canvas"); cv.width = 720; cv.height = 1280;
      var m = criarMotor(cv, { escala: 1.7, espelho: false, dica: "" });
      m.y = 0; m.fase = "contagem"; m.ft = 3; m.desenhar();
      var durLeitura = m.total / (Math.max(12, Math.min(400, m.total / (fluxo.duracao || 30))) * prefs.vel);
      var dur = 3 + durLeitura + 2;
      var tipos = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"], tipo = "";
      for (var i = 0; i < tipos.length; i++) { try { if (MediaRecorder.isTypeSupported(tipos[i])) { tipo = tipos[i]; break; } } catch (e) {} }
      var stream2, rec, chunks = [], ini = performance.now(), ult = ini, acabou = false, raf = 0, iv = 0, url = null, vid = null;
      pip = { vid: null };
      function limpa() {
        acabou = true; if (raf) cancelAnimationFrame(raf); if (iv) clearInterval(iv);
        try { if (rec && rec.state !== "inactive") { rec.onstop = null; rec.stop(); } } catch (e) {}
        try { if (stream2) stream2.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try { if (vid) { if (document.pictureInPictureElement === vid) document.exitPictureInPicture(); if (vid.webkitPresentationMode === "picture-in-picture") vid.webkitSetPresentationMode("inline"); vid.pause(); } } catch (e) {}
        if (url) { try { URL.revokeObjectURL(url); } catch (e) {} url = null; }
        pip = null; pararPrevia = function () {};
        if ($("pip-cfg")) { mostra("pip-cfg"); var b = $("pp-vbox"); if (b) b.innerHTML = ""; }
      }
      pararPrevia = limpa;
      mostra("pip-prog");
      function prog(p) {
        p = Math.max(0, Math.min(100, Math.round(p)));
        var t = $("pp-pr"), b = $("pp-bar"); if (t) t.textContent = "Preparando teleprompter… " + p + "%"; if (b) b.style.width = p + "%";
      }
      prog(0);
      try {
        stream2 = cv.captureStream(30);
        rec = tipo ? new MediaRecorder(stream2, { mimeType: tipo, videoBitsPerSecond: 2500000 }) : new MediaRecorder(stream2);
      } catch (e) { limpa(); V.toast("Não consegui preparar o vídeo. Use a opção 2 ou 3."); return; }
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rec.onerror = function () { if (!acabou) { limpa(); V.toast("Erro ao gravar o teleprompter. Tente de novo."); } };
      rec.onstop = function () { pronto(); };
      function passo() {
        if (acabou) return;
        var n = performance.now(), dt = Math.min(0.5, (n - ult) / 1000); ult = n;
        m.tick(dt);
        var el = (n - ini) / 1000; prog(el / dur * 100);
        if (el >= dur) { acabou = true; if (raf) cancelAnimationFrame(raf); if (iv) clearInterval(iv); try { rec.stop(); } catch (e) { pronto(); } }
      }
      function quadro() { if (acabou) return; passo(); raf = requestAnimationFrame(quadro); }
      rec.start(1000);
      raf = requestAnimationFrame(quadro);
      iv = setInterval(passo, 100);
      function pronto() {
        if (!pip) return;
        var blob = new Blob(chunks, { type: rec.mimeType || tipo || "video/webm" });
        if (!blob.size) { limpa(); V.toast("O vídeo saiu vazio. Tente de novo."); return; }
        var ext = /mp4/.test(blob.type) ? "mp4" : "webm";
        url = URL.createObjectURL(blob);
        vid = document.createElement("video");
        vid.muted = true; vid.defaultMuted = true; vid.playsInline = true; vid.controls = true; vid.preload = "auto";
        vid.setAttribute("playsinline", ""); vid.setAttribute("webkit-playsinline", ""); vid.setAttribute("muted", ""); vid.setAttribute("autopictureinpicture", "");
        vid.src = url;
        vid.style.cssText = "width:100%;max-width:220px;aspect-ratio:9/16;background:#000;border-radius:10px;margin:8px auto;display:block";
        pip.vid = vid;
        $("pp-vbox").appendChild(vid);
        try { vid.load(); } catch (e) {}
        mostra("pip-res");
        // tudo SÍNCRONO dentro do toque (o iOS exige o gesto do usuário)
        $("pp-abrir").onclick = function () {
          try { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
          try {
            if (vid.webkitSupportsPresentationMode && typeof vid.webkitSetPresentationMode === "function") vid.webkitSetPresentationMode("picture-in-picture");
            else if (typeof vid.requestPictureInPicture === "function") { var q = vid.requestPictureInPicture(); if (q && q.catch) q.catch(function () { V.toast("Toque no ícone ⧉ no canto do vídeo."); }); }
          } catch (e) { V.toast("Toque no ícone ⧉ no canto do vídeo."); }
        };
        $("pp-baixar").onclick = function () {
          var a = document.createElement("a"); a.href = url; a.download = "teleprompter." + ext; document.body.appendChild(a); a.click();
          setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 500);
        };
      }
    }
  }

  /* opção 2: teleprompter em tela cheia, sem câmera */
  function telaLeitura() {
    abrirCheia('<div class="cm lt" id="lt"><canvas id="lt-cv" style="position:absolute;inset:0;width:100%;height:100%"></canvas>' +
      '<div class="cm-top"><button class="cm-ic" id="lt-x" aria-label="Voltar">' + svg("x") + '</button><div class="vd-hint" style="color:#fff;font-size:12px">Toque na tela: pausa · espaço pausa · setas mudam a velocidade</div></div>' +
      '<div class="lt-bar"><button id="lt-ini">⏮</button><button id="lt-pl">▶</button><button id="lt-m">−</button><span id="lt-v"></span><button id="lt-p">+</button><button id="lt-am">A−</button><button id="lt-ap">A+</button><button id="lt-esp" aria-label="Espelhar">⇋</button></div></div>');
    var cv = $("lt-cv"), dpr = Math.min(2, window.devicePixelRatio || 1);
    function tam() { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); }
    tam();
    var m = criarMotor(cv, { escala: 1.5 * dpr, espelho: true, dica: "Toque na tela para começar" });
    m.desenhar();
    function vel() { $("lt-v").textContent = prefs.vel.toFixed(1).replace(".", ",") + "x"; $("lt-pl").textContent = (m.fase === "rodando" || m.fase === "contagem") ? "⏸" : "▶"; $("lt-esp").classList.toggle("on", prefs.espTxt); }
    function av(d) { prefs.vel = Math.max(0.3, Math.min(2.5, Math.round((prefs.vel + d) * 10) / 10)); salvarPrefs(); vel(); }
    function af(d) { prefs.fonte = Math.max(22, Math.min(64, prefs.fonte + d)); salvarPrefs(); m.layout(); }
    var parar = criarRelogio(function (dt) { m.tick(dt); vel(); });
    var rs = function () { tam(); m.layout(); m.desenhar(); };
    window.addEventListener("resize", rs);
    function tecla(e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) return;
      if (e.code === "Space") { e.preventDefault(); m.alternar(); }
      else if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); av(0.1); }
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); av(-0.1); }
      else if (e.key === "Escape") telaRoteiro();
      vel();
    }
    document.addEventListener("keydown", tecla);
    var lock = null, vivo = true;
    function trava() { try { if (vivo && navigator.wakeLock && document.visibilityState === "visible") navigator.wakeLock.request("screen").then(function (w) { if (!vivo) { w.release(); return; } lock = w; }).catch(function () {}); } catch (e) {} }
    trava(); document.addEventListener("visibilitychange", trava);
    pararPrevia = function () {
      vivo = false; parar(); window.removeEventListener("resize", rs); document.removeEventListener("keydown", tecla); document.removeEventListener("visibilitychange", trava);
      if (lock) { try { lock.release(); } catch (e) {} lock = null; }
      pararPrevia = function () {};
    };
    cv.onclick = function () { m.alternar(); vel(); };
    $("lt-x").onclick = telaRoteiro;
    $("lt-pl").onclick = function () { m.alternar(); vel(); };
    $("lt-ini").onclick = function () { m.inicio(); vel(); };
    $("lt-m").onclick = function () { av(-0.1); }; $("lt-p").onclick = function () { av(0.1); };
    $("lt-am").onclick = function () { af(-2); }; $("lt-ap").onclick = function () { af(2); };
    $("lt-esp").onclick = function () { prefs.espTxt = !prefs.espTxt; salvarPrefs(); vel(); m.desenhar(); };
    vel();
  }

  var IC = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    flip: '<path d="M20 7h-9a5 5 0 0 0-5 5M20 7l-3-3M20 7l-3 3M4 17h9a5 5 0 0 0 5-5M4 17l3-3M4 17l3 3"/>',
    raio: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    ajustes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    texto: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'
  };
  function svg(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg>'; }
  function norm(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, ""); }

  async function abrirStream(S) {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    // pede a imagem já em pé (9:16) e na maior resolução da opção; muitos celulares entregam deitado (16:9)
    // mesmo assim — nesse caso a gravação passa pelo canvas 9:16 (ver iniciaCanvas), garantindo vídeo vertical.
    var alt = prefs.res === "1080" ? 1920 : 1280, lar = prefs.res === "1080" ? 1080 : 720;
    // sem aspectRatio: no iPhone essa restrição faz o Safari RECORTAR o sensor (imagem com "zoom" e menos nítida).
    // Pede a resolução na orientação em que a pessoa segura o celular; o recorte 9:16, se precisar, é feito por nós.
    var emPeTela = (window.innerHeight || 0) >= (window.innerWidth || 0);
    var base = { width: { ideal: emPeTela ? lar : alt }, height: { ideal: emPeTela ? alt : lar }, frameRate: { ideal: 30 } };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: Object.assign({ facingMode: { ideal: prefs.facing } }, base), audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });   // câmera não aceitou as restrições
    }
    S.vt = stream.getVideoTracks()[0];
    S.caps = {}; try { S.caps = S.vt.getCapabilities ? S.vt.getCapabilities() : {}; } catch (e) {}
    S.set = {}; try { S.set = S.vt.getSettings ? S.vt.getSettings() : {}; } catch (e) {}
    S.torch = false;
    // a câmera frontal é espelhada só na tela; o arquivo gravado sai sem espelho
    var front = (S.set.facingMode ? S.set.facingMode === "user" : prefs.facing === "user");
    var cam = $("cm-v"); if (cam) { cam.srcObject = stream; cam.classList.toggle("esp", front); S.front = front; cam.play().catch(function () {}); }
  }

  async function telaGravacao() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      abrir(cab("Gravação") + '<p>Seu navegador não permite gravar vídeo aqui. Use o Chrome (Android/computador) ou o Safari atualizado no iPhone.</p>'); return;
    }
    abrirCheia(
      '<div class="cm" id="cm"><video class="cm-v" id="cm-v" autoplay muted playsinline></video><div class="cm-grade" id="cm-grade"></div>' +
      '<div class="cm-tp" id="cm-tp"><div class="cm-tpf" id="cm-tpf"></div><div class="cm-tpl" id="cm-tpl"></div><div class="cm-tpt" id="cm-tpt"></div></div>' +
      '<div class="cm-pausa" id="cm-pausa">Pausado · toque no texto para continuar</div>' +
      '<div class="cm-top"><button class="cm-ic" id="cm-x" aria-label="Fechar">' + svg("x") + '</button><div class="cm-tm" id="cm-tm">00:00</div>' +
      '<div class="cm-tb"><button class="cm-ic" id="cm-flip" aria-label="Trocar câmera">' + svg("flip") + '</button><button class="cm-ic" id="cm-torch" aria-label="Lanterna" hidden>' + svg("raio") + '</button><button class="cm-ic" id="cm-cfg" aria-label="Configurações">' + svg("ajustes") + '</button></div></div>' +
      '<div class="cm-side"><button id="cm-mais" aria-label="Mais rápido">+</button><span id="cm-vel"></span><button id="cm-menos" aria-label="Mais devagar">−</button></div>' +
      '<div class="cm-count" id="cm-ct"></div><div class="cm-zi" id="cm-zi"></div>' +
      '<div class="cm-bot"><div class="cm-zoom" id="cm-zoom"></div><div class="cm-shut"><button class="cm-ic" id="cm-txt" aria-label="Mostrar ou esconder o texto">' + svg("texto") + '</button><button class="cm-rec" id="cm-rec" aria-label="Gravar"><i></i></button>' +
      (VOZ_OK ? '<button class="cm-ic" id="cm-voz" aria-label="Rolagem pela voz">' + svg("mic") + '</button>' : '<span style="width:48px"></span>') + '</div></div>' +
      '<div class="cm-sheet" id="cm-sheet" hidden></div></div>');

    var S = { vt: null, caps: {}, set: {}, torch: false, gravando: false, contando: false, rodando: false, y: 0, ultimo: 0, base: 40, readY: 0, cur: 0, marcado: 0 };
    $("cm-x").onclick = fechar;
    try {
      await abrirStream(S);
    } catch (e) {
      abrir(cab("Gravação") + '<p>Não consegui acessar a câmera e o microfone. Libere a permissão no navegador e tente de novo.</p><button class="vd-btn" id="vd-volta">Voltar</button>');
      $("vd-volta").onclick = telaRoteiro; return;
    }
    try { if (navigator.wakeLock) { navigator.wakeLock.request("screen").then(function (w) { destravarTela = function () { w.release(); }; }).catch(function () {}); } } catch (e) {}

    /* ----- teleprompter ----- */
    var tp = $("cm-tp"), tpt = $("cm-tpt"), tpl = $("cm-tpl"), tpf = $("cm-tpf");
    var ps = [], words = [], pTop = [], pBot = [], pAtual = -1;
    fluxo.roteiro.split(/\n+/).filter(function (l) { return l.trim(); }).forEach(function (l) {
      var p = document.createElement("p");
      l.trim().split(/\s+/).forEach(function (w) { var sp = document.createElement("span"); sp.textContent = w + " "; p.appendChild(sp); words.push({ el: sp, n: norm(w) }); });
      tpt.appendChild(p); ps.push(p);
    });
    function layoutTp() {
      tp.style.width = prefs.larg + "%";
      tpf.style.background = "rgba(0,0,0," + (prefs.fundo / 100) + ")";
      tpt.style.fontSize = prefs.fonte + "px";
      S.readY = tp.clientHeight * 0.3;
      tpl.style.top = (S.readY - 4) + "px"; tpl.style.height = (prefs.fonte * 1.38 + 8) + "px";
      pTop = ps.map(function (p) { return p.offsetTop; }); pBot = ps.map(function (p) { return p.offsetTop + p.offsetHeight; });
      pAtual = -1;
      S.base = Math.max(12, Math.min(200, tpt.scrollHeight / (fluxo.duracao || 30)));
      pos();
    }
    function pos() { tpt.style.transform = "translateY(" + (S.readY - S.y) + "px)" + (prefs.espTxt ? " scaleX(-1)" : ""); }
    layoutTp();
    // velocidade-base: percorre o texto na duração escolhida; o multiplicador salvo ajusta
    function mostraVel() { $("cm-vel").textContent = prefs.vel.toFixed(1).replace(".", ",") + "x"; }
    mostraVel();
    function ajustaVel(d) { prefs.vel = Math.max(0.3, Math.min(2.5, Math.round((prefs.vel + d) * 10) / 10)); mostraVel(); salvarPrefs(); var r = $("cfg-vel"); if (r) { r.value = prefs.vel; $("cfg-vel-v").textContent = prefs.vel.toFixed(1) + "x"; } }
    $("cm-mais").onclick = function () { ajustaVel(0.1); };
    $("cm-menos").onclick = function () { ajustaVel(-0.1); };
    $("cm-grade").classList.toggle("on", prefs.grade);

    function marcaPausa() { $("cm-pausa").classList.toggle("on", S.gravando && !S.rodando); }
    // toque no texto pausa/continua; arrastar rola na mão
    var arr = null;
    tp.onpointerdown = function (e) { arr = { y0: e.clientY, sy: S.y, mov: false }; try { tp.setPointerCapture(e.pointerId); } catch (x) {} };
    tp.onpointermove = function (e) {
      if (!arr || S.pinca) return; var dy = e.clientY - arr.y0;
      if (Math.abs(dy) > 6) { arr.mov = true; S.y = Math.max(0, Math.min(tpt.scrollHeight, arr.sy - dy)); if (S.vozAtiva) S.cur = achaPalavra(S.y); pos(); }
    };
    tp.onpointerup = function () {
      if (arr && !arr.mov && !S.pinca) { S.rodando = !S.rodando; marcaPausa(); if (!S.gravando) S.rodando = false; }
      arr = null;
    };
    function achaPalavra(y) { for (var i = 0; i < words.length; i++) if (words[i].el.offsetTop + 2 >= y) return i; return words.length - 1; }
    $("cm-txt").onclick = function () { var off = tp.style.display === "none"; tp.style.display = off ? "" : "none"; this.classList.toggle("on", !off); };

    // voz: avança conforme a fala; sem Web Speech, a rolagem é por tempo
    S.vozAtiva = false;
    function aoOuvir(txt) {
      if (!prefs.voz || !S.rodando) return;
      var ws = String(txt).split(/\s+/).map(norm).filter(Boolean), melhor = -1;
      for (var k = ws.length - 1; k >= Math.max(0, ws.length - 4) && melhor < 0; k--) {
        var lim = ws[k].length >= 4 ? 16 : 4;
        for (var j = S.cur; j < Math.min(words.length, S.cur + lim); j++) if (words[j].n === ws[k]) { melhor = j + 1; break; }
      }
      if (melhor > S.cur) S.cur = melhor;
    }
    function anim(ts) {
      if (!root || root.hidden || !$("cm-tpt")) return;
      var dt = Math.min(0.1, (ts - S.ultimo) / 1000); S.ultimo = ts;
      if (S.rodando) {
        var max = tpt.scrollHeight;
        if (prefs.voz && reco) {
          var alvo = words[Math.min(S.cur, words.length - 1)].el.offsetTop;
          S.y += (alvo - S.y) * Math.min(1, dt * (2 + prefs.vel * 2)); S.y = Math.min(S.y, max);
          for (; S.marcado < S.cur && S.marcado < words.length; S.marcado++) words[S.marcado].el.className = "d";
        } else S.y = Math.min(max, S.y + S.base * prefs.vel * dt);
        pos();
      }
      // destaca a frase da linha-guia
      var yy = S.y + 6, ia = -1;
      for (var i = 0; i < pTop.length; i++) if (yy >= pTop[i] && yy < pBot[i] + 8) { ia = i; break; }
      if (ia < 0 && pTop.length && yy >= pBot[pBot.length - 1]) ia = pTop.length - 1;
      if (ia !== pAtual) { if (pAtual >= 0 && ps[pAtual]) ps[pAtual].classList.remove("on"); if (ia >= 0) ps[ia].classList.add("on"); pAtual = ia; }
      requestAnimationFrame(anim);
    }
    requestAnimationFrame(function (ts) { S.ultimo = ts; anim(ts); });

    /* ----- controles da câmera ----- */
    async function aplicar(adv) { try { await S.vt.applyConstraints({ advanced: [adv] }); return true; } catch (e) { return false; } }
    /* ----- zoom -----
       Zoom SEMPRE disponível nas duas câmeras:
       - Com zoom de hardware (track.getCapabilities().zoom): applyConstraints, faixa real da câmera (melhor qualidade).
       - Sem hardware (frontal / iPhone): ZOOM DIGITAL de 1x a 3x. O <video> do preview recebe transform scale
         centralizado (mantendo o espelho da frontal) e a GRAVAÇÃO sai de um canvas 9:16 (720p/1080p) onde o frame
         do vídeo é recortado no centro conforme o zoom, SEM espelho, via captureStream(30) + a trilha de áudio do mic.
         Como o usuário pode mexer no zoom durante a gravação, no modo digital gravamos SEMPRE pelo canvas (a fonte
         nunca troca no meio; o modo é definido ao abrir a câmera e a gravação usa o modo vigente no início).
       - Áudio/vídeo: a trilha de áudio é a original do getUserMedia (mesmo relógio da câmera); o canvas só desenha
         um frame por frame de câmera (requestVideoFrameCallback quando existe), então o atraso é ~1 frame.
       - O arquivo é um webm/mp4 normal do MediaRecorder, então a legenda automática (gerarLegenda) segue igual. */
    var ZD_MAX = 3;
    S.zAlvo = S.zAlvo || 1; S.zAtual = S.zAtual || 1; S.digital = false; S.hwUlt = 0; S.hwOcupado = false;
    function zoomRange() { var z = S.caps && S.caps.zoom; return z && typeof z.min === "number" && typeof z.max === "number" && z.max > z.min ? z : null; }
    function zFaixa() { var z = S.digital ? null : zoomRange(); return z ? { min: z.min, max: z.max, step: z.step || 0.1 } : { min: 1, max: ZD_MAX, step: 0.1 }; }
    function zLimita(v) { var f = zFaixa(); return Math.max(f.min, Math.min(f.max, v)); }
    var zInd = 0;
    function mostraZoomInd() {
      var el = $("cm-zi"); if (!el) return;
      el.textContent = (Math.round(S.zAlvo * 10) / 10).toFixed(1).replace(".", ",") + "×"; el.classList.add("on");
      clearTimeout(zInd); zInd = setTimeout(function () { el.classList.remove("on"); }, 900);
    }
    function marcaBotoesZoom() {
      var box = $("cm-zoom"); if (!box) return;
      var bs = Array.prototype.slice.call(box.children), melhor = null;
      bs.forEach(function (b) { if (!melhor || Math.abs(+b.dataset.v - S.zAlvo) < Math.abs(+melhor.dataset.v - S.zAlvo)) melhor = b; });
      bs.forEach(function (b) { b.className = (b === melhor && Math.abs(+b.dataset.v - S.zAlvo) < 0.25) ? "on" : ""; });
      var r = $("cfg-zoom"); if (r) { r.value = S.zAlvo; var rv = $("cfg-zoom-v"); if (rv) rv.textContent = S.zAlvo.toFixed(1) + "×"; }
    }
    function aplicaZoom(z) {
      var cam = $("cm-v"); if (!cam) return;
      if (S.digital) {
        cam.style.transform = (S.front ? "scaleX(-1) " : "") + "scale(" + z.toFixed(4) + ")";
      } else {
        cam.style.transform = "";
        var agora = performance.now();
        if (!S.hwOcupado && agora - S.hwUlt > 60) {   // applyConstraints é assíncrono e pesado: limita a ~16/s
          S.hwOcupado = true; S.hwUlt = agora; S.set.zoom = z;
          aplicar({ zoom: z }).then(function () { S.hwOcupado = false; });
        }
      }
    }
    var zRaf = 0;
    function zTick(ts, ant) {
      zRaf = 0; var dt = Math.min(0.05, ant ? (ts - ant) / 1000 : 0.016);
      var d = S.zAlvo - S.zAtual;
      if (Math.abs(d) < 0.002) { S.zAtual = S.zAlvo; aplicaZoom(S.zAtual); return; }
      S.zAtual += d * (1 - Math.exp(-dt / 0.05));   // constante ~50ms: assenta em ~150ms
      aplicaZoom(S.zAtual);
      zRaf = requestAnimationFrame(function (t) { zTick(t, ts); });
    }
    // imediato=true (pinça): o zoom acompanha os dedos sem atraso
    function defineZoom(v, imediato) {
      // gravando direto da câmera (sem canvas) o zoom digital não iria pro arquivo: trava até parar
      if (S.gravando && S.direto && S.digital) { if (window.Vitrine && window.Vitrine.toast) window.Vitrine.toast("Ajuste o zoom antes de começar a gravar."); return; }
      S.zAlvo = zLimita(v);
      if (imediato) { S.zAtual = S.zAlvo; aplicaZoom(S.zAtual); } else if (!zRaf) zRaf = requestAnimationFrame(function (t) { zTick(t, 0); });
      marcaBotoesZoom(); mostraZoomInd();
    }
    // chamado ao abrir/trocar de câmera: decide hardware x digital e reaplica o zoom escolhido (limitado à nova faixa)
    async function iniciaZoom() {
      S.digital = !zoomRange();
      if (!S.digital) { var f = zFaixa(); if (!(await aplicar({ zoom: Math.max(f.min, Math.min(f.max, S.zAlvo)) }))) S.digital = true; }
      S.zAlvo = zLimita(S.zAlvo); S.zAtual = S.zAlvo; S.set.zoom = S.zAlvo; aplicaZoom(S.zAtual);
      montaZoom();
    }
    function montaZoom() {
      var box = $("cm-zoom"); box.innerHTML = "";
      var f = zFaixa(), cand = [0.5, 1, 2, 3].filter(function (v) { return v >= f.min - 0.01 && v <= f.max + 0.01; });   // 0.5x só se o hardware tiver
      cand.forEach(function (v) {
        var b = document.createElement("button"); b.textContent = String(v).replace(".", ",") + "×"; b.dataset.v = v;
        b.onclick = function () { defineZoom(v); };
        box.appendChild(b);
      });
      marcaBotoesZoom();
    }
    // pinça com dois dedos na tela da câmera
    (function () {
      var cm = $("cm"), d0 = 0, z0 = 1;
      function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
      cm.addEventListener("touchstart", function (e) { if (e.touches.length === 2) { S.pinca = true; arr = null; d0 = dist(e.touches); z0 = S.zAlvo; } }, { passive: true });
      cm.addEventListener("touchmove", function (e) {
        if (e.touches.length === 2 && S.pinca && d0 > 0) { e.preventDefault(); defineZoom(z0 * dist(e.touches) / d0, true); }
      }, { passive: false });
      cm.addEventListener("touchend", function (e) { if (e.touches.length < 2) setTimeout(function () { S.pinca = false; }, 80); });
      cm.addEventListener("touchcancel", function () { S.pinca = false; });
      ["gesturestart", "gesturechange"].forEach(function (n) { cm.addEventListener(n, function (e) { e.preventDefault(); }); });   // Safari: sem zoom da página
    })();
    function atualizaTorch() {
      var b = $("cm-torch"); b.hidden = !(S.caps && S.caps.torch);
      b.classList.toggle("on", S.torch);
    }
    $("cm-torch").onclick = async function () { var novo = !S.torch; if (await aplicar({ torch: novo })) { S.torch = novo; atualizaTorch(); } };
    async function recomeca() {
      try { await abrirStream(S); } catch (e) { V.toast("Não consegui abrir a câmera."); return; }
      await iniciaZoom(); atualizaTorch(); montaFolha();
    }
    $("cm-flip").onclick = async function () {
      if (S.gravando || S.contando) { V.toast("Pare a gravação para trocar de câmera."); return; }
      prefs.facing = prefs.facing === "user" ? "environment" : "user"; salvarPrefs(); await recomeca();
    };
    await iniciaZoom(); atualizaTorch();
    var voz = $("cm-voz");
    if (voz) { voz.classList.toggle("on", prefs.voz); voz.onclick = function () { prefs.voz = !prefs.voz; this.classList.toggle("on", prefs.voz); salvarPrefs(); if (prefs.voz) { S.cur = achaPalavra(S.y); S.marcado = S.cur; garantirFala(); } else if (!LEGENDA_OK && reco) { reco.parar(); reco = null; } montaFolha(); }; }

    /* ----- configurações ----- */
    function chips(id, lista, atual) {
      return '<div class="vd-row" id="' + id + '">' + lista.map(function (o) { return '<button class="vd-chip' + (o[0] === atual ? " on" : "") + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join("") + '</div>';
    }
    function range(id, rot, min, max, step, val, fmt) {
      return '<label class="cm-rg"><span>' + rot + '</span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"><em id="' + id + '-v">' + fmt(val) + '</em></label>';
    }
    function montaFolha() {
      var sh = $("cm-sheet"), c = S.caps || {}, h = '<h4>Câmera</h4>';
      var cv0 = $("cm-v"); if (cv0 && cv0.videoWidth) h += '<div style="font-size:12px;color:#A1A1AA;margin:-4px 0 8px">Imagem da câmera: ' + cv0.videoWidth + '×' + cv0.videoHeight + (cv0.videoHeight > cv0.videoWidth ? " (em pé)" : " (deitada)") + '</div>';
      h += chips("cfg-res", [["720", "720p"], ["1080", "1080p"]], prefs.res);
      h += chips("cfg-grade", [["1", "Grade 3×3 " + (prefs.grade ? "ligada" : "desligada")]], prefs.grade ? "1" : "x");
      var zf = zFaixa();
      h += range("cfg-zoom", S.digital ? "Zoom (digital)" : "Zoom", zf.min, zf.max, zf.step, S.zAlvo, function (v) { return (+v).toFixed(1) + "×"; });
      var ec = c.exposureCompensation;
      if (ec && typeof ec.min === "number" && ec.max > ec.min) h += range("cfg-exp", "Exposição", ec.min, ec.max, ec.step || 0.1, S.set.exposureCompensation || 0, function (v) { return (+v > 0 ? "+" : "") + (+v).toFixed(1); });
      var fm = Array.isArray(c.focusMode) ? c.focusMode.filter(function (m) { return m === "continuous" || m === "single-shot" || m === "manual"; }) : [];
      if (fm.length > 1) h += '<div style="font-size:13px;color:#A1A1AA;margin:8px 0 6px">Foco</div>' + chips("cfg-foco", fm.map(function (m) { return [m, m === "continuous" ? "Automático" : m === "single-shot" ? "Travar" : "Manual"]; }), S.set.focusMode || "continuous");
      h += '<h4>Teleprompter</h4>';
      h += range("cfg-fonte", "Tamanho da letra", 22, 64, 1, prefs.fonte, function (v) { return v + "px"; });
      h += range("cfg-larg", "Largura", 50, 100, 5, prefs.larg, function (v) { return v + "%"; });
      h += range("cfg-fundo", "Fundo escuro", 0, 90, 5, prefs.fundo, function (v) { return v + "%"; });
      h += range("cfg-vel", "Velocidade", 0.3, 2.5, 0.1, prefs.vel, function (v) { return (+v).toFixed(1) + "x"; });
      h += chips("cfg-esp", [["1", "Espelhar texto " + (prefs.espTxt ? "ligado" : "desligado")]], prefs.espTxt ? "1" : "x");
      if (VOZ_OK) h += chips("cfg-voz", [["1", "Rolar pela voz " + (prefs.voz ? "ligado" : "desligado")]], prefs.voz ? "1" : "x") + '<p class="vd-hint">Avança conforme você fala (Chrome). Se não reconhecer, o texto rola por tempo.</p>';
      else h += '<p class="vd-hint">Rolagem pela voz funciona no Chrome (Android/computador). Aqui o texto rola por tempo.</p>';
      h += '<button class="vd-btn pri" id="cfg-ok" style="width:100%;margin-top:12px">Pronto</button>';
      sh.innerHTML = h;
      function on(id, fn) { var el = $(id); if (el) el.oninput = fn; }
      on("cfg-zoom", function () { defineZoom(+this.value, true); });
      on("cfg-exp", function () { var v = +this.value; $("cfg-exp-v").textContent = (v > 0 ? "+" : "") + v.toFixed(1); aplicar({ exposureCompensation: v }); S.set.exposureCompensation = v; });
      on("cfg-fonte", function () { prefs.fonte = +this.value; $("cfg-fonte-v").textContent = prefs.fonte + "px"; salvarPrefs(); layoutTp(); });
      on("cfg-larg", function () { prefs.larg = +this.value; $("cfg-larg-v").textContent = prefs.larg + "%"; salvarPrefs(); layoutTp(); });
      on("cfg-fundo", function () { prefs.fundo = +this.value; $("cfg-fundo-v").textContent = prefs.fundo + "%"; salvarPrefs(); layoutTp(); });
      on("cfg-vel", function () { prefs.vel = +this.value; $("cfg-vel-v").textContent = prefs.vel.toFixed(1) + "x"; mostraVel(); salvarPrefs(); });
      var cr = $("cfg-res"); if (cr) Array.prototype.forEach.call(cr.children, function (b) { b.onclick = async function () { if (S.gravando) { V.toast("Mude a qualidade antes de gravar."); return; } prefs.res = b.dataset.v; salvarPrefs(); await recomeca(); }; });
      var cf = $("cfg-foco"); if (cf) Array.prototype.forEach.call(cf.children, function (b) { b.onclick = async function () { if (await aplicar({ focusMode: b.dataset.v })) { S.set.focusMode = b.dataset.v; montaFolha(); } }; });
      var cg = $("cfg-grade"); if (cg) cg.firstChild.onclick = function () { prefs.grade = !prefs.grade; $("cm-grade").classList.toggle("on", prefs.grade); salvarPrefs(); montaFolha(); };
      var ce = $("cfg-esp"); if (ce) ce.firstChild.onclick = function () { prefs.espTxt = !prefs.espTxt; salvarPrefs(); pos(); montaFolha(); };
      var cv = $("cfg-voz"); if (cv) cv.firstChild.onclick = function () { if (voz) voz.click(); };
      $("cfg-ok").onclick = function () { sh.hidden = true; };
    }
    montaFolha();
    $("cm-cfg").onclick = function () { var sh = $("cm-sheet"); sh.hidden = !sh.hidden; };

    /* ----- gravação ----- */
    var mime = escolherMime(MIME_PRIORIDADE), rec, g, tIni = 0, timer = null, palavras = [], reco = null;
    function garantirFala() {
      if (reco || !S.gravando || !SR || IOS) return;
      if (!(LEGENDA_OK || prefs.voz)) return;
      reco = iniciarFala(tIni, palavras, aoOuvir);
    }
    function contagem() {
      return new Promise(function (ok) {
        var ct = $("cm-ct"), k = 3;
        S.contando = true; ct.classList.add("on");
        (function passo() {
          if (!S.contando || !root || root.hidden) { ct.classList.remove("on"); return ok(false); }
          if (k === 0) { ct.classList.remove("on"); S.contando = false; return ok(true); }
          ct.innerHTML = "<b>" + k + "</b>"; k--; setTimeout(passo, 1000);
        })();
      });
    }
    // canvas de gravação (modo digital): 9:16 na resolução escolhida, recorte central conforme o zoom, sem espelho
    var cvRec = null;
    function iniciaCanvas() {
      var cam = $("cm-v"), CW = prefs.res === "1080" ? 1080 : 720, CH = CW * 16 / 9;
      // não aumenta além do que a câmera entrega (esticar só piora): limita pelo tamanho do recorte 9:16 da fonte
      var fw = cam.videoWidth || CW, fh = cam.videoHeight || CH, recW = Math.min(fw, fh * 9 / 16);
      if (recW < CW) { CW = Math.max(360, Math.round(recW / 2) * 2); CH = CW * 16 / 9; }
      var cv = document.createElement("canvas"); cv.width = CW; cv.height = Math.round(CH);
      var cx = cv.getContext("2d", { alpha: false });
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high";
      cvRec = { cv: cv, ativo: true };
      function frame() {
        var vw = cam.videoWidth, vh = cam.videoHeight; if (!vw || !vh) return;
        var asp = CW / cv.height, cw, ch;                        // recorte "cover" no formato 9:16
        if (vw / vh > asp) { ch = vh; cw = vh * asp; } else { cw = vw; ch = vw / asp; }
        var z = S.zAtual || 1; cw /= z; ch /= z;                  // zoom = recorte menor, centralizado
        cx.drawImage(cam, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, cv.width, cv.height);
      }
      function laco() {
        if (!cvRec || !cvRec.ativo) return;
        frame();
        if (cam.requestVideoFrameCallback) cam.requestVideoFrameCallback(laco); else requestAnimationFrame(laco);
      }
      frame(); laco();
      var saida = cv.captureStream(30).getVideoTracks().concat(stream.getAudioTracks());
      return new MediaStream(saida);
    }
    function paraCanvas() { if (cvRec) { cvRec.ativo = false; cvRec = null; } }
    $("cm-rec").onclick = async function () {
      var btn = this;
      if (S.contando) { S.contando = false; return; }
      if (!S.gravando) {
        $("cm-sheet").hidden = true;
        if (!(await contagem())) return;
        var fonte = stream;
        // grava pelo canvas 9:16 quando: zoom digital OU a câmera entregou a imagem deitada/fora de 9:16
        // (sem isso o arquivo saía horizontal mesmo com a prévia em pé)
        var camEl = $("cm-v"), vw = camEl && camEl.videoWidth, vh = camEl && camEl.videoHeight;
        var emPe = vw && vh && vh > vw;
        // em pé e sem zoom digital: grava direto da câmera (máxima nitidez, sem recorte).
        // deitada ou com zoom digital: passa pelo canvas 9:16.
        if (!emPe || (S.digital && (S.zAlvo || 1) > 1.01)) fonte = iniciaCanvas();
        S.direto = fonte === stream;
        rec = new MediaRecorder(fonte, mime ? { mimeType: mime, videoBitsPerSecond: prefs.res === "1080" ? 12000000 : 6000000, audioBitsPerSecond: 128000 } : undefined);
        g = gravar(rec); rec.start(500); tIni = performance.now(); S.gravando = true; S.rodando = true; marcaPausa();
        btn.classList.add("on"); $("cm-tm").classList.add("on");
        timer = setInterval(function () { var s = Math.floor((performance.now() - tIni) / 1000); var el = $("cm-tm"); if (el) el.textContent = pad(Math.floor(s / 60)) + ":" + pad(s % 60); }, 400);
        garantirFala();
        cancelar = function () { S.gravando = false; paraCanvas(); clearInterval(timer); if (reco) reco.parar(); try { rec.stop(); } catch (e) {} };
      } else {
        S.gravando = false; S.rodando = false; clearInterval(timer); if (reco) reco.parar(); cancelar = null;
        btn.disabled = true;
        var blob = await g.parar(tipoBase(rec.mimeType, mime));
        paraCanvas();
        var dur = (performance.now() - tIni) / 1000;
        stream.getTracks().forEach(function (t) { t.stop(); }); stream = null;
        if (destravarTela) { try { destravarTela(); } catch (e) {} destravarTela = null; }
        telaPrevia(blob, palavras, dur);
      }
    };
  }

  /* ---------- reconhecimento de fala (legenda e rolagem por voz) ---------- */
  /* ---------- reconhecimento de fala (legenda) ---------- */
  function iniciarFala(tIni, palavras, cb) {
    var ativo = true, r = null, segIni = null, ultFim = 0;
    function nova() {
      r = new SR(); r.lang = "pt-BR"; r.continuous = true; r.interimResults = true;
      r.onresult = function (e) {
        var agora = (performance.now() - tIni) / 1000;
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (cb) { try { cb(e.results[i][0].transcript); } catch (x) {} }
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
      (podeAgendar(blob) ? '<button class="vd-btn pri" id="vd-ag" style="flex:none">📅 Agendar no Instagram</button>' : "") +
      '<div class="vd-row"><button class="vd-btn" id="vd-dl">Baixar</button>' + (PODE_COMPARTILHAR ? '<button class="vd-btn" id="vd-sh">Compartilhar</button>' : "") + '<button class="vd-btn" id="vd-de-novo">Regravar</button></div>' +
      (LEGENDA_OK
        ? (palavras.length >= 3 ? '<button class="vd-btn" id="vd-leg" style="flex:none">Gerar vídeo com legenda</button><p class="vd-hint">Refaz o vídeo com legenda animada em tempo real (dura o mesmo que o vídeo). Mantenha a tela aberta.</p>'
          : '<p class="vd-hint">Não captei fala suficiente para gerar legenda. Fale mais perto do microfone.</p>')
        : '<p class="vd-hint">Legenda automática funciona no Chrome.</p>') +
      '<div id="vd-lp"></div>' +
      (fluxo.legenda ? '<p class="vd-hint">Legenda do post:</p><textarea readonly>' + esc(fluxo.legenda) + '</textarea>' : ""));
    $("vd-dl").onclick = function () { baixar(blob, nome); };
    if ($("vd-sh")) $("vd-sh").onclick = function () { compartilhar(blob, nome, fluxo.legenda); };
    if ($("vd-ag")) $("vd-ag").onclick = function () { agendarGravado(blob); };
    $("vd-de-novo").onclick = telaGravacao;
    if ($("vd-leg")) $("vd-leg").onclick = async function () {
      var b = this; b.disabled = true;
      $("vd-lp").innerHTML = '<div class="vd-bar"><i id="vd-pb"></i></div><p class="vd-hint" id="vd-pt">Preparando…</p>';
      try {
        var out = await gerarLegenda(blob, palavras, function (n) { var el = $("vd-pb"); if (el) { el.style.width = n + "%"; $("vd-pt").textContent = "Gerando vídeo com legenda… " + n + "%"; } });
        if (!out || !root || root.hidden) return;
        abrir(cab("Vídeo com legenda") + '<video class="vd-player" controls playsinline src="' + url(out) + '"></video>' +
          (podeAgendar(out) ? '<button class="vd-btn pri" id="vd-ag2" style="flex:none">📅 Agendar no Instagram</button>' : "") +
          '<div class="vd-row"><button class="vd-btn" id="vd-dl2">Baixar</button>' + (PODE_COMPARTILHAR ? '<button class="vd-btn" id="vd-sh2">Compartilhar</button>' : "") + '<button class="vd-btn" id="vd-de-novo2">Regravar</button></div>' +
          '<button class="vd-btn" id="vd-orig" style="flex:none">Voltar ao vídeo original</button>');
        $("vd-dl2").onclick = function () { baixar(out, nome + "-legenda"); };
        if ($("vd-sh2")) $("vd-sh2").onclick = function () { compartilhar(out, nome + "-legenda", fluxo.legenda); };
        if ($("vd-ag2")) $("vd-ag2").onclick = function () { agendarGravado(out); };
        $("vd-de-novo2").onclick = telaGravacao;
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
  // também na aba "Criar carrossel", logo abaixo da caixa "Sobre o que você quer postar hoje?"
  function injetarNovo() {
    var caixa = document.querySelector("#screen-novo .tema-livre");
    if (!caixa || $("vd-novo-cta")) return;
    var d = document.createElement("div"); d.id = "vd-novo-cta"; d.className = "vd-cta-painel";
    d.innerHTML = '<div><b>🎥 Prefere vídeo? Grave com roteiro</b><span>A IA escreve o roteiro e você grava lendo no teleprompter, com zoom e câmera frontal ou traseira.</span></div><button class="btn btn-primary btn-sm" id="vd-novo-btn">Gravar vídeo</button>';
    caixa.parentNode.insertBefore(d, caixa.nextSibling);
    $("vd-novo-btn").onclick = iniciarFluxo;
  }
  var anterior = V.aoMostrar;
  V.aoMostrar = function (nome) {
    if (anterior) anterior(nome);
    if (nome === "imoveis") injetarCards();
  };
  // "Gravar vídeo com roteiro" foi retirado da plataforma (a pedido do dono, 26/10/2026); fica só o Reels do imóvel.
  V.video = { reels: abrirReels, criarRenderer: criarRenderer, estilos: ESTILOS, fontes: FONTES_RL, cores: CORES_RL, layouts: LAYOUTS_RL, trilhas: TRILHAS, carregarFonte: carregarFonte, carregarTrilha: carregarTrilha };
})();
