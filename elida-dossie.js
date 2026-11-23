/* Elida · Relatório de Dúvidas e Consumo (para levar à nutricionista).
   Monta um documento HTML a partir de dados que já estão neste aparelho. A pessoa escolhe o que entra
   e decide se imprime, salva ou compartilha. O app NUNCA envia este relatório sozinho.
   Não é laudo, não é prescrição e não diz que nenhum produto é seguro. Não validado clinicamente. */
(function (raiz, fabrica) {
  "use strict";
  var api = fabrica(
    typeof module === "object" && module.exports ? require("./elida-demo.js") : raiz.ElidaDemo,
    typeof module === "object" && module.exports ? require("./elida-radar.js") : raiz.ElidaRadar,
    typeof module === "object" && module.exports ? require("./elida-uau.js") : raiz.ElidaUau
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ElidaDossie = api;
})(typeof self !== "undefined" ? self : this, function (D, R, U) {
  "use strict";
  var esc = U.esc;
  var VERSAO = "dossie-2026.11.22";
  var SECOES = ["perfis", "mudancas", "rotulos", "duvidas", "dieta", "lista"];
  var NOMES = {
    perfis: "Pessoas e nível de cuidado", mudancas: "Rótulos que mudaram", rotulos: "Rótulos conferidos e resultado de cada pessoa",
    duvidas: "Dúvidas para a consulta", dieta: "Orientação e lista da dieta", lista: "Itens da lista de compras"
  };
  var TAG = { risco: "risco", atencao: "atencao", ok: "ok", falta: "falta", neutro: "falta" };
  var DIETA_TXT = { evitar: "Evitar (nome na lista da dieta)", conferido: "Rótulo lido por alguém da casa", insuficiente: "Só pelo nome não dá para saber", nao_alimento: "Não é alimento", desligada: "Dieta desligada" };

  function incluirPadrao() { var o = {}; SECOES.forEach(function (s) { o[s] = true; }); return o; }
  function tag(tom) { return '<span class="tag ' + esc(TAG[tom] || "falta") + '">' + esc(D.ROTULO_TOM[tom] || tom) + '</span>'; }
  function lista(itens) { return '<ul>' + itens.map(function (i) { return '<li>' + i + '</li>'; }).join("") + '</ul>'; }
  function vazio(txt) { return '<p class="meta">' + esc(txt) + '</p>'; }
  function dataBr(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }

  function secaoPerfis(ctx) {
    var ps = ctx.perfis || [], IA = ctx.IA;
    if (!ps.length) return vazio("Nenhum perfil cadastrado.");
    return lista(ps.map(function (p) {
      var n = D.nivelPerfil(p);
      var rs = p.restricoes.map(function (r) { return esc((IA && IA.RESTRICOES[r.tipo] ? IA.RESTRICOES[r.tipo].nome : r.tipo) + " (" + ((IA && IA.SITUACOES[r.situacao]) || r.situacao).toLowerCase() + ")"); }).join("; ");
      return '<b>' + esc(p.apelido) + '</b>' + (p.faixaEtaria && IA && IA.FAIXAS[p.faixaEtaria] ? ' · ' + esc(IA.FAIXAS[p.faixaEtaria]) : '') + ' — ' + rs + ' <span class="meta">(' + esc(n.rotulo) + ')</span>';
    })) + '<p class="meta">Só apelidos: o relatório não leva nome completo nem documento.</p>';
  }
  function secaoMudancas(ctx) {
    var al = R.alertasMudanca(ctx.conferencias || [], ctx.perfis || [], { hoje: ctx.hoje });
    if (!al.length) return vazio("Nenhuma mudança de fórmula encontrada entre os rótulos conferidos.");
    return lista(al.map(function (a) {
      var quem = a.cmp.impactos.filter(function (i) { return i.relevante; }).map(function (i) { return esc(i.perfil.apelido) + ' ' + tag(i.para); }).join(" ");
      return '<b>' + esc(a.produto) + '</b> — rótulos de ' + esc(dataBr(a.de)) + ' e ' + esc(dataBr(a.para)) + '.<br>' + esc(R.manchete(a.cmp.diferenca)) + '.' + (quem ? '<br>Pessoas afetadas: ' + quem : '');
    }));
  }
  function secaoRotulos(ctx) {
    var confs = (ctx.conferencias || []).slice(0, 12), ps = ctx.perfis || [];
    if (!confs.length) return vazio("Nenhum rótulo conferido neste aparelho.");
    return lista(confs.map(function (c) {
      var casa = ps.length ? D.analisarCasa(ps, c.rotulo, { hoje: ctx.hoje }) : null;
      var f = c.fonte && c.fonte.identificacao ? ' <span class="meta">Fonte: ' + esc(c.fonte.identificacao) + '</span>' : '';
      var nome = c.produto || (c.rotulo && c.rotulo.nome) || "Produto", dieta = "";
      /* Plano alimentar: só avisa quando o nome do produto bate com algo que a dieta manda evitar. */
      if (ctx.dieta && ctx.dieta.ativa && typeof ctx.dietaDe === "function") { try { if (ctx.dietaDe(nome) === "evitar") dieta = ' <span class="tag risco">Plano alimentar: evitar</span>'; } catch (e) {} }
      return '<b>' + esc(nome) + '</b> — conferido em ' + esc(dataBr(c.quando)) + '.' + dieta + f +
        (casa ? '<br>' + casa.linhas.map(function (l) { return esc(l.perfil.apelido) + ' ' + tag(l.tom); }).join(" ") : '');
    })) + '<p class="meta">"Nada encontrado" quer dizer que o motor não achou nada nos dados conferidos. Não significa que o produto seja seguro nem aprovado.</p>';
  }
  function secaoDuvidas(ctx) {
    var ds = ctx.duvidas || [];
    if (!ds.length) return vazio("Nenhuma dúvida anotada.");
    return lista(ds.map(function (d) {
      return '<b>' + esc(d.item) + '</b>' + (d.motivo ? ' <span class="meta">(' + esc(d.motivo) + ')</span>' : '') + '<br>' + esc(d.pergunta) +
        (d.resposta ? '<br><i>Combinado:</i> ' + esc(d.resposta) : '<br><i>Combinado:</i> ______________________________');
    }));
  }
  function secaoDieta(ctx) {
    var d = ctx.dieta;
    if (!d || (!d.ativa && !(d.evitar || []).length && !d.modelo)) return vazio("Nenhuma dieta cadastrada no app.");
    var linhas = [];
    linhas.push('<p><b>' + esc(d.nome || "Dieta") + '</b> ' + (d.ativa ? "(ligada)" : "(desligada)") + (d.revisao ? ' · revisão com o profissional em ' + esc(dataBr(d.revisao)) : '') + '</p>');
    if (d.obs) linhas.push('<p><b>Orientação anotada:</b> ' + esc(d.obs) + '</p>');
    if ((d.evitar || []).length) linhas.push('<p><b>Evitar (termos digitados):</b> ' + esc(d.evitar.join(", ")) + '</p>');
    if ((d.cuidados || []).length) linhas.push('<p><b>Cuidados:</b> ' + esc(d.cuidados.join(", ")) + '</p>');
    if (d.modelo) linhas.push('<p class="meta">Usa a lista base "' + esc(d.modelo) + '", ainda pendente de revisão por profissional de saúde.</p>');
    return linhas.join("");
  }
  function secaoLista(ctx) {
    var it = ctx.itensLista || [];
    if (!it.length) return vazio("A lista de compras está vazia.");
    return lista(it.slice(0, 60).map(function (i) { return esc(i.nome) + (i.estado ? ' <span class="meta">— ' + esc(DIETA_TXT[i.estado] || i.estado) + '</span>' : ''); }));
  }
  var CORPO = { perfis: secaoPerfis, mudancas: secaoMudancas, rotulos: secaoRotulos, duvidas: secaoDuvidas, dieta: secaoDieta, lista: secaoLista };

  /* ctx: { hoje, perfis, conferencias, duvidas, dieta, itensLista, incluir, IA, motor:{versaoMotor,versaoPolitica} } */
  function dossieHtml(ctx) {
    ctx = ctx || {};
    var hoje = ctx.hoje || U.hoje(), inc = ctx.incluir || incluirPadrao();
    var motor = ctx.motor || {};
    var h = '<article class="dossie" aria-label="Relatório de dúvidas e consumo"><h1>Relatório de dúvidas e consumo</h1>' +
      '<p class="meta">Gerado em ' + esc(dataBr(hoje)) + ' pelo Elida, neste aparelho. Para conversar com a nutricionista.</p>' +
      '<p class="aviso"><b>O que este relatório é:</b> um resumo organizado do que a família conferiu e perguntou. <b>O que não é:</b> laudo, prescrição ou garantia de que um produto é seguro. As avaliações vêm de regras do app que ainda não foram validadas clinicamente. A decisão é do profissional.</p>';
    var incluidas = 0;
    SECOES.forEach(function (s) {
      if (!inc[s]) return;
      incluidas++;
      h += '<h2>' + esc(NOMES[s]) + '</h2>' + CORPO[s](ctx);
    });
    if (!incluidas) h += '<p class="meta">Nenhuma seção escolhida.</p>';
    h += '<h2>Para a nutricionista</h2><p>Observações e decisões: ______________________________________________</p><p>__________________________________________________________________</p>' +
      '<p class="meta">Motor de regras ' + esc(motor.versaoMotor || "") + ' · política ' + esc(motor.versaoPolitica || "") + ' · relatório ' + esc(VERSAO) + '</p></article>';
    return h;
  }

  /* Documento HTML completo (para baixar e abrir sem o app). Estilos embutidos, sem script. */
  var CSS_DOC = "body{font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif;color:#14231c;max-width:760px;margin:24px auto;padding:0 16px}" +
    "h1{font:600 26px/1.15 Georgia,serif;margin:0 0 4px}h2{font:600 18px/1.2 Georgia,serif;margin:20px 0 6px;border-bottom:1px solid #d7ded6;padding-bottom:4px}" +
    "p{margin:0 0 6px}ul{margin:0;padding-left:18px}li{margin:0 0 6px}.meta{color:#4d5f55;font-size:12.5px}" +
    ".aviso{background:#f4f1e6;border-left:4px solid #b8892b;padding:8px 10px;border-radius:4px;font-size:13px;margin:10px 0}" +
    ".tag{display:inline-block;font-size:11.5px;font-weight:700;border-radius:99px;padding:1px 8px;border:1px solid #b6c2b9}" +
    ".tag.risco{background:#FBE3DF;color:#7F1B12;border-color:#e8b5ad}.tag.atencao{background:#FFF0D1;color:#5E4100;border-color:#e6cd8f}" +
    ".tag.ok{background:#E1F1E7;color:#115236;border-color:#a9d3bb}.tag.falta{background:#EBEDE9;color:#3E4741;border-color:#c5ccc7}@page{margin:16mm}";
  function dossieDocumento(ctx) {
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Relatório de dúvidas e consumo · Elida</title><style>' + CSS_DOC + '</style></head><body>' + dossieHtml(ctx) + '</body></html>';
  }
  function nomeArquivo(hoje) { return "elida-relatorio-" + String(hoje || U.hoje()) + ".html"; }

  /* Exemplo fictício, para a tela de clínicas: mostra como o relatório fica, sem dados de ninguém. */
  function exemplo(hoje, IA) {
    var demo = R.demoFamilia(hoje, IA);
    return dossieHtml({
      hoje: hoje, perfis: demo.perfis, conferencias: demo.conferencias.slice().reverse(), IA: IA,
      duvidas: [{ item: "Biscoito recheado (exemplo)", motivo: "Fiquei em dúvida com o rótulo", pergunta: "O rótulo novo traz soro de leite e aviso de amendoim. O que devemos conferir antes da próxima compra?", resposta: "" }],
      dieta: { ativa: true, nome: "Plano de exemplo", evitar: ["leite", "glúten"], cuidados: [], obs: "Exemplo fictício, sem orientação real.", revisao: "" },
      itensLista: [{ nome: "Pão de forma integral", estado: "insuficiente" }, { nome: "Achocolatado em pó", estado: "insuficiente" }],
      motor: IA ? { versaoMotor: IA.VERSAO_MOTOR, versaoPolitica: IA.VERSAO_POLITICA } : {}
    });
  }

  return Object.freeze({ VERSAO: VERSAO, SECOES: SECOES, NOMES: NOMES, incluirPadrao: incluirPadrao, dossieHtml: dossieHtml, dossieDocumento: dossieDocumento, nomeArquivo: nomeArquivo, exemplo: exemplo });
});
