/* Elida · peças de tela do Radar: ícones, chips, veredito da casa, "o que mudou" e o simulador da entrada.
   Só monta HTML e escuta cliques dentro do próprio componente. Tudo que vem de dados passa por esc().
   Nenhuma rede, nenhum armazenamento. O resultado vem do motor (ElidaRegras) via ElidaDemo.
   Verde quer dizer "nada encontrado nos dados conferidos", nunca "seguro". */
(function (raiz, fabrica) {
  "use strict";
  var api = fabrica(typeof module === "object" && module.exports ? require("./elida-demo.js") : raiz.ElidaDemo);
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ElidaUau = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (D) {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hoje() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  /* ---------- Ícones ---------- */
  var S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var ICONES_TOM = {
    risco: '<svg ' + S + '><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
    atencao: '<svg ' + S + '><path d="M12 3.5 2.8 19.5h18.4Z"/><path d="M12 10v4.2M12 17.2v.1"/></svg>',
    falta: '<svg ' + S + '><circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.2 1-1.2 1.9M12 17v.1"/></svg>',
    neutro: '<svg ' + S + '><circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.8v.1"/></svg>',
    ok: '<svg ' + S + '><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>'
  };
  var ICONES_PROD = {
    biscoito: '<svg ' + S + '><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9.5" r="1"/><circle cx="14.5" cy="8.5" r="1"/><circle cx="15" cy="14" r="1"/><circle cx="9.5" cy="15" r="1"/></svg>',
    pao: '<svg ' + S + '><path d="M5 10a4 4 0 0 1 3-6.5h8A4 4 0 0 1 19 10v8.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5Z"/><path d="M9 12v4M15 12v4"/></svg>',
    achocolatado: '<svg ' + S + '><path d="M6 8h12l-1 11.5a1.5 1.5 0 0 1-1.5 1.4h-7a1.5 1.5 0 0 1-1.5-1.4Z"/><path d="M5 8h14M9 12h6"/><path d="M9 4.5h6"/></svg>'
  };
  var ICONES_MODO = {
    codigo: '<svg ' + S + '><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8 8v8M11 8v8M14 8v5M17 8v8"/></svg>',
    foto: '<svg ' + S + '><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.4"/></svg>',
    busca: '<svg ' + S + '><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>'
  };

  /* ---------- Chips e linhas ---------- */
  function chipTom(t, texto) { return '<span class="tom" data-tom="' + esc(t) + '">' + (ICONES_TOM[t] || "") + esc(texto || D.ROTULO_TOM[t] || "") + '</span>'; }
  function inicial(p) { return esc(String(p.apelido || "?").trim().charAt(0).toUpperCase()); }
  function avatar(p, t, pequeno) { return '<span class="pessoa-av' + (pequeno ? ' sm' : '') + '" data-tom="' + esc(t) + '" aria-hidden="true">' + inicial(p) + '</span>'; }

  /* Destaca no texto os termos que o motor achou. Casa sem acento e sem diferença de maiúsculas. */
  function alinhado(texto) {
    var s = "";
    for (var i = 0; i < texto.length; i++) { var c = texto.charAt(i).normalize("NFD").charAt(0).toLowerCase(); s += c; }
    return s;
  }
  function destacar(texto, termoTom) {
    texto = String(texto == null ? "" : texto);
    var base = alinhado(texto), marcas = [];
    Object.keys(termoTom).sort(function (a, b) { return b.length - a.length; }).forEach(function (termo) {
      var from = 0, i;
      while ((i = base.indexOf(termo, from)) >= 0) {
        var antes = base.charAt(i - 1), depois = base.charAt(i + termo.length);
        var livre = !marcas.some(function (m) { return i < m.fim && i + termo.length > m.ini; });
        if (livre && !/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(depois)) marcas.push({ ini: i, fim: i + termo.length, tom: termoTom[termo] });
        from = i + termo.length;
      }
    });
    marcas.sort(function (a, b) { return a.ini - b.ini; });
    var out = "", pos = 0;
    marcas.forEach(function (m) {
      out += esc(texto.slice(pos, m.ini)) + '<mark data-tom="' + esc(m.tom) + '">' + esc(texto.slice(m.ini, m.fim)) + '</mark>';
      pos = m.fim;
    });
    return out + esc(texto.slice(pos));
  }
  var DECLARACOES = { sem_lactose: "Sem lactose", contem_lactose: "Contém lactose", nao_contem: "Não contém glúten", contem: "Contém glúten" };
  function declaracoes(r) {
    var l = [];
    if (r.declaracaoLactose && DECLARACOES[r.declaracaoLactose]) l.push(DECLARACOES[r.declaracaoLactose]);
    if (r.declaracaoGluten && DECLARACOES[r.declaracaoGluten]) l.push(DECLARACOES[r.declaracaoGluten]);
    return l;
  }

  /* O "pacote" de demonstração: o texto do rótulo com o que o motor achou destacado e o que entrou marcado. */
  function r0(produto, versao) { return produto[versao]; }
  function pacoteHtml(produto, versao, casa, diff, lido) {
    var r = produto[versao], mapa = lido ? D.termosDestacar(casa, r0(produto, versao)) : {}, novos = versao === "atual" ? diff.ingredientesNovos.map(function (x) { return x.toLowerCase(); }) : [];
    var ingr = (r.ingredientes || []).map(function (x) {
      var h = destacar(x, mapa);
      return novos.indexOf(String(x).toLowerCase()) >= 0 ? '<ins>' + h + '</ins>' : h;
    }).join(", ");
    var novoContem = versao === "atual" && diff.contemNovos.length, novoPode = versao === "atual" && diff.podeConterNovos.length;
    var contem = destacar(r.advertencias.contem, mapa), pode = destacar(r.advertencias.podeConter, mapa);
    var decl = declaracoes(r);
    return '<div class="uau-pack"' + (lido ? ' data-lido="1"' : '') + '><h3>' + esc(produto.nome) + '</h3><p class="uau-sub">' + esc(produto.detalhe) + ' · ' + (versao === "atual" ? "na prateleira hoje" : "versão que a família guardou") + '</p>' +
      '<p><b>INGREDIENTES:</b> ' + ingr + '.</p>' +
      (r.advertencias.contem ? '<p><b>ALÉRGICOS:</b> ' + (novoContem ? '<ins>' + contem + '</ins>' : contem) + '</p>' : '') +
      (r.advertencias.podeConter ? '<p><b>PODE CONTER:</b> ' + (novoPode ? '<ins>' + pode + '</ins>' : pode) + '</p>' : '') +
      (decl.length ? '<p class="uau-decl"><b>DECLARAÇÕES:</b> ' + esc(decl.join(" · ")) + '</p>' : '') +
      '<div class="uau-feixe" aria-hidden="true"></div></div>';
  }

  /* ---------- Veredito da casa ---------- */
  function tituloCasa(casa) {
    var c = casa.contagem, n = casa.linhas.length;
    if (!n) return "Escolha quem vai comer";
    if (casa.geral === "risco") return c.risco === 1 ? "1 pessoa da casa precisa evitar" : c.risco + " pessoas da casa precisam evitar";
    if (casa.geral === "atencao") return "Pede atenção antes de comprar";
    if (casa.geral === "falta") return "Faltam dados para concluir";
    if (casa.geral === "neutro") return "Só informativo para esta casa";
    return "Nada encontrado nos dados conferidos";
  }
  function motivoLinha(l) {
    var d = l.detalhes[0];
    if (!d) return "";
    return (d.nome ? d.nome + ": " : "") + d.motivos.join(" ");
  }
  function linhaHtml(l, i, abrir, prefixo) {
    var id = (prefixo || "uau") + "-mais-" + i;
    var expl = [];
    l.achados.forEach(function (t) { var e = D.explicar(t); if (e && expl.indexOf(e) < 0) expl.push(e); });
    return '<li class="uau-linha" style="--i:' + i + '"><button type="button" data-uau-linha="' + i + '" aria-expanded="' + (abrir ? "true" : "false") + '" aria-controls="' + id + '">' +
      avatar(l.perfil, l.tom) +
      '<span><span class="uau-nome">' + esc(l.perfil.apelido) + '</span><span class="nivel">' + esc(l.nivel.rotulo) + '</span></span>' +
      chipTom(l.tom, D.ROTULO_TOM[l.tom]) + '</button>' +
      '<div class="uau-mais" id="' + id + '"' + (abrir ? '' : ' hidden') + '>' +
      '<p><b>' + esc(l.frase) + '.</b> ' + esc(motivoLinha(l)) + '</p>' +
      expl.map(function (e) { return '<p class="uau-pq">' + esc(e) + '</p>'; }).join("") +
      '</div></li>';
  }
  function casaHtml(casa, opcoes) {
    opcoes = opcoes || {};
    if (!casa.linhas.length) return '<div class="uau-vazio">Escolha pelo menos uma pessoa para ver o resultado da casa.</div>';
    return '<div class="uau-casa"><div class="uau-casa-topo"><span class="uau-casa-sel" data-tom="' + esc(casa.geral) + '" aria-hidden="true"></span>' +
      '<div><h3>' + esc(tituloCasa(casa)) + '</h3></div></div>' +
      '<p class="uau-resumo">' + esc(casa.resumo) + '</p>' +
      '<ul class="uau-linhas">' + casa.linhas.map(function (l, i) { return linhaHtml(l, i, i === 0 && opcoes.abrirPrimeira !== false, opcoes.prefixo); }).join("") + '</ul></div>';
  }

  /* ---------- "O que mudou" ---------- */
  function mudancasHtml(cmp) {
    var d = cmp.diferenca;
    if (!d.mudou) return '<div class="uau-mudou"><h4>Os dois rótulos coincidem</h4><p class="uau-rodape">Nada mudou nos ingredientes nem nos avisos que o app lê.</p></div>';
    var itens = [];
    function afeta(texto) {
      var lista = D.afetados(cmp.impactos, texto);
      if (!lista.length) return "";
      return '<span class="uau-afeta">' + lista.map(function (i) { return chipTom(i.para, i.perfil.apelido + ": " + D.ROTULO_TOM[i.para]); }).join("") + '</span>';
    }
    function exp(texto) {
      var e = D.explicar(D.termoPrincipal(texto));
      return e ? '<small>' + esc(e) + '</small>' : "";
    }
    d.ingredientesNovos.forEach(function (x) { itens.push('<li><b>Entrou no ingrediente: ' + esc(x) + '.</b>' + exp(x) + afeta(x) + '</li>'); });
    d.contemNovos.forEach(function (x) { itens.push('<li><b>Novo aviso "contém": ' + esc(x) + '.</b>' + exp(x) + afeta(x) + '</li>'); });
    d.podeConterNovos.forEach(function (x) { itens.push('<li><b>Novo aviso "pode conter": ' + esc(x) + '.</b><small>Pode haver traços por contaminação cruzada na fábrica.</small>' + afeta(x) + '</li>'); });
    d.ingredientesRetirados.forEach(function (x) { itens.push('<li><b>Saiu do ingrediente: ' + esc(x) + '.</b></li>'); });
    d.podeConterRetirados.forEach(function (x) { itens.push('<li><b>Saiu o aviso "pode conter": ' + esc(x) + '.</b></li>'); });
    d.contemRetirados.forEach(function (x) { itens.push('<li><b>Saiu o aviso "contém": ' + esc(x) + '.</b></li>'); });
    return '<div class="uau-mudou"><h4>' + ICONES_TOM.atencao + 'O que mudou desde a última compra</h4><ul>' + itens.join("") + '</ul></div>';
  }
  /* ---------- Simulador ---------- */
  var RODAPE = "Exemplo fictício, feito para ensinar. Os rótulos acima não são de nenhuma marca. O Elida nunca diz que um produto é seguro: " +
    "\"nada encontrado\" só quer dizer que o app não achou nada nos dados conferidos. Confira sempre a embalagem na sua mão.";

  /* Abre ou fecha a explicação de uma pessoa no veredito. Usado fora do simulador (conferências no app). */
  function alternarLinha(botao) {
    if (!botao || !botao.getAttribute) return;
    var aberto = botao.getAttribute("aria-expanded") === "true";
    botao.setAttribute("aria-expanded", String(!aberto));
    var doc = botao.ownerDocument, mais = doc && doc.getElementById(botao.getAttribute("aria-controls"));
    if (mais) mais.hidden = aberto;
  }
  function montarSimulador(el, opcoes) {
    opcoes = opcoes || {};
    var data = opcoes.hoje || hoje();
    var movimentoReduzido = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var lista = D.produtos(data);
    var estado = { prod: opcoes.produtoId || lista[0].id, versao: "atual", ids: D.PERFIS.map(function (p) { return p.id; }), lido: false, lendo: false, abertas: {} };
    var timer = null, morto = false;
    el.classList.add("uau-sim");
    el.setAttribute("data-ligado", "1");
    if (opcoes.largo) el.classList.add("largo");

    function produto() { return lista.filter(function (p) { return p.id === estado.prod; })[0] || lista[0]; }
    function sim() { return D.simular({ produtoId: estado.prod, versao: estado.versao, perfilIds: estado.ids, hoje: data }); }

    function chaveFoco() {
      var a = document.activeElement;
      if (!a || !el.contains(a) || !a.dataset) return null;
      var nomes = ["uauProd", "uauVer", "uauPessoa", "uauLinha"];
      for (var i = 0; i < nomes.length; i++) if (a.dataset[nomes[i]] != null) return [nomes[i], a.dataset[nomes[i]]];
      return null;
    }
    function desenhar() {
      if (morto) return;
      var chave = chaveFoco();
      var s = sim(), p = produto();
      var prods = '<div class="uau-prods" role="group" aria-label="Escolha um produto de exemplo">' + lista.map(function (x) {
        return '<button type="button" class="uau-chip" data-uau-prod="' + esc(x.id) + '" aria-pressed="' + (x.id === estado.prod) + '">' + (ICONES_PROD[x.icone] || "") + esc(x.nome) + '</button>';
      }).join("") + '</div>';
      var palco = '<div class="uau-palco"' + (estado.lendo ? ' data-lendo="1" aria-busy="true"' : '') + '><div class="uau-palco-topo"><span><b>Rótulo escaneado</b><span class="uau-fic"> · exemplo fictício</span></span>' +
        '<span class="uau-ver" role="group" aria-label="Qual versão do rótulo">' +
        '<button type="button" data-uau-ver="anterior" aria-pressed="' + (estado.versao === "anterior") + '">Antes</button>' +
        '<button type="button" data-uau-ver="atual" aria-pressed="' + (estado.versao === "atual") + '">Agora</button></span></div>' +
        pacoteHtml(p, estado.versao, s.casa, s.comparacao.diferenca, estado.lido && !estado.lendo) +
        '<p class="uau-lendo-txt" role="status" aria-live="polite">' + (estado.lendo ? "Lendo o rótulo e conferindo cada pessoa da casa…" : "") + '</p></div>';
      var pessoas = '<div class="uau-pessoas" role="group" aria-label="Quem vai comer">' + D.PERFIS.map(function (x) {
        var on = estado.ids.indexOf(x.id) >= 0, ln = s.casa.linhas.filter(function (l) { return l.perfil.id === x.id; })[0];
        return '<button type="button" class="uau-chip" data-uau-pessoa="' + esc(x.id) + '" aria-pressed="' + on + '">' + avatar(x, ln ? ln.tom : "falta", true) + esc(x.apelido) + '</button>';
      }).join("") + '</div>';
      var res = "";
      if (estado.lido && !estado.lendo) {
        res = '<div class="uau-resultado" aria-live="polite">' + casaHtml(s.casa, { prefixo: "uau" }) +
          (estado.versao === "atual" ? mudancasHtml(s.comparacao) : '<div class="uau-vazio">Esta é a versão guardada pela família. Toque em <b>Agora</b> para ver o que mudou na prateleira.</div>') +
          '<p class="uau-rodape">' + esc(RODAPE) + '</p></div>';
      }
      el.innerHTML = prods + palco + pessoas + res;
      /* Na landing a página só tem o h1: os títulos da simulação entram como nível 2 e 3, sem pular nível. */
      if (opcoes.nivelTitulo) {
        Array.prototype.forEach.call(el.querySelectorAll("h3"), function (h) { h.setAttribute("aria-level", String(opcoes.nivelTitulo)); });
        Array.prototype.forEach.call(el.querySelectorAll("h4"), function (h) { h.setAttribute("aria-level", String(opcoes.nivelTitulo + 1)); });
      }
      if (chave) {
        var alvoFoco = Array.prototype.filter.call(el.querySelectorAll("button"), function (b) { return b.dataset[chave[0]] === chave[1]; })[0];
        if (alvoFoco) alvoFoco.focus({ preventScroll: true });
      }
      if (res) {
        Object.keys(estado.abertas).forEach(function (k) {
          var b = el.querySelector('[data-uau-linha="' + k + '"]');
          if (b) { b.setAttribute("aria-expanded", estado.abertas[k] ? "true" : "false"); var m = el.querySelector("#" + b.getAttribute("aria-controls")); if (m) m.hidden = !estado.abertas[k]; }
        });
      }
    }
    function escanear() {
      clearTimeout(timer);
      estado.lido = true; estado.lendo = !movimentoReduzido; estado.abertas = {};
      desenhar();
      if (estado.lendo) timer = setTimeout(function () { estado.lendo = false; desenhar(); if (opcoes.aoLer) opcoes.aoLer(sim()); }, 1100);
      else if (opcoes.aoLer) opcoes.aoLer(sim());
    }

    function clique(e) {
      var b = e.target.closest ? e.target.closest("button") : null;
      if (!b || !el.contains(b)) return;
      if (b.dataset.uauProd) { estado.prod = b.dataset.uauProd; estado.versao = "atual"; escanear(); }
      else if (b.dataset.uauVer) { estado.versao = b.dataset.uauVer; estado.abertas = {}; desenhar(); }
      else if (b.dataset.uauPessoa) {
        var id = b.dataset.uauPessoa, i = estado.ids.indexOf(id);
        if (i >= 0) estado.ids.splice(i, 1); else estado.ids.push(id);
        estado.ids = D.PERFIS.map(function (x) { return x.id; }).filter(function (x) { return estado.ids.indexOf(x) >= 0; });
        estado.abertas = {}; desenhar();
      } else if (b.dataset.uauLinha != null) {
        var k = b.dataset.uauLinha, aberto = b.getAttribute("aria-expanded") === "true";
        estado.abertas[k] = !aberto;
        b.setAttribute("aria-expanded", String(!aberto));
        var mais = el.querySelector("#" + b.getAttribute("aria-controls")); if (mais) mais.hidden = aberto;
      }
    }
    el.addEventListener("click", clique);
    desenhar();
    var inicio = setTimeout(escanear, opcoes.atraso == null ? 450 : opcoes.atraso);
    return {
      escanear: escanear,
      estado: function () { return JSON.parse(JSON.stringify({ prod: estado.prod, versao: estado.versao, ids: estado.ids, lido: estado.lido, lendo: estado.lendo })); },
      destruir: function () { morto = true; clearTimeout(timer); clearTimeout(inicio); el.removeEventListener("click", clique); el.innerHTML = ""; el.classList.remove("uau-sim", "largo"); el.removeAttribute("data-ligado"); }
    };
  }

  return Object.freeze({
    esc: esc, hoje: hoje, ICONES_TOM: ICONES_TOM, ICONES_PROD: ICONES_PROD, ICONES_MODO: ICONES_MODO, RODAPE: RODAPE,
    chipTom: chipTom, avatar: avatar, destacar: destacar, pacoteHtml: pacoteHtml, casaHtml: casaHtml, mudancasHtml: mudancasHtml, tituloCasa: tituloCasa,
    linhaHtml: linhaHtml, alternarLinha: alternarLinha, montarSimulador: montarSimulador
  });
});
