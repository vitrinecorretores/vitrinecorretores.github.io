/* Slides de cálculo (sem IA): simulação de financiamento (SAC x Price) e "alugar ou comprar?".
   Devolve slides no formato do app: {tag, titulo, corpo} — títulos curtos com *destaque*. */
(function () {
  "use strict";

  function arred(v) { return Math.round(v); }
  function milhar(v) { return String(arred(v)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function dec(v, c) { return Number(v).toFixed(c == null ? 1 : c).replace(".", ","); }
  // R$ 500 mil / R$ 15,9 mil / R$ 1,2 milhão / R$ 2,5 milhões / R$ 4.756
  function reaisCurto(v) {
    v = Math.abs(v);
    if (v >= 1e6) {
      var m = Math.round(v / 1e4) / 100, txt = (Math.abs(m - Math.round(m)) < 0.005 ? String(Math.round(m)) : dec(m, 2).replace(/0$/, ""));
      return "R$ " + txt + (m < 2 ? " milhão" : " milhões");
    }
    if (v >= 1e5) return "R$ " + Math.round(v / 1000) + " mil";
    if (v >= 1e4) return "R$ " + dec(v / 1000, 1).replace(/,0$/, "") + " mil";
    return "R$ " + milhar(v);
  }
  function reais(v) { return "R$ " + milhar(v); }
  function taxaMensal(aa) { return Math.pow(1 + aa / 100, 1 / 12) - 1; }

  /* ---------- financiamento ---------- */
  // taxa anual EFETIVA ilustrativa; ignora seguros, tarifas e TR
  function calcFin(o) {
    var entrada = o.valor * o.entradaPct / 100, F = o.valor - entrada, n = Math.round(o.anos * 12), i = taxaMensal(o.taxaAnual);
    var amort = F / n;
    var sac1 = amort + F * i, sacN = amort * (1 + i);
    var sacJuros = i * amort * n * (n + 1) / 2;
    var pmt = i === 0 ? F / n : F * i / (1 - Math.pow(1 + i, -n));
    var priceTotal = pmt * n, priceJuros = priceTotal - F;
    return {
      entrada: entrada, financiado: F, meses: n, i: i, amort: amort,
      sac1: sac1, sacN: sacN, sacJuros: sacJuros, sacTotal: F + sacJuros,
      pmt: pmt, priceJuros: priceJuros, priceTotal: priceTotal,
      rendaSac: sac1 / 0.3, rendaPrice: pmt / 0.3
    };
  }

  function slidesFinanciamento(o) {
    var r = calcFin(o), v = reaisCurto(o.valor), anos = o.anos;
    var base = "Entrada de " + dec(o.entradaPct, o.entradaPct % 1 ? 1 : 0) + "%, " + anos + " anos e juros de " + dec(o.taxaAnual, 2).replace(/0$/, "").replace(/,$/, "") + "% ao ano.";
    return [
      { tag: "SIMULAÇÃO", titulo: "Imóvel de " + v + ": quanto fica a *parcela*?", corpo: base + " Arrasta e veja a conta." },
      { tag: "ENTRADA", titulo: "Entrada de *" + reaisCurto(r.entrada) + "*", corpo: "Você dá " + dec(o.entradaPct, o.entradaPct % 1 ? 1 : 0) + "% do valor e financia " + reais(r.financiado) + ". Se tiver FGTS, vale conferir se dá pra usar na entrada." },
      { tag: "1ª PARCELA", titulo: "SAC *" + reaisCurto(r.sac1) + "* ou Price *" + reaisCurto(r.pmt) + "*?", corpo: "No SAC a 1ª parcela é de " + reais(r.sac1) + " e cai todo mês, até " + reais(r.sacN) + ". Na Price a parcela é fixa: " + reais(r.pmt) + "." },
      { tag: "JUROS", titulo: "Só de juros: *" + reaisCurto(r.priceJuros) + "* na Price", corpo: "No SAC você paga " + reais(r.sacJuros) + " de juros no total; na Price, " + reais(r.priceJuros) + ". Diferença: " + reais(r.priceJuros - r.sacJuros) + " a favor do SAC." },
      { tag: "RENDA", titulo: "Renda mínima: *" + reaisCurto(r.rendaSac) + "*", corpo: "Os bancos costumam limitar a parcela a 30% da renda. Pra 1ª parcela do SAC você precisa ganhar uns " + reais(r.rendaSac) + "; na Price, uns " + reais(r.rendaPrice) + "." },
      { tag: "RESUMO", titulo: "Resumo da *simulação*", corpo: "Imóvel " + reais(o.valor) + " · entrada " + reais(r.entrada) + "\nFinanciado " + reais(r.financiado) + " em " + anos + " anos\nSAC: 1ª parcela " + reais(r.sac1) + " · Price: " + reais(r.pmt) + "\nTaxa ilustrativa de " + dec(o.taxaAnual, 2).replace(/0$/, "").replace(/,$/, "") + "% a.a. — confira com o banco." },
      { tag: "PRÓXIMO PASSO", titulo: "Comenta *SIMULAÇÃO*", corpo: "Eu faço a conta do seu caso, sem compromisso. Salva este post pra consultar depois." }
    ];
  }

  /* ---------- alugar ou comprar (10 anos) ---------- */
  function calcAlugarComprar(o) {
    var meses = 120, n = Math.round(o.anos * 12), i = taxaMensal(o.taxaAnual), re = o.rend / 100;
    var entrada = o.valor * o.entradaPct / 100, F = o.valor - entrada;
    var pmt = i === 0 ? F / n : F * i / (1 - Math.pow(1 + i, -n));
    var k = Math.min(meses, n);
    var saldo = i === 0 ? F - pmt * k : F * Math.pow(1 + i, k) - pmt * (Math.pow(1 + i, k) - 1) / i;
    var valor10 = o.valor * Math.pow(1 + o.valoriz / 100, 10);
    var patrimonioCompra = valor10 - saldo;
    var desembolsoCompra = entrada + pmt * k;
    // quem aluga investe a entrada e a diferença mensal (parcela - aluguel; se negativa, resgata)
    var carteira = entrada, aluguel = o.aluguel, totalAluguel = 0;
    for (var m = 1; m <= meses; m++) {
      if (m > 1 && (m - 1) % 12 === 0) aluguel *= 1 + o.reaj / 100;
      carteira = carteira * (1 + re) + (pmt - aluguel);
      totalAluguel += aluguel;
    }
    return { entrada: entrada, financiado: F, pmt: pmt, valor10: valor10, saldo: saldo, patrimonioCompra: patrimonioCompra, desembolsoCompra: desembolsoCompra, patrimonioAluguel: carteira, totalAluguel: totalAluguel, aluguelFinal: aluguel };
  }

  function slidesAlugarComprar(o) {
    var r = calcAlugarComprar(o), v = reaisCurto(o.valor);
    var compraGanha = r.patrimonioCompra >= r.patrimonioAluguel, dif = Math.abs(r.patrimonioCompra - r.patrimonioAluguel);
    var pctRend = dec(o.rend, 2).replace(/0$/, "").replace(/,$/, "");
    return [
      { tag: "ALUGAR OU COMPRAR?", titulo: "Alugar ou *comprar*? A conta de 10 anos", corpo: "Imóvel de " + v + " ou aluguel de " + reais(o.aluguel) + " por mês: veja quem sai na frente." },
      { tag: "O CENÁRIO", titulo: "Os números da *simulação*", corpo: "Entrada " + reais(r.entrada) + " (" + dec(o.entradaPct, 0) + "%) · financiamento em " + o.anos + " anos a " + dec(o.taxaAnual, 2).replace(/0$/, "").replace(/,$/, "") + "% a.a.\nParcela estimada: " + reais(r.pmt) + "\nAluguel: " + reais(o.aluguel) + " (reajuste de " + dec(o.reaj, 0) + "% ao ano)\nAplicação rendendo " + pctRend + "% ao mês" },
      { tag: "COMPRANDO", titulo: "Comprando: patrimônio de *" + reaisCurto(r.patrimonioCompra) + "*", corpo: "Com valorização de " + dec(o.valoriz, 0) + "% ao ano, o imóvel vale " + reais(r.valor10) + " em 10 anos. Menos o saldo devedor de " + reais(r.saldo) + ". Você desembolsou " + reais(r.desembolsoCompra) + " (entrada + parcelas)." },
      { tag: "ALUGANDO", titulo: "Alugando e investindo: *" + reaisCurto(r.patrimonioAluguel) + "*", corpo: "Você aplica a entrada de " + reais(r.entrada) + " e a diferença entre parcela e aluguel todo mês. Em 10 anos, paga " + reais(r.totalAluguel) + " de aluguel e fica com a carteira." },
      { tag: "RESULTADO", titulo: (compraGanha ? "Comprar" : "Alugar") + " sai na frente em *" + reaisCurto(dif) + "*", corpo: "Nestas premissas, em 10 anos " + (compraGanha ? "comprar" : "alugar e investir") + " deixa você com " + reais(dif) + " a mais. Mudando taxa, valorização ou rendimento, o resultado muda." },
      { tag: "ATENÇÃO", titulo: "O que a conta *não* mostra", corpo: "Condomínio, IPTU, reformas, ITBI e corretagem, além da liquidez do dinheiro. Casa própria também traz segurança — não é só número. Valores ilustrativos." },
      { tag: "PRÓXIMO PASSO", titulo: "Comenta *SIMULAÇÃO*", corpo: "Eu faço a conta do seu caso, sem compromisso. Salva este post pra consultar depois." }
    ];
  }

  function descricaoFinanciamento(o) {
    return "Simulação de financiamento: imóvel de " + reaisCurto(o.valor) + ", entrada " + dec(o.entradaPct, 0) + "%, " + o.anos + " anos, juros " + dec(o.taxaAnual, 2).replace(/0$/, "").replace(/,$/, "") + "% a.a., SAC x Price";
  }
  function descricaoAlugarComprar(o) {
    return "Alugar ou comprar? Imóvel de " + reaisCurto(o.valor) + " x aluguel de " + reais(o.aluguel) + ", entrada " + dec(o.entradaPct, 0) + "%, comparativo em 10 anos";
  }

  window.VitrineSim = {
    calcFin: calcFin, calcAlugarComprar: calcAlugarComprar,
    slidesFinanciamento: slidesFinanciamento, slidesAlugarComprar: slidesAlugarComprar,
    descricaoFinanciamento: descricaoFinanciamento, descricaoAlugarComprar: descricaoAlugarComprar,
    reaisCurto: reaisCurto
  };
})();
