/* Vitrine — calendário de datas comemorativas e imobiliárias do Brasil (out/2026 a dez/2027).
   Cada data traz um tema de carrossel imobiliário e a antecedência ideal (dias) para postar.
   Uso: window.VitrineDatas.proximas(new Date(), 30, 3) */
(function () {
  "use strict";
  // d = início (AAAA-MM-DD), f = fim opcional (períodos), ant = antecedência ideal em dias
  var LISTA = [
    { d: "2026-10-31", nome: "Halloween", ant: 5, tema: "5 sustos que você pode levar na hora de comprar um imóvel (e como evitar cada um)" },
    { d: "2026-11-20", nome: "Feriado da Consciência Negra", ant: 6, tema: "Feriadão: aproveite pra visitar imóveis com calma, o que olhar em cada visita" },
    { d: "2026-11-27", nome: "Black Friday", ant: 10, tema: "Black Friday imobiliária: como negociar desconto de verdade na compra do imóvel" },
    { d: "2026-11-30", nome: "13º salário (1ª parcela)", ant: 10, tema: "Como usar o 13º salário como entrada ou para quitar parcelas do imóvel" },
    { d: "2026-12-20", nome: "13º salário (2ª parcela)", ant: 10, tema: "13º salário na mão: vale usar na entrada do imóvel ou amortizar o financiamento?" },
    { d: "2026-12-25", nome: "Natal", ant: 10, tema: "O melhor presente de Natal é a casa própria: como começar a planejar" },
    { d: "2026-12-31", nome: "Ano Novo", ant: 10, tema: "Meta de 2027: sair do aluguel, os primeiros passos para comprar seu imóvel" },
    { d: "2027-01-05", f: "2027-02-28", nome: "IPTU (janeiro e fevereiro)", ant: 7, tema: "IPTU: como conferir o valor, pagar menos e o que é cobrado do dono do imóvel" },
    { d: "2027-02-01", nome: "Volta às aulas", ant: 14, tema: "Imóvel perto de boas escolas: o que pesa na escolha do bairro para quem tem filhos" },
    { d: "2027-02-08", f: "2027-02-09", nome: "Carnaval", ant: 10, tema: "Imóvel de temporada e casa de praia: como investir pensando no Carnaval" },
    { d: "2027-03-08", nome: "Dia Internacional da Mulher", ant: 7, tema: "Mulheres que compraram o primeiro imóvel: o passo a passo para conquistar o seu" },
    { d: "2027-03-15", nome: "Dia do Consumidor", ant: 10, tema: "Direitos do consumidor na compra do imóvel: o que exigir antes de assinar" },
    { d: "2027-03-15", f: "2027-05-31", nome: "Imposto de Renda", ant: 10, tema: "Imposto de Renda e imóvel: como declarar a compra, a venda e o financiamento" },
    { d: "2027-03-28", nome: "Páscoa", ant: 10, tema: "Páscoa em casa nova: 5 sinais de que é hora de trocar de imóvel" },
    { d: "2027-05-09", nome: "Dia das Mães", ant: 14, tema: "Presentear a mãe com um lar: como ajudar a família a realizar o sonho da casa própria" },
    { d: "2027-06-12", nome: "Dia dos Namorados", ant: 12, tema: "Casal comprando o primeiro imóvel juntos: o que combinar antes de assinar" },
    { d: "2027-07-01", f: "2027-07-31", nome: "Férias de julho", ant: 10, tema: "Férias de julho: imóvel pra temporada e bairro bom pra morar com a família" },
    { d: "2027-08-08", nome: "Dia dos Pais", ant: 14, tema: "Casa própria é herança em vida: como o pai pode planejar o imóvel da família" },
    { d: "2027-08-27", nome: "Dia do Corretor de Imóveis", ant: 10, tema: "Por que contratar um corretor de confiança faz diferença na compra e na venda" },
    { d: "2027-10-12", nome: "Dia das Crianças", ant: 10, tema: "Casa pensada pra criança: o que olhar no imóvel quando tem filhos pequenos" },
    { d: "2027-11-26", nome: "Black Friday", ant: 10, tema: "Black Friday imobiliária: como negociar desconto de verdade na compra do imóvel" },
    { d: "2027-11-30", nome: "13º salário (1ª parcela)", ant: 10, tema: "Como usar o 13º salário como entrada ou para quitar parcelas do imóvel" },
    { d: "2027-12-20", nome: "13º salário (2ª parcela)", ant: 10, tema: "13º salário na mão: vale usar na entrada do imóvel ou amortizar o financiamento?" },
    { d: "2027-12-25", nome: "Natal", ant: 10, tema: "O melhor presente de Natal é a casa própria: como começar a planejar" },
    { d: "2027-12-31", nome: "Ano Novo", ant: 10, tema: "Meta de 2028: sair do aluguel, os primeiros passos para comprar seu imóvel" }
  ];

  function dia(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function zera(dt) { return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); }

  // próximas datas dentro de "dias" a partir de hoje (inclui períodos em andamento), ordenadas, no máximo n
  function proximas(hoje, dias, n) {
    var h = zera(hoje || new Date()), lim = new Date(h.getTime() + (dias || 30) * 86400000), out = [];
    LISTA.forEach(function (x) {
      var ini = dia(x.d), fim = x.f ? dia(x.f) : ini;
      if (fim < h || ini > lim) return;
      var emAndamento = ini < h;
      out.push({ nome: x.nome, tema: x.tema, ant: x.ant, data: ini, fim: x.f ? fim : null, emAndamento: emAndamento,
        faltam: emAndamento ? 0 : Math.round((ini - h) / 86400000) });
    });
    out.sort(function (a, b) { return (a.emAndamento ? 0 : a.data) - (b.emAndamento ? 0 : b.data) || a.data - b.data; });
    return out.slice(0, n || 3);
  }

  window.VitrineDatas = { lista: LISTA, proximas: proximas };
})();
