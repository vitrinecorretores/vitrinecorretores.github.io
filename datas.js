/* Vitrine — calendário de datas comemorativas e imobiliárias do Brasil (out/2026 a dez/2027).
   Cada data traz um tema de carrossel imobiliário e a antecedência ideal (dias) para postar.
   Uso: window.VitrineDatas.proximas(new Date(), 30, 3) */
(function () {
  "use strict";
  // d = início (AAAA-MM-DD), f = fim opcional (períodos), ant = antecedência ideal em dias
  var LISTA = [
    { d: "2026-10-31", nome: "Halloween", ant: 5, foto: ["halloween pumpkins", "halloween night party", "kids halloween costumes"], tema: "5 sustos que você pode levar na hora de comprar um imóvel (e como evitar cada um)" },
    { d: "2026-11-20", nome: "Feriado da Consciência Negra", ant: 6, foto: ["afro brazilian family smiling", "black brazilian woman smiling", "afro brazilian couple"], tema: "Feriadão: aproveite pra visitar imóveis com calma, o que olhar em cada visita" },
    { d: "2026-11-27", nome: "Black Friday", ant: 10, foto: ["black friday shopping bags", "black friday sale", "shopping discount tags"], tema: "Black Friday imobiliária: como negociar desconto de verdade na compra do imóvel" },
    { d: "2026-11-30", nome: "13º salário (1ª parcela)", ant: 10, foto: ["money bills wallet", "piggy bank coins", "saving money"], tema: "Como usar o 13º salário como entrada ou para quitar parcelas do imóvel" },
    { d: "2026-12-20", nome: "13º salário (2ª parcela)", ant: 10, foto: ["money bills wallet", "piggy bank coins", "saving money"], tema: "13º salário na mão: vale usar na entrada do imóvel ou amortizar o financiamento?" },
    { d: "2026-12-25", nome: "Natal", ant: 10, foto: ["christmas tree lights", "christmas gifts", "santa claus christmas"], tema: "O melhor presente de Natal é a casa própria: como começar a planejar" },
    { d: "2026-12-31", nome: "Ano Novo", ant: 10, foto: ["new year fireworks", "new year celebration champagne", "fireworks night sky"], tema: "Meta de 2027: sair do aluguel, os primeiros passos para comprar seu imóvel" },
    { d: "2027-01-05", f: "2027-02-28", nome: "IPTU (janeiro e fevereiro)", ant: 7, foto: ["tax calculator bills", "paying bills calculator", "tax payment"], tema: "IPTU: como conferir o valor, pagar menos e o que é cobrado do dono do imóvel" },
    { d: "2027-02-01", nome: "Volta às aulas", ant: 14, foto: ["kids school backpack", "children going to school", "school supplies"], tema: "Imóvel perto de boas escolas: o que pesa na escolha do bairro para quem tem filhos" },
    { d: "2027-02-08", f: "2027-02-09", nome: "Carnaval", ant: 10, foto: ["brazil carnival party", "carnival confetti celebration", "carnival street party"], tema: "Imóvel de temporada e casa de praia: como investir pensando no Carnaval" },
    { d: "2027-03-08", nome: "Dia Internacional da Mulher", ant: 7, foto: ["confident woman smiling", "women celebrating together", "successful woman portrait"], tema: "Mulheres que compraram o primeiro imóvel: o passo a passo para conquistar o seu" },
    { d: "2027-03-15", nome: "Dia do Consumidor", ant: 10, foto: ["shopping consumer", "customer shopping bags", "happy customer"], tema: "Direitos do consumidor na compra do imóvel: o que exigir antes de assinar" },
    { d: "2027-03-15", f: "2027-05-31", nome: "Imposto de Renda", ant: 10, foto: ["tax return documents", "income tax calculator", "tax form"], tema: "Imposto de Renda e imóvel: como declarar a compra, a venda e o financiamento" },
    { d: "2027-03-28", nome: "Páscoa", ant: 10, foto: ["easter eggs chocolate", "easter bunny", "kids easter egg hunt"], tema: "Páscoa em casa nova: 5 sinais de que é hora de trocar de imóvel" },
    { d: "2027-05-09", nome: "Dia das Mães", ant: 14, foto: ["mother playing with child", "mother hugging son", "mother and daughter smiling"], tema: "Presentear a mãe com um lar: como ajudar a família a realizar o sonho da casa própria" },
    { d: "2027-06-12", nome: "Dia dos Namorados", ant: 12, foto: ["couple in love", "romantic couple hugging", "couple holding hands"], tema: "Casal comprando o primeiro imóvel juntos: o que combinar antes de assinar" },
    { d: "2027-07-01", f: "2027-07-31", nome: "Férias de julho", ant: 10, foto: ["family vacation travel", "kids on vacation", "family road trip"], tema: "Férias de julho: imóvel pra temporada e bairro bom pra morar com a família" },
    { d: "2027-08-08", nome: "Dia dos Pais", ant: 14, foto: ["father teaching son", "father and son playing", "dad and daughter smiling"], tema: "Casa própria é herança em vida: como o pai pode planejar o imóvel da família" },
    { d: "2027-08-27", nome: "Dia do Corretor de Imóveis", ant: 10, foto: ["real estate agent handshake", "real estate agent smiling", "real estate agent showing"], tema: "Por que contratar um corretor de confiança faz diferença na compra e na venda" },
    { d: "2027-10-12", nome: "Dia das Crianças", ant: 10, foto: ["children playing outdoors", "kids playing together", "happy children running"], tema: "Casa pensada pra criança: o que olhar no imóvel quando tem filhos pequenos" },
    { d: "2027-11-26", nome: "Black Friday", ant: 10, foto: ["black friday shopping bags", "black friday sale", "shopping discount tags"], tema: "Black Friday imobiliária: como negociar desconto de verdade na compra do imóvel" },
    { d: "2027-11-30", nome: "13º salário (1ª parcela)", ant: 10, foto: ["money bills wallet", "piggy bank coins", "saving money"], tema: "Como usar o 13º salário como entrada ou para quitar parcelas do imóvel" },
    { d: "2027-12-20", nome: "13º salário (2ª parcela)", ant: 10, foto: ["money bills wallet", "piggy bank coins", "saving money"], tema: "13º salário na mão: vale usar na entrada do imóvel ou amortizar o financiamento?" },
    { d: "2027-12-25", nome: "Natal", ant: 10, foto: ["christmas tree lights", "christmas gifts", "santa claus christmas"], tema: "O melhor presente de Natal é a casa própria: como começar a planejar" },
    { d: "2027-12-31", nome: "Ano Novo", ant: 10, foto: ["new year fireworks", "new year celebration champagne", "fireworks night sky"], tema: "Meta de 2028: sair do aluguel, os primeiros passos para comprar seu imóvel" }
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
      out.push({ nome: x.nome, tema: x.tema, ant: x.ant, foto: x.foto || null, data: ini, fim: x.f ? fim : null, emAndamento: emAndamento,
        faltam: emAndamento ? 0 : Math.round((ini - h) / 86400000) });
    });
    out.sort(function (a, b) { return (a.emAndamento ? 0 : a.data) - (b.emAndamento ? 0 : b.data) || a.data - b.data; });
    return out.slice(0, n || 3);
  }

  window.VitrineDatas = { lista: LISTA, proximas: proximas };
})();
