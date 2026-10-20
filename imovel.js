/* Página pública do imóvel: imovel.html?id=<uuid> */
(function () {
  "use strict";
  var SUPABASE_URL = "https://qbfmozumntequvecttfs.supabase.co";
  var SUPABASE_KEY = "sb_publishable_xXZFK2Pzq7MHsMv2f_iISw_yriYjMvv";
  function $(id) { return document.getElementById(id); }

  function rpc(nome, args, keepalive) {
    return fetch(SUPABASE_URL + "/rest/v1/rpc/" + nome, {
      method: "POST", keepalive: !!keepalive,
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args)
    });
  }
  function evento(id, tipo) { try { rpc("registrar_evento_imovel", { p_id: id, p_tipo: tipo }, true).catch(function () {}); } catch (e) { /* ignora */ } }

  function brl(n) { return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }); }
  function erro(txt) { $("msg").textContent = txt; $("msg").hidden = false; }
  function fotosDe(p) {
    var arr = Array.isArray(p.fotos) ? p.fotos : [];
    return arr.map(function (f) { return typeof f === "string" ? f : (f && f.url) || ""; })
      .filter(function (u) { return /^https:\/\//.test(u); });
  }
  function listaDe(v) {
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    return [];
  }
  function foneWa(t) {
    var d = String(t || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length <= 11) d = "55" + d;
    return d;
  }

  function galeria(fotos) {
    var i = 0;
    var img = $("gal-img");
    if (!fotos.length) { $("gal-main").hidden = true; $("thumbs").hidden = true; return; }
    function ir(n) {
      i = (n + fotos.length) % fotos.length;
      img.src = fotos[i];
      $("gal-count").textContent = (i + 1) + " / " + fotos.length;
      Array.prototype.forEach.call($("thumbs").children, function (b, k) { b.className = k === i ? "on" : ""; });
    }
    fotos.forEach(function (u, k) {
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "Foto " + (k + 1));
      var t = document.createElement("img"); t.src = u; t.alt = ""; t.loading = "lazy";
      b.appendChild(t); b.addEventListener("click", function () { ir(k); });
      $("thumbs").appendChild(b);
    });
    var multi = fotos.length > 1;
    $("gal-prev").hidden = !multi; $("gal-next").hidden = !multi; $("thumbs").hidden = !multi; $("gal-count").hidden = !multi;
    $("gal-prev").addEventListener("click", function () { ir(i - 1); });
    $("gal-next").addEventListener("click", function () { ir(i + 1); });
    var x0 = null;
    $("gal-main").addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    $("gal-main").addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) ir(i + (dx < 0 ? 1 : -1));
    });
    ir(0);
  }

  function spec(valor, rotulo) {
    var d = document.createElement("div"); d.className = "spec";
    var b = document.createElement("b"); b.textContent = valor;
    var s = document.createElement("span"); s.textContent = rotulo;
    d.appendChild(b); d.appendChild(s); $("specs").appendChild(d);
  }

  async function main() {
    var id = new URLSearchParams(location.search).get("id") || "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { erro("Link de imóvel inválido."); return; }
    var p;
    try {
      var res = await rpc("imovel_publico", { p_id: id });
      if (!res.ok) throw new Error("http " + res.status);
      p = await res.json();
    } catch (e) { erro("Não consegui carregar o imóvel agora. Tente novamente."); return; }
    if (!p || !p.id) { erro("Imóvel não encontrado ou indisponível."); return; }

    var aluguel = p.finalidade === "aluguel";
    var tipo = p.tipo ? p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1) : "Imóvel";
    var titulo = p.titulo || (tipo + (p.bairro ? " em " + p.bairro : ""));
    document.title = titulo + " | Vitrine";
    $("tag").textContent = (aluguel ? "Aluguel" : "Venda") + " · " + tipo;
    $("titulo").textContent = titulo;
    $("loc").textContent = [p.bairro, p.cidade].filter(Boolean).join(" · ");
    $("preco").textContent = p.preco ? brl(p.preco) + (aluguel ? " /mês" : "") : "Consulte o valor";
    if (p.area_m2) spec(Number(p.area_m2) + " m²", "Área");
    if (p.tipo !== "terreno") {
      if (p.quartos) spec(p.quartos, p.quartos === 1 ? "Quarto" : "Quartos");
      if (p.suites) spec(p.suites, p.suites === 1 ? "Suíte" : "Suítes");
      if (p.banheiros) spec(p.banheiros, p.banheiros === 1 ? "Banheiro" : "Banheiros");
      if (p.vagas) spec(p.vagas, p.vagas === 1 ? "Vaga" : "Vagas");
    }
    if (p.descricao) { $("desc").textContent = p.descricao; $("sec-desc").hidden = false; }
    var difs = listaDe(p.diferenciais);
    if (difs.length) {
      difs.forEach(function (d) { var li = document.createElement("li"); li.textContent = d; $("difs").appendChild(li); });
      $("sec-dif").hidden = false;
    }
    $("c-nome").textContent = p.corretor_nome || "Corretor";
    $("c-creci").textContent = p.corretor_creci ? "CRECI " + p.corretor_creci : "";
    galeria(fotosDe(p));

    var fone = foneWa(p.corretor_telefone);
    if (fone) {
      var texto = "Olá! Vi o imóvel \"" + titulo + "\"" + (p.bairro ? " em " + p.bairro : "") + " (" + location.href + ") e gostaria de mais informações.";
      $("cta").href = "https://wa.me/" + fone + "?text=" + encodeURIComponent(texto);
      $("cta").addEventListener("click", function () { evento(p.id, "whatsapp"); });
      $("cta-bar").hidden = false;
    }
    $("msg").hidden = true; $("conteudo").hidden = false;

    try {
      var k = "vit-visita-" + p.id;
      if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); evento(p.id, "visita"); }
    } catch (e) { evento(p.id, "visita"); }
  }
  main();
})();
