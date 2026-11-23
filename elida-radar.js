/* Elida · Radar de mudança de fórmula e telas "Radar" e "Família".
   Só monta HTML e faz contas sobre dados que já estão neste aparelho (perfis e rótulos conferidos).
   Quem decide o estado de cada pessoa é o motor (elida-regras.js), via elida-demo.js.
   O Radar NÃO vigia o mercado: ele compara versões de embalagens que a família já conferiu aqui.
   Nada é enviado a lugar nenhum. Verde quer dizer "nada encontrado nos dados conferidos", nunca "seguro". */
(function (raiz, fabrica) {
  "use strict";
  var api = fabrica(
    typeof module === "object" && module.exports ? require("./elida-demo.js") : raiz.ElidaDemo,
    typeof module === "object" && module.exports ? require("./elida-uau.js") : raiz.ElidaUau
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ElidaRadar = api;
})(typeof self !== "undefined" ? self : this, function (D, U) {
  "use strict";
  var esc = U.esc;
  var VERSAO = "radar-2026.11.22";
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

  /* ---------- Datas ---------- */
  function dataCurta(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? m[3] + "/" + m[2] : "";
  }
  function dataLonga(hoje) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(hoje || ""));
    if (!m) return "";
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return DIAS[d.getUTCDay()] + ", " + (+m[3]) + " de " + MESES[+m[2] - 1];
  }
  function diasAtras(hoje, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(hoje || ""));
    var d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- Alertas de mudança ---------- */
  function chaveProduto(c) {
    var ean = c && c.ean ? String(c.ean).replace(/\D/g, "") : "";
    return ean ? "ean:" + ean : "nome:" + D.normalizar((c && (c.produto || (c.rotulo && c.rotulo.nome))) || "");
  }
  /* Agrupa as conferências por produto (mais recente primeiro). Duas conferências do mesmo rótulo já foram
     fundidas pelo app (mesma evidência), então o que sobra são versões diferentes. */
  function agrupar(confs) {
    var grupos = {}, ordem = [];
    (Array.isArray(confs) ? confs : []).forEach(function (c) {
      if (!c || !c.rotulo || typeof c.rotulo !== "object") return;
      var k = chaveProduto(c);
      if (!/:.+/.test(k)) return;
      if (!grupos[k]) { grupos[k] = []; ordem.push(k); }
      grupos[k].push(c);
    });
    ordem.forEach(function (k) { grupos[k].sort(function (a, b) { return String(b.quando || "") < String(a.quando || "") ? -1 : String(b.quando || "") > String(a.quando || "") ? 1 : 0; }); });
    return { grupos: grupos, ordem: ordem };
  }
  function tomDoAlerta(cmp) {
    var pioras = cmp.impactos.filter(function (i) { return i.piorou; }).map(function (i) { return i.para; });
    if (pioras.length) return D.piorTom(pioras);
    return cmp.relevante ? "atencao" : "neutro";
  }
  /* Para cada produto com pelo menos duas versões conferidas, compara a mais nova com a anterior para a casa inteira. */
  function alertasMudanca(confs, perfis, opcoes) {
    opcoes = opcoes || {};
    if (!Array.isArray(perfis) || !perfis.length) return [];
    var ag = agrupar(confs), saida = [];
    ag.ordem.forEach(function (k) {
      var g = ag.grupos[k];
      if (g.length < 2) return;
      var atual = g[0], anterior = g[1], cmp;
      try { cmp = D.comparar(perfis, anterior.rotulo, atual.rotulo, { hoje: opcoes.hoje }); } catch (e) { return; }
      if (!cmp.diferenca.mudou) return;
      saida.push({ chave: k, id: atual.id, produto: atual.produto || atual.rotulo.nome || "Produto", de: anterior.quando, para: atual.quando, cmp: cmp, tom: tomDoAlerta(cmp), versoes: g.length });
    });
    var peso = { risco: 0, atencao: 1, falta: 2, neutro: 3, ok: 4 };
    function pioraram(a) { return a.cmp.impactos.filter(function (i) { return i.piorou; }).length; }
    saida.sort(function (a, b) {
      return (peso[a.tom] - peso[b.tom]) || (pioraram(b) - pioraram(a)) || (String(b.para) < String(a.para) ? -1 : String(b.para) > String(a.para) ? 1 : 0);
    });
    return saida;
  }

  function manchete(diff) {
    var p = [];
    if (diff.ingredientesNovos.length) p.push("Entrou nos ingredientes: " + diff.ingredientesNovos.slice(0, 2).join(", "));
    if (diff.contemNovos.length) p.push('Novo aviso "contém": ' + diff.contemNovos.slice(0, 2).join(", "));
    if (diff.podeConterNovos.length) p.push('Novo aviso "pode conter": ' + diff.podeConterNovos.slice(0, 2).join(", "));
    if (!p.length && (diff.ingredientesRetirados.length || diff.contemRetirados.length || diff.podeConterRetirados.length)) p.push("Saiu algo da lista ou dos avisos");
    return p.join(" · ");
  }
  function quemAfeta(cmp) {
    var itens = cmp.impactos.filter(function (i) { return i.relevante; });
    if (!itens.length) return '<p class="quando">Nenhuma pessoa da casa acompanha o que mudou.</p>';
    return '<div class="radar-quem">' + itens.map(function (i) {
      return U.chipTom(i.para, i.perfil.apelido + (i.piorou ? ": passou a " + D.ROTULO_TOM[i.para] : ": " + D.ROTULO_TOM[i.para]));
    }).join("") + '</div>';
  }
  function alertaHtml(a) {
    var titulo = a.tom === "risco" ? "A fórmula mudou e pede cuidado" : a.tom === "atencao" ? "A fórmula mudou: confira" : "A fórmula mudou";
    return '<article class="radar-alerta" data-tom="' + esc(a.tom) + '" aria-label="' + esc(a.produto + ": " + titulo) + '"><div class="radar-alerta-corpo">' +
      '<h4>' + esc(a.produto) + '</h4>' +
      '<p class="quando">' + esc(titulo) + ' · entre os rótulos de ' + esc(dataCurta(a.de)) + ' e ' + esc(dataCurta(a.para)) + '</p>' +
      '<p class="mudou">' + esc(manchete(a.cmp.diferenca)) + '</p>' + quemAfeta(a.cmp) + '</div>' +
      '<div class="radar-alerta-acoes"><button type="button" data-act="radar-ver" data-id="' + esc(a.id) + '">Ver o que mudou</button>' +
      '<button type="button" data-act="radar-consulta" data-id="' + esc(a.id) + '">Levar à consulta</button></div></article>';
  }
  /* Conteúdo completo de um alerta (folha de detalhe). */
  function alertaDetalheHtml(a) {
    return U.casaHtml(a.cmp.agora, { prefixo: "rd", abrirPrimeira: false }) + U.mudancasHtml(a.cmp) + '<p class="uau-rodape">' + esc(U.RODAPE) + '</p>';
  }
  /* Pergunta pronta para a consulta, com o que mudou e quem é afetado. Não envia nada. */
  function perguntaConsulta(a) {
    var d = a.cmp.diferenca, itens = [];
    if (d.ingredientesNovos.length) itens.push("entrou nos ingredientes: " + d.ingredientesNovos.join(", "));
    if (d.contemNovos.length) itens.push('novo aviso "contém": ' + d.contemNovos.join(", "));
    if (d.podeConterNovos.length) itens.push('novo aviso "pode conter": ' + d.podeConterNovos.join(", "));
    var q = a.cmp.impactos.filter(function (i) { return i.relevante; }).map(function (i) { return i.perfil.apelido; });
    var t = a.produto + ": " + (itens.join("; ") || "o rótulo mudou") + "." + (q.length ? " Isso afeta: " + q.join(", ") + "." : "") + " O que devemos conferir antes da próxima compra?";
    return t.length > 340 ? t.slice(0, 339) + "…" : t;
  }

  /* ---------- Veredito da casa para um rótulo ---------- */
  function casaDoRotulo(perfis, rot, hoje) {
    return D.analisarCasa(perfis || [], rot, { hoje: hoje });
  }
  /* Bloco de tela com o veredito de cada pessoa. Só faz sentido com 2 ou mais perfis. */
  function casaBlocoHtml(perfis, rot, hoje, prefixo) {
    if (!Array.isArray(perfis) || perfis.length < 2 || !rot) return "";
    var casa = casaDoRotulo(perfis, rot, hoje);
    return '<section class="uau-sim" aria-label="Veredito da casa">' + U.casaHtml(casa, { prefixo: prefixo || "cb", abrirPrimeira: false }) + '</section>';
  }

  /* Uma linha de chips com o resultado de cada pessoa, para listas de produtos. Só com 2 ou mais perfis. */
  function casaChipsHtml(perfis, rot, hoje) {
    if (!Array.isArray(perfis) || perfis.length < 2 || !rot) return "";
    var casa = casaDoRotulo(perfis, rot, hoje);
    return '<div class="radar-quem" aria-label="Resultado de cada pessoa da casa">' + casa.linhas.map(function (l) { return U.chipTom(l.tom, l.perfil.apelido + ": " + D.ROTULO_TOM[l.tom]); }).join("") + '</div>';
  }

  /* ---------- Radar (início do app) ---------- */
  function pessoasHtml(perfis) {
    return '<ul class="radar-casa" aria-label="Pessoas da casa">' + perfis.map(function (p) {
      var n = D.nivelPerfil(p);
      return '<li><button type="button" class="radar-pessoa" data-act="nav" data-view="perfis">' + U.avatar(p, "neutro", false) +
        '<b>' + esc(p.apelido) + '</b><small>' + esc(n.rotulo) + '</small></button></li>';
    }).join("") + '</ul>';
  }
  function recentesHtml(confs, perfis, hoje) {
    var vistos = {}, lista = [];
    confs.forEach(function (c) {
      var k = chaveProduto(c);
      if (!c || !c.rotulo || vistos[k] || lista.length >= 4) return;
      vistos[k] = 1; lista.push(c);
    });
    if (!lista.length) return "";
    return '<section class="radar-sec"><div class="radar-sec-topo"><h3>Conferidos por aqui</h3><span>' + confs.length + (confs.length === 1 ? " rótulo" : " rótulos") + '</span></div>' +
      '<ul class="rows card" style="list-style:none;margin:0;padding:0">' + lista.map(function (c) {
        var casa = perfis.length ? casaDoRotulo(perfis, c.rotulo, hoje) : null;
        return '<li><button type="button" class="row" data-act="reanalisar" data-id="' + esc(c.id) + '"><span class="r-main"><span class="r-name">' + esc(c.produto || c.rotulo.nome || "Produto") +
          '</span><span class="r-meta">Conferido em ' + esc(dataCurta(c.quando)) + '</span></span>' + (casa ? U.chipTom(casa.geral, D.ROTULO_TOM[casa.geral]) : "") + '</button></li>';
      }).join("") + '</ul></section>';
  }
  function radarHtml(ctx) {
    var perfis = ctx.perfis || [], confs = ctx.conferencias || [], hoje = ctx.hoje || U.hoje();
    var alertas = alertasMudanca(confs, perfis, { hoje: hoje });
    var h = '<header class="radar-topo"><p>' + esc(dataLonga(hoje)) + '</p><h2>Radar da casa</h2>' +
      '<p>' + (perfis.length ? 'O que mudou nas embalagens que sua família já conferiu.' : 'Comece pela sua família: o Elida confere cada embalagem para cada pessoa.') + '</p></header>';
    h += '<section class="radar-scan" aria-labelledby="radar-scan-t"><h3 id="radar-scan-t">Conferir uma embalagem</h3><p>Leia o rótulo e veja o resultado de cada pessoa da casa.</p>' +
      '<div class="radar-modos"><button type="button" data-act="scan" data-modo="codigo">' + U.ICONES_MODO.codigo + 'Código de barras</button>' +
      '<button type="button" data-act="scan" data-modo="foto">' + U.ICONES_MODO.foto + 'Foto do rótulo</button>' +
      '<button type="button" data-act="scan" data-modo="busca">' + U.ICONES_MODO.busca + 'Buscar produto</button></div></section>';
    if (perfis.length) {
      h += '<section class="radar-sec"><div class="radar-sec-topo"><h3>Sua casa</h3><span>' + perfis.length + (perfis.length === 1 ? " pessoa" : " pessoas") + '</span></div>' + pessoasHtml(perfis) + '</section>';
    }
    h += '<section class="radar-sec"><div class="radar-sec-topo"><h3>Mudou na prateleira</h3>' + (alertas.length ? '<span>' + alertas.length + (alertas.length === 1 ? " alerta" : " alertas") + '</span>' : "") + '</div>';
    if (alertas.length) h += alertas.map(alertaHtml).join("");
    else if (!perfis.length) {
      h += '<div class="radar-vazio"><h3>Nenhuma pessoa na casa ainda</h3><p>Crie um perfil para cada pessoa com restrição. Dá para marcar alergia confirmada, intolerância, suspeita ou só uma preferência.</p>' +
        '<div class="acoes"><button type="button" class="bigbtn" data-act="novo-perfil">Criar o primeiro perfil</button><button type="button" class="btn-sm" data-act="radar-sim">Ver a simulação</button>' +
        (ctx.homologacao ? '<button type="button" class="btn-sm" data-act="demo-familia">Carregar família de demonstração</button>' : '') + '</div></div>';
    } else if (!confs.length) {
      h += '<div class="radar-vazio"><h3>Confira a primeira embalagem</h3><p>Quando você conferir de novo o mesmo produto e a fórmula tiver mudado, o Radar mostra aqui o que entrou e quem da casa é afetado.</p>' +
        '<div class="acoes"><button type="button" class="bigbtn" data-act="scan" data-modo="foto">Conferir uma embalagem</button><button type="button" class="btn-sm" data-act="radar-sim">Ver a simulação</button>' +
        (ctx.homologacao ? '<button type="button" class="btn-sm" data-act="demo-familia">Carregar exemplo fictício</button>' : '') + '</div></div>';
    } else {
      h += '<div class="radar-vazio"><h3>Nenhuma mudança nos rótulos conferidos</h3><p>O Radar compara só as embalagens que você conferiu aqui, versão contra versão. Ele não acompanha o mercado por conta própria.</p>' +
        '<div class="acoes"><button type="button" class="btn-sm" data-act="radar-sim">Ver a simulação</button></div></div>';
    }
    h += '</section>';
    h += recentesHtml(confs, perfis, hoje);
    h += '<div class="radar-atalhos"><button type="button" data-act="prateleira">Minha prateleira<small>Guardar o rótulo de hoje</small></button>' +
      '<button type="button" data-act="comparar-proprios">Comparar dois rótulos<small>O que mudou entre duas embalagens</small></button>' +
      '<button type="button" data-act="consulta">Levar à consulta<small>Dúvidas para a nutricionista</small></button>' +
      '<button type="button" data-act="dossie">Relatório<small>Dúvidas e consumo, para imprimir</small></button></div>';
    h += '<p class="uau-rodape">' + esc(U.RODAPE) + ' Perfis e rótulos ficam só neste aparelho.</p>';
    if (ctx.homologacao && ctx.temDemo) h += '<p class="uau-rodape">Homologação: há dados de demonstração fictícios carregados. <button type="button" class="link" data-act="demo-remover">Remover</button></p>';
    return h;
  }

  /* ---------- Família ---------- */
  var SIT_CURTA = { confirmada: "confirmada", suspeita: "suspeita", orientacao_profissional: "orientação profissional", preferencia: "preferência" };
  function restricaoTexto(r, IA) {
    var nome = IA && IA.RESTRICOES && IA.RESTRICOES[r.tipo] ? IA.RESTRICOES[r.tipo].nome : r.tipo;
    return nome + " (" + (SIT_CURTA[r.situacao] || r.situacao) + ")";
  }
  var EXPLICA_NIVEL = {
    alergia: "Alergia ou doença: qualquer vestígio, inclusive o aviso de contaminação cruzada, conta como motivo para evitar.",
    intolerancia: "Intolerância ou suspeita: o app avisa o que encontrou e pede conferência da embalagem.",
    preferencia: "Preferência: o app informa, sem tratar como risco de saúde."
  };
  function familiaHtml(ctx) {
    var perfis = ctx.perfis || [], IA = ctx.IA, ativo = ctx.ativo, armed = ctx.armed;
    var h = '<div class="head-row"><div><h2 class="title">Família</h2><p class="sub">Uma pessoa por perfil, cada uma com seu nível de cuidado. O resultado da casa junta todos.</p></div>' +
      '<button class="btn-sm" type="button" data-act="novo-perfil">' + ctx.iconeMais + 'Novo</button></div>';
    if (!perfis.length) {
      return h + '<div class="radar-vazio"><h3>Nenhuma pessoa ainda</h3><p>Não precisa de diagnóstico: dá para marcar uma suspeita ou uma preferência.</p>' +
        '<div class="acoes"><button class="bigbtn" type="button" data-act="novo-perfil">Criar o primeiro perfil</button>' +
        (ctx.homologacao ? '<button type="button" class="btn-sm" data-act="demo-familia">Carregar família de demonstração</button>' : '') + '</div></div>';
    }
    var cont = { alergia: 0, intolerancia: 0, preferencia: 0 };
    perfis.forEach(function (p) { cont[D.nivelPerfil(p).chave]++; });
    h += '<section class="fam-casa" aria-label="Resumo da casa"><h3>' + perfis.length + (perfis.length === 1 ? " pessoa" : " pessoas") + ' na casa</h3><div class="fam-nivel">' +
      (cont.alergia ? '<span>' + cont.alergia + ' com alergia ou doença</span>' : '') +
      (cont.intolerancia ? '<span>' + cont.intolerancia + ' com intolerância ou suspeita</span>' : '') +
      (cont.preferencia ? '<span>' + cont.preferencia + ' com preferência</span>' : '') + '</div>' +
      '<p class="uau-rodape">Ao conferir uma embalagem, o app mostra o resultado de cada pessoa e o da casa, do mais sério ao mais leve.</p></section>';
    h += perfis.map(function (p) {
      var n = D.nivelPerfil(p);
      return '<article class="fam-card" data-nivel="' + esc(n.chave) + '">' + U.avatar(p, "neutro", false) +
        '<div><b>' + esc(p.apelido) + '</b>' + (p.faixaEtaria && IA && IA.FAIXAS[p.faixaEtaria] ? ' · ' + esc(IA.FAIXAS[p.faixaEtaria]) : '') +
        '<small>' + p.restricoes.map(function (r) { return esc(restricaoTexto(r, IA)); }).join(" · ") + '</small>' +
        '<small><b>' + esc(n.rotulo) + '.</b> ' + esc(EXPLICA_NIVEL[n.chave] || "") + '</small></div>' +
        '<div class="fam-acoes"><label class="ia-op"><input type="radio" name="perfil-ativo" value="' + esc(p.id) + '"' + (p.id === ativo ? ' checked' : '') + '> Perfil principal das buscas</label>' +
        '<span class="ia-acoes"><button class="link" type="button" data-act="editar-perfil" data-id="' + esc(p.id) + '">Editar<span class="sr"> ' + esc(p.apelido) + '</span></button>' +
        '<button class="link" type="button" data-act="excluir-perfil" data-id="' + esc(p.id) + '">' + (armed === "xp-" + p.id ? 'Toque de novo' : 'Excluir') + '<span class="sr"> ' + esc(p.apelido) + '</span></button></span></div></article>';
    }).join("");
    if (ctx.homologacao && ctx.temDemo) h += '<p class="uau-rodape">Homologação: parte destes perfis é demonstração fictícia. <button type="button" class="link" data-act="demo-remover">Remover demonstração</button></p>';
    h += '<p class="sub">' + (ctx.guardar ? 'Guardados só neste aparelho e no seu backup. Nada vai para a internet.' : 'Só nesta sessão: os perfis somem ao fechar o app. Para guardar, edite um perfil e marque "Guardar neste aparelho".') + '</p>' +
      '<div class="links"><button class="link" type="button" data-act="apagar-perfis">' + (armed === "apagar-perfis" ? 'Toque de novo para apagar todos' : 'Apagar todos os perfis') + '</button></div>' +
      '<p class="aviso-fixo" role="note">' + esc(U.RODAPE) + '</p>';
    return h;
  }

  /* ---------- Dados de demonstração (só homologação) ---------- */
  /* Perfis e rótulos fictícios, para a equipe ver o Radar funcionando. IDs começam com "demo-" para poder remover. */
  function demoFamilia(hoje, IA) {
    hoje = hoje || U.hoje();
    var antes = diasAtras(hoje, 12), perfis = D.PERFIS.map(function (p) { return JSON.parse(JSON.stringify(p)); }), confs = [];
    D.produtos(hoje).forEach(function (p, i) {
      [["anterior", antes], ["atual", hoje]].forEach(function (par) {
        var rot = JSON.parse(JSON.stringify(p[par[0]]));
        rot.fonte = { identificacao: "Rótulo de demonstração fictício", dataVerificacao: par[1] };
        var a = IA.analisar(perfis[0], rot, { hoje: hoje });
        confs.push({ id: "demo-" + p.id + "-" + par[0], quando: par[1] + "T12:0" + i + ":00.000Z", produto: p.nome, ean: null, rotulo: rot, fonte: a.fonte, evidencia: a.evidencia, versaoMotor: a.versaoMotor, versaoPolitica: a.versaoPolitica });
      });
    });
    return { perfis: perfis, conferencias: confs };
  }
  function ehDemo(x) { return !!x && typeof x.id === "string" && x.id.indexOf("demo-") === 0; }

  return Object.freeze({
    VERSAO: VERSAO, dataCurta: dataCurta, dataLonga: dataLonga, diasAtras: diasAtras, chaveProduto: chaveProduto, agrupar: agrupar,
    alertasMudanca: alertasMudanca, tomDoAlerta: tomDoAlerta, manchete: manchete, alertaHtml: alertaHtml, alertaDetalheHtml: alertaDetalheHtml,
    perguntaConsulta: perguntaConsulta, casaDoRotulo: casaDoRotulo, casaBlocoHtml: casaBlocoHtml, casaChipsHtml: casaChipsHtml, radarHtml: radarHtml, familiaHtml: familiaHtml,
    demoFamilia: demoFamilia, ehDemo: ehDemo
  });
});
