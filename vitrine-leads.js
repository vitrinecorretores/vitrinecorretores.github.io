/* Leads dos comentários (regra por conta) + card "Resumo da semana" do Painel.
   Depende de window.Vitrine (definido no fim do app.js). */
(function () {
  "use strict";
  var V = window.Vitrine;
  if (!V) return;
  var esc = V.escapeHtml, DB = V.DB, state = V.state;
  var DIA = 86400000;
  var contaSel = null;
  var regras = {};

  function $(id) { return document.getElementById(id); }
  function pontos(p) {
    var base = (p.salvamentos || 0) + (p.compartilhamentos || 0) * 2 + (p.comentarios || 0);
    return base > 0 ? base : (p.curtidas || 0);
  }

  /* ---------- Resumo da semana (Painel) ---------- */
  async function renderResumo() {
    var el = $("resumo-semana");
    if (!el) return;
    var uid = state.profile && state.profile.id;
    if (!uid || !V.contasAtivas().length) { el.innerHTML = ""; return; }
    var agora = Date.now();
    var desde = new Date(agora - 7 * DIA).toISOString();
    try {
      var r = await Promise.all([
        DB.select("ig_metricas_posts", "select=*&corretor_id=eq." + uid + "&publicado_em=gte." + desde + "&limit=100"),
        DB.select("ig_metricas_conta", "select=dia,seguidores&corretor_id=eq." + uid + "&dia=gte." + new Date(agora - 8 * DIA).toISOString().slice(0, 10) + "&order=dia.asc"),
        DB.select("leads_instagram", "select=id&corretor_id=eq." + uid + "&created_at=gte." + desde)
      ]);
      var posts = r[0] || [], conta = r[1] || [], leads = (r[2] || []).length;
      var top = posts.slice().sort(function (a, b) { return pontos(b) - pontos(a); }).slice(0, 3);
      var porDia = {};
      conta.forEach(function (x) { porDia[x.dia] = (porDia[x.dia] || 0) + (x.seguidores || 0); });
      var dias = Object.keys(porDia).sort();
      var seg = dias.length ? porDia[dias[dias.length - 1]] : null;
      var variacao = dias.length >= 2 ? porDia[dias[dias.length - 1]] - porDia[dias[0]] : null;
      var fim = agora + 7 * DIA;
      var agend = state.carrosseis.filter(function (c) {
        if (c.status !== "agendado" || !c.data_agendada) return false;
        var t = new Date(c.data_agendada).getTime(); return t >= agora && t <= fim;
      }).length;
      var publicados = state.carrosseis.filter(function (c) { return c.status === "publicado" && c.data_publicada && new Date(c.data_publicada).getTime() >= agora - 7 * DIA; }).length;
      var nPosts = Math.max(posts.length, publicados);
      function cel(n, l, sub) { return '<div><div class="rs-n mono">' + n + '</div><div class="rs-l">' + l + (sub ? ' · ' + sub : '') + '</div></div>'; }
      el.innerHTML = '<div class="autoreply-card" style="margin-bottom:22px;"><h3 style="font-size:16px;">Resumo da semana</h3>' +
        '<p style="margin:3px 0 0;font-size:12.5px;color:var(--ink-muted);">Últimos 7 dias no seu Instagram.</p>' +
        '<div class="rs-grid">' +
        cel(nPosts, "posts") +
        cel(seg == null ? "—" : seg, "seguidores", variacao == null ? "" : (variacao >= 0 ? "+" : "") + variacao) +
        cel(leads, "leads dos comentários") +
        cel(agend, "agendados p/ próxima semana") +
        '</div>' +
        (top.length ? '<div style="margin-top:14px;font-size:12.5px;color:var(--ink-muted);">Seus posts que mais engajaram</div><ol class="rs-top">' + top.map(function (p) {
          var t = esc((p.legenda_inicio || "Post").slice(0, 60));
          return '<li>' + (p.permalink ? '<a href="' + esc(p.permalink) + '" target="_blank" rel="noopener" style="color:var(--accent2);">' + t + '</a>' : t) +
            ' — ' + (p.curtidas || 0) + ' curtidas, ' + (p.salvamentos || 0) + ' salvamentos, ' + (p.compartilhamentos || 0) + ' envios' +
            ' <button type="button" class="btn btn-ghost btn-xs rs-nova" data-rs-nova="' + esc((p.legenda_inicio || "").slice(0, 160)) + '" title="Cria um carrossel novo sobre o mesmo assunto, com outro gancho">♻️ Nova versão</button></li>';
        }).join("") + '</ol>' : '') +
        '</div>';
      // reaproveitar o que deu certo: abre "Criar carrossel" com o tema do post que mais engajou
      Array.prototype.forEach.call(el.querySelectorAll("[data-rs-nova]"), function (b) {
        b.onclick = function () {
          var base = (b.getAttribute("data-rs-nova") || "").replace(/\s+/g, " ").trim();
          if (V.abrirComTema) V.abrirComTema("Nova versão de um post meu que deu muito certo, com outro gancho e outra abordagem (sem repetir o texto): " + base);
        };
      });
    } catch (e) { el.innerHTML = ""; console.error(e); }
  }

  /* ---------- Comentário vira lead (tela Instagram) ---------- */
  async function renderLeadsTela() {
    var card = $("comentario-lead-card"), lista = $("leads-ig-card");
    if (!card || !lista) return;
    var contas = V.contasAtivas();
    if (!contas.length) { card.hidden = true; lista.hidden = true; return; }
    card.hidden = false; lista.hidden = false;
    var uid = state.profile.id;
    var rs = [], leads = [];
    try {
      var r = await Promise.all([
        DB.select("ig_comentario_regras", "select=*&corretor_id=eq." + uid),
        DB.select("leads_instagram", "select=*&corretor_id=eq." + uid + "&order=created_at.desc&limit=100")
      ]);
      rs = r[0] || []; leads = r[1] || [];
    } catch (e) { console.error(e); }
    regras = {}; rs.forEach(function (x) { regras[x.conta_id] = x; });
    if (!contaSel || !contas.some(function (c) { return c.id === contaSel; })) contaSel = contas[0].id;
    desenharForm(contas);

    var semana = leads.filter(function (l) { return new Date(l.created_at).getTime() >= Date.now() - 7 * DIA; }).length;
    lista.innerHTML = '<h3 style="font-size:16px;">Leads dos comentários</h3>' +
      '<p style="margin:3px 0 10px;font-size:12.5px;color:var(--ink-muted);">' + semana + ' na última semana · ' + leads.length + ' no total (últimos 100)</p>' +
      (leads.length ? leads.slice(0, 10).map(function (l) {
        return '<div class="lead-row"><div><b>@' + esc(l.username || "?") + '</b> <span style="color:var(--ink-muted);">' + esc((l.comentario || "").slice(0, 80)) + '</span></div><div style="color:var(--ink-faint);white-space:nowrap;">' + V.fmtDate(l.created_at) + '</div></div>';
      }).join("") : '<div class="empty-col">Nenhum lead ainda. Quando alguém comentar a palavra-gatilho, aparece aqui.</div>');
  }

  function desenharForm(contas) {
    var card = $("comentario-lead-card");
    var rg = regras[contaSel] || { palavra_gatilho: "QUERO", mensagem_direct: "Oi {nome}! Vi seu comentário 😊 Me chama no WhatsApp pra eu te passar os detalhes: {whatsapp}", resposta_publica: "", ativa: false };
    card.innerHTML = '<h3 style="font-size:16px;">Comentário vira lead no WhatsApp</h3>' +
      '<p style="margin:3px 0 0;font-size:12.5px;color:var(--ink-muted);">Quando alguém comenta a palavra-gatilho, a pessoa vira lead e recebe uma mensagem no Direct com o seu WhatsApp.</p>' +
      '<div class="ig-pendente">Ativação pendente: depende de permissão da Meta. Enquanto isso, a regra fica salva e os leads dos comentários já são registrados; as mensagens só saem depois da liberação.</div>' +
      (contas.length > 1 ? '<label class="autoreply-label">Conta</label><select id="cl-conta" style="margin-bottom:12px;">' + contas.map(function (c) { return '<option value="' + c.id + '"' + (c.id === contaSel ? " selected" : "") + '>@' + esc(c.username) + '</option>'; }).join("") + '</select>' : '') +
      '<label class="autoreply-label">Palavra-gatilho</label><input id="cl-palavra" type="text" maxlength="40" style="width:100%;margin-bottom:12px;" value="' + esc(rg.palavra_gatilho) + '">' +
      '<label class="autoreply-label">Mensagem no Direct <span>use {nome} e {whatsapp}</span></label><textarea id="cl-msg" rows="3" maxlength="900" style="width:100%;margin-bottom:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--ink);font-family:inherit;font-size:13px;padding:9px 11px;">' + esc(rg.mensagem_direct) + '</textarea>' +
      '<label class="autoreply-label">Resposta pública no comentário <span>opcional</span></label><input id="cl-pub" type="text" maxlength="300" style="width:100%;margin-bottom:12px;" placeholder="Ex.: Te chamei no Direct! 😉" value="' + esc(rg.resposta_publica || "") + '">' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:14px;"><input type="checkbox" id="cl-ativa"' + (rg.ativa ? " checked" : "") + '> Regra ativa (desligada por padrão)</label>' +
      '<button class="btn btn-primary btn-sm" id="cl-salvar">Salvar regra</button>';
    var sel = $("cl-conta");
    if (sel) sel.addEventListener("change", function () { contaSel = sel.value; desenharForm(contas); });
    $("cl-salvar").addEventListener("click", async function () {
      var b = this, palavra = $("cl-palavra").value.trim();
      if (!palavra) { V.toast("Escreva a palavra-gatilho."); return; }
      b.disabled = true;
      try {
        var linha = {
          conta_id: contaSel, corretor_id: state.profile.id, palavra_gatilho: palavra,
          mensagem_direct: $("cl-msg").value.trim() || rg.mensagem_direct,
          resposta_publica: $("cl-pub").value.trim() || null,
          ativa: $("cl-ativa").checked, updated_at: new Date().toISOString()
        };
        var res = await DB.upsert("ig_comentario_regras", linha, "conta_id");
        regras[contaSel] = (res && res[0]) || linha;
        V.toast("Regra salva.");
      } catch (e) { V.toast("Erro ao salvar: " + e.message); }
      finally { b.disabled = false; }
    });
  }

  V.aoMostrar = function (nome) {
    if (nome === "painel") renderResumo();
    if (nome === "instagram") renderLeadsTela();
  };
})();
