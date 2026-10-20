/* Auto-ajuste de fotos no navegador (canvas) — sem serviço pago.
   Níveis automáticos por canal (corte 0,5%), clareamento de sombras, leve saturação/contraste
   e "céu mais azul" na metade de cima. Resultado em cache (url -> canvas): processa 1x por imagem.
   TODO (precisa de serviço pago de IA, não implementado): home staging virtual / mobiliar ambientes vazios. */
(function () {
  "use strict";
  var MAX_LADO = 1600;           // limita o tamanho pra não pesar (o slide final é 1080 de largura)
  var cache = new Map();         // url -> canvas melhorado

  function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  // aplica o ajuste sobre os pixels (ImageData) — exportado também pra testes
  function ajustarPixels(data, w, h) {
    var hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)], n = w * h, i, c;
    for (i = 0; i < data.length; i += 4) { hist[0][data[i]]++; hist[1][data[i + 1]]++; hist[2][data[i + 2]]++; }
    var corte = n * 0.005, lut = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
    for (c = 0; c < 3; c++) {
      var acc = 0, lo = 0, hi = 255;
      for (i = 0; i < 256; i++) { acc += hist[c][i]; if (acc > corte) { lo = i; break; } }
      acc = 0;
      for (i = 255; i >= 0; i--) { acc += hist[c][i]; if (acc > corte) { hi = i; break; } }
      if (hi - lo < 40) { lo = 0; hi = 255; }                 // imagem quase chapada: não estica
      // estica só 80% (evita dominante de cor forte) e limita o ganho
      for (i = 0; i < 256; i++) {
        var esticado = clamp((i - lo) * 255 / (hi - lo));
        lut[c][i] = clamp(i * 0.2 + esticado * 0.8);
      }
    }
    for (var y = 0; y < h; y++) {
      var topo = y / h < 0.55 ? 1 - (y / h) / 0.55 : 0;          // peso do "céu": 1 no topo, 0 em 55% da altura
      for (var x = 0; x < w; x++) {
        var p = (y * w + x) * 4, r = lut[0][data[p]], g = lut[1][data[p + 1]], b = lut[2][data[p + 2]];
        var lum = 0.299 * r + 0.587 * g + 0.114 * b;
        // clareia sombras (só abaixo de ~110 de luminância, suave)
        if (lum < 110) { var lift = (110 - lum) * 0.14; r += lift; g += lift; b += lift; lum += lift; }
        // saturação +12% e contraste +6% em torno do meio
        r = lum + (r - lum) * 1.12; g = lum + (g - lum) * 1.12; b = lum + (b - lum) * 1.12;
        r = (r - 128) * 1.06 + 128; g = (g - 128) * 1.06 + 128; b = (b - 128) * 1.06 + 128;
        // céu mais azul: pixel azulado e claro na metade de cima
        if (topo > 0 && b > r + 10 && b >= g - 6 && lum > 95) {
          var dom = Math.min(1, (b - r) / 70), wgt = topo * dom * 0.16;
          b += (255 - b) * wgt * 0.5; r -= r * wgt * 0.45; g -= g * wgt * 0.12;
        }
        data[p] = clamp(r); data[p + 1] = clamp(g); data[p + 2] = clamp(b);
      }
    }
    return data;
  }

  // img: HTMLImageElement já carregada (crossOrigin anônimo). Devolve um canvas (ou a própria img se falhar).
  function melhorar(img, url) {
    if (!img) return img;
    if (url && cache.has(url)) return cache.get(url);
    var out = img;
    try {
      var esc = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width * esc)), h = Math.max(1, Math.round(img.height * esc));
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      var ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      var id = ctx.getImageData(0, 0, w, h);      // lança se o canvas estiver "contaminado" (sem CORS)
      ajustarPixels(id.data, w, h);
      ctx.putImageData(id, 0, 0);
      out = cv;
    } catch (e) { out = img; }
    if (url) cache.set(url, out);
    return out;
  }

  window.VitrineFotos = { melhorar: melhorar, ajustarPixels: ajustarPixels, limparCache: function () { cache.clear(); } };
})();
