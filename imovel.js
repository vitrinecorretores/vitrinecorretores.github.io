/* Página pública do imóvel: imovel.html?id=<uuid>
   Layout moderno: galeria em tela cheia, descrição sempre presente (montada só com os dados do cadastro
   quando o corretor não escreveu uma) e compartilhamento (WhatsApp, copiar link, outros apps). */
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
  function listaDe(v) { return Array.isArray(v) ? v.map(function (x) { return String(x).trim(); }).filter(Boolean) : []; }
  function foneWa(t) {
    var d = String(t || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length <= 11) d = "55" + d;
    return d;
  }
  function plural(n, um, varios) { return n + " " + (Number(n) === 1 ? um : varios); }
  function toast(t) {
    var el = document.createElement("div"); el.className = "toast"; el.textContent = t; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2200);
  }

  // descrição sempre presente: se o corretor não escreveu, monta um texto só com os dados cadastrados (nada inventado)
  function descricaoAuto(p, tipo, aluguel) {
    var partes = [];
    var onde = [p.bairro, p.cidade].filter(Boolean).join(", ");
    partes.push(tipo + (aluguel ? " para alugar" : " à venda") + (onde ? " em " + onde : "") + ".");
    var ambs = [];
    if (p.tipo !== "terreno") {
      if (p.quartos) ambs.push(plural(p.quartos, "quarto", "quartos") + (p.suites ? " (" + plural(p.suites, "suíte", "suítes") + ")" : ""));
      else if (p.suites) ambs.push(plural(p.suites, "suíte", "suítes"));
      if (p.banheiros) ambs.push(plural(p.banheiros, "banheiro", "banheiros"));
      if (p.vagas) ambs.push(plural(p.vagas, "vaga de garagem", "vagas de garagem"));
    }
    if (p.area_m2) ambs.unshift(Number(p.area_m2) + " m²");
    if (ambs.length) partes.push("São " + ambs.join(", ").replace(/, ([^,]*)$/, " e $1") + ".");
    var difs = listaDe(p.diferenciais);
    if (difs.length) partes.push("Destaques: " + difs.join(", ").replace(/, ([^,]*)$/, " e $1") + ".");
    partes.push("Fale com o corretor pelo WhatsApp para agendar uma visita e receber mais informações.");
    return partes.join("\n\n");
  }

  var ICONES = {
    area: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/></svg>',
    quarto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M3 18v2M21 18v2M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>',
    suite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0"/></svg>',
    banho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4a3 3 0 0 1 6 0v2M4 11h16M6 11v4a5 5 0 0 0 10 0v-4M12 6h3"/></svg>',
    vaga: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2M19 16v2M7 13h.01M17 13h.01"/></svg>'
  };
  function spec(ic, valor, rotulo) {
    var d = document.createElement("div"); d.className = "spec";
    d.innerHTML = ICONES[ic];
    var t = document.createElement("div");
    var b = document.createElement("b"); b.textContent = valor;
    var s = document.createElement("span"); s.textContent = rotulo;
    t.appendChild(b); t.appendChild(s); d.appendChild(t); $("specs").appendChild(d);
  }

  function montarSlides(box, fotos, aoClicar) {
    fotos.forEach(function (u, k) {
      var im = document.createElement("img"); im.src = u; im.alt = "Foto " + (k + 1) + " do imóvel"; im.loading = k ? "lazy" : "eager";
      if (aoClicar) im.addEventListener("click", function () { aoClicar(k); });
      box.appendChild(im);
    });
  }
  function atual(box) { return Math.round(box.scrollLeft / Math.max(1, box.clientWidth)); }
  function ir(box, k) { box.scrollTo({ left: k * box.clientWidth, behavior: "smooth" }); }

  function galeria(fotos) {
    var box = $("slides");
    if (!fotos.length) { $("hero").style.height = "140px"; ["prev", "next", "count", "ver-fotos"].forEach(function (id) { $(id).hidden = true; }); return; }
    montarSlides(box, fotos, abrirLb);
    var multi = fotos.length > 1;
    ["prev", "next", "count", "ver-fotos"].forEach(function (id) { $(id).hidden = !multi; });
    function cont() { $("count").textContent = (atual(box) + 1) + " / " + fotos.length; }
    box.addEventListener("scroll", function () { window.requestAnimationFrame(cont); }, { passive: true });
    $("prev").onclick = function () { ir(box, (atual(box) - 1 + fotos.length) % fotos.length); };
    $("next").onclick = function () { ir(box, (atual(box) + 1) % fotos.length); };
    $("ver-fotos").onclick = function () { abrirLb(atual(box)); };
    cont();

    var lb = $("lb"), lbs = $("lb-slides");
    montarSlides(lbs, fotos, null);
    function lbCont() { $("lb-count").textContent = (atual(lbs) + 1) + " de " + fotos.length; }
    lbs.addEventListener("scroll", function () { window.requestAnimationFrame(lbCont); }, { passive: true });
    function abrirLb(k) { lb.hidden = false; document.body.style.overflow = "hidden"; lbs.scrollLeft = k * lbs.clientWidth; lbCont(); }
    function fecharLb() { lb.hidden = true; document.body.style.overflow = ""; }
    $("lb-x").onclick = fecharLb;
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") fecharLb();
      if (e.key === "ArrowRight") ir(lbs, Math.min(fotos.length - 1, atual(lbs) + 1));
      if (e.key === "ArrowLeft") ir(lbs, Math.max(0, atual(lbs) - 1));
    });
  }

  function compartilhamento(titulo, resumo) {
    var link = location.href.split("#")[0];
    var texto = "Olha esse imóvel: " + titulo + (resumo ? " (" + resumo + ")" : "") + "\n" + link;
    $("sh-wa").href = "https://wa.me/?text=" + encodeURIComponent(texto);
    async function copiar() {
      try { await navigator.clipboard.writeText(link); toast("Link copiado!"); }
      catch (e) { window.prompt("Copie o link do imóvel:", link); }
    }
    async function nativo() {
      if (navigator.share) {
        try { await navigator.share({ title: titulo, text: "Olha esse imóvel: " + titulo, url: link }); } catch (e) { /* cancelado */ }
      } else { copiar(); }
    }
    $("sh-copiar").onclick = copiar;
    $("sh-mais").onclick = nativo;
    $("share-top").onclick = nativo;
    $("share-bar").onclick = nativo;
    if (!navigator.share) $("sh-mais").hidden = true;
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

    [[aluguel ? "Aluguel" : "Venda", "escura"], [tipo, ""]].forEach(function (t) {
      var s = document.createElement("span"); s.className = "tag " + t[1]; s.textContent = t[0]; $("tags").appendChild(s);
    });
    $("titulo").textContent = titulo;
    var onde = [p.bairro, p.cidade].filter(Boolean).join(", ");
    $("loc").textContent = onde; $("loc-p").hidden = !onde;
    $("preco-lb").textContent = aluguel ? "Aluguel mensal" : "Valor de venda";
    $("preco").textContent = p.preco ? brl(p.preco) + (aluguel ? "/mês" : "") : "Consulte o valor";

    if (p.area_m2) spec("area", Number(p.area_m2) + " m²", "Área");
    if (p.tipo !== "terreno") {
      if (p.quartos) spec("quarto", p.quartos, p.quartos === 1 ? "Quarto" : "Quartos");
      if (p.suites) spec("suite", p.suites, p.suites === 1 ? "Suíte" : "Suítes");
      if (p.banheiros) spec("banho", p.banheiros, p.banheiros === 1 ? "Banheiro" : "Banheiros");
      if (p.vagas) spec("vaga", p.vagas, p.vagas === 1 ? "Vaga" : "Vagas");
    }
    if (!$("specs").children.length) $("specs").hidden = true;

    var desc = String(p.descricao || "").trim() || descricaoAuto(p, tipo, aluguel);
    $("desc").textContent = desc;
    if (desc.length > 420) {
      $("desc").classList.add("curta"); $("mais").hidden = false;
      $("mais").onclick = function () { $("desc").classList.remove("curta"); $("mais").hidden = true; };
    }

    var difs = listaDe(p.diferenciais);
    if (difs.length) {
      difs.forEach(function (d) { var li = document.createElement("li"); li.textContent = d; $("difs").appendChild(li); });
      $("sec-dif").hidden = false;
    }
    var nome = p.corretor_nome || "Corretor";
    $("c-nome").textContent = nome;
    $("avatar").textContent = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x[0]; }).join("").toUpperCase();
    $("c-creci").textContent = p.corretor_creci ? "CRECI " + p.corretor_creci : "";

    galeria(fotosDe(p));
    var resumo = [p.preco ? brl(p.preco) + (aluguel ? "/mês" : "") : "", p.bairro || ""].filter(Boolean).join(" · ");
    compartilhamento(titulo, resumo);

    var fone = foneWa(p.corretor_telefone);
    if (fone) {
      var texto = "Olá! Vi o imóvel \"" + titulo + "\"" + (p.bairro ? " em " + p.bairro : "") + " (" + location.href + ") e gostaria de mais informações.";
      $("cta").href = "https://wa.me/" + fone + "?text=" + encodeURIComponent(texto);
      $("cta").addEventListener("click", function () { evento(p.id, "whatsapp"); });
    } else { $("cta").hidden = true; }
    $("cta-bar").hidden = false;
    $("msg").hidden = true; $("conteudo").hidden = false;

    try {
      var k = "vit-visita-" + p.id;
      if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); evento(p.id, "visita"); }
    } catch (e) { evento(p.id, "visita"); }
  }
  main();
})();
