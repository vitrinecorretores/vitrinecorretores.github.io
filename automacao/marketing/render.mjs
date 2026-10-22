// Renderiza os slides com O MESMO código de desenho da Vitrine (app.js + fotos.js), num Chromium headless.
// O código é baixado do site no momento da execução: qualquer melhoria visual feita na plataforma
// (novos estilos, fontes, cores) entra automaticamente nos posts do agente.
import { chromium } from "playwright";

const SITE = process.env.VITRINE_SITE || "https://vitrinecorretores.github.io";
const FONTES_CSS = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,700..800&family=Plus+Jakarta+Sans:wght@500;700&family=Anton&family=Playfair+Display:wght@700;800&family=Poppins:wght@500;800&family=Unbounded:wght@600;700&display=swap";

const INICIO = "/* ---------------- fontes das postagens ---------------- */";
const FIM = "function uploadSlide(";

async function baixar(caminho, local) {
  if (local) { const fs = await import("node:fs/promises"); return fs.readFile(local, "utf8"); }
  const r = await fetch(`${SITE}/${caminho}?t=${Date.now()}`);
  if (!r.ok) throw new Error(`Não baixei ${caminho}: HTTP ${r.status}`);
  return r.text();
}

/** Extrai do app.js só o trecho de desenho (fontes, cores, estilos virais, renderSlideJpeg). */
export function extrairDesenho(appJs) {
  const i = appJs.indexOf(INICIO), f = appJs.indexOf(FIM);
  if (i < 0 || f < 0 || f < i) throw new Error("Não achei o trecho de desenho no app.js (marcadores mudaram).");
  const admin = (appJs.match(/var ADMIN_IDS = (\[[^\]]*\])/) || [])[1] || "[]";
  const link = (appJs.match(/var LINK_VITRINE = "([^"]+)"/) || [])[1] || "vitrinecorretores.github.io";
  return { trecho: appJs.slice(i, f), adminIds: JSON.parse(admin), linkVitrine: link };
}

/**
 * slides: [{tag, titulo, corpo, imagem_url}], opts: { slug, fonte, melhorar, profile, assinaturaStatus, igUsername }
 * Devolve Buffers JPEG (1080x1350) na ordem dos slides.
 */
export async function renderizar(slides, opts, local = {}) {
  const appJs = await baixar("app.js", local.appJs);
  const fotosJs = await baixar("fotos.js", local.fotosJs);
  const { trecho, adminIds, linkVitrine } = extrairDesenho(appJs);

  const browser = await chromium.launch(local.executablePath ? { executablePath: local.executablePath } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    page.on("pageerror", (e) => console.error("[render] erro na página:", e.message));
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${local.semFontesWeb ? "" : `<link rel="stylesheet" href="${FONTES_CSS}">`}</head><body></body></html>`, { waitUntil: "load" });
    await page.addScriptTag({ content: fotosJs });

    const ctx = {
      profile: opts.profile || {},
      assinatura: opts.assinaturaStatus ? { status: opts.assinaturaStatus } : null,
      igConta: opts.igUsername ? { status: "ativo", username: opts.igUsername } : null,
      adminIds, linkVitrine,
    };
    // mesmo escopo de funções do app.js, com os poucos globais que o trecho usa
    await page.addScriptTag({
      content: `(function(){
        var __c = ${JSON.stringify(ctx)};
        var state = { profile: __c.profile, assinatura: __c.assinatura, igConta: __c.igConta };
        var ADMIN_IDS = __c.adminIds, LINK_VITRINE = __c.linkVitrine;
        function emTeste(){ return !state.assinatura || state.assinatura.status === "trial"; }
        function ehAdmin(){ return !!(state.profile && ADMIN_IDS.indexOf(state.profile.id) >= 0); }
        function comLinkVitrine(){ return emTeste() || ehAdmin(); }
        function isFotoReal(u){ return !!u && !/pollinations\\.ai/.test(u); }
        function slideImageUrl(s){ return isFotoReal(s.imagem_url) ? s.imagem_url : null; }
        function escapeHtml(s){ return String(s == null ? "" : s); }
        function toast(){}
        ${trecho}
        window.__renderVitrine = async function (slides, slug, fonte, melhorar) {
          syncMarcaCor();
          await carregarFonte(fonte);
          try { await document.fonts.ready; } catch (e) {}
          await prepararMarca();
          var out = [];
          for (var i = 0; i < slides.length; i++) {
            var sl = slides[i];
            var img = (slug !== "bloco-cor" && slideImageUrl(sl)) ? await loadImage(slideImageUrl(sl), melhorar !== false) : null;
            var blob = await renderSlideJpeg(sl, i, slides.length, slug, img, false, fonte);
            var b64 = await new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(",")[1]); }; r.readAsDataURL(blob); });
            out.push(b64);
          }
          return out;
        };
      })();`,
    });
    const b64 = await page.evaluate(([s, slug, fonte, melhorar]) => window.__renderVitrine(s, slug, fonte, melhorar),
      [slides, opts.slug, opts.fonte, opts.melhorar]);
    return b64.map((x) => Buffer.from(x, "base64"));
  } finally {
    await browser.close();
  }
}
