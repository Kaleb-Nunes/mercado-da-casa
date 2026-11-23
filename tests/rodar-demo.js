/* Elida IA · camada de apresentação: simulação, veredito da casa, Radar de mudança de fórmula e relatório.
   Cobre o que a diretoria vai ver na demonstração e o que não pode quebrar:
   - nunca "seguro" como conclusão; verde = "nada encontrado nos dados conferidos";
   - gravidade por pessoa (alergia / intolerância / preferência) sem mexer no motor de regras;
   - alertas só entre versões diferentes do mesmo produto, na ordem certa;
   - tudo que vem do usuário sai escapado em HTML;
   - nenhum módulo novo tem rede, armazenamento ou eval;
   - dados de demonstração só existem em homologação.
   Uso: node tests/rodar-demo.js */
"use strict";
var assert = require("node:assert/strict");
var path = require("path"), fs = require("fs");
var RAIZ = path.join(__dirname, "..");
var IA = require(path.join(RAIZ, "elida-regras.js"));
var D = require(path.join(RAIZ, "elida-demo.js"));
var U = require(path.join(RAIZ, "elida-uau.js"));
var R = require(path.join(RAIZ, "elida-radar.js"));
var S = require(path.join(RAIZ, "elida-dossie.js"));
var HOJE = "2026-11-22";
var ok = 0, falhas = [];
function t(nome, fn) { try { fn(); ok++; } catch (e) { falhas.push(nome + ": " + String(e.message).split("\n")[0]); } }
function texto(html) { return String(html).replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " "); }
function produto(id) { return D.produtos(HOJE).filter(function (p) { return p.id === id; })[0]; }
function casa(id, versao) { return D.analisarCasa(D.PERFIS, produto(id)[versao], { hoje: HOJE }); }
function porNome(c, nome) { return c.linhas.filter(function (l) { return l.perfil.apelido === nome; })[0]; }

/* ---------- Gravidade por pessoa ---------- */
t("demo: quatro perfis com gravidades diferentes", function () {
  var niveis = D.PERFIS.map(function (p) { return D.nivelPerfil(p).chave; }).sort();
  assert.equal(D.PERFIS.length, 4);
  assert.deepEqual(niveis, ["alergia", "alergia", "intolerancia", "preferencia"]);
  D.PERFIS.forEach(function (p) { assert.equal(IA.validarPerfil(p).ok, true, p.apelido); assert.ok(/^demo-/.test(p.id)); });
});
t("demo: preferência nunca vira alerta vermelho", function () {
  ["biscoito", "pao", "achocolatado"].forEach(function (id) { ["anterior", "atual"].forEach(function (v) {
    var l = porNome(casa(id, v), "Caio");
    assert.ok(l.tom === "neutro" || l.tom === "ok", id + " " + v + " → " + l.tom);
  }); });
});
t("demo: alergia com termo encontrado é 'evitar'; intolerância sem declaração pede dados", function () {
  var c = casa("biscoito", "atual");
  assert.equal(porNome(c, "Vovó Vera").tom, "risco");
  assert.equal(porNome(c, "Théo").tom, "risco");
  var p = casa("pao", "atual");
  assert.equal(porNome(p, "Ana").tom, "falta");
});
t("demo: a fórmula nova do biscoito piora três pessoas (leite, amendoim, trigo)", function () {
  var antes = casa("biscoito", "anterior"), agora = casa("biscoito", "atual");
  assert.equal(antes.contagem.risco, 1);
  assert.equal(agora.contagem.risco, 3);
  assert.equal(porNome(antes, "Ana").tom, "ok");
});
t("demo: casa ordenada do mais grave ao menos grave", function () {
  var c = casa("pao", "atual"), ordem = D.ORDEM_TOM;
  for (var i = 1; i < c.linhas.length; i++) assert.ok(ordem.indexOf(c.linhas[i - 1].tom) <= ordem.indexOf(c.linhas[i].tom));
  assert.equal(c.geral, "risco");
});
t("demo: casa vazia não quebra e não afirma nada", function () {
  var c = D.analisarCasa([], produto("pao").atual, { hoje: HOJE });
  assert.equal(c.linhas.length, 0);
  assert.match(c.resumo, /Escolha quem vai comer/);
});
t("demo: analisar a casa não altera perfis nem rótulo", function () {
  var perfis = JSON.parse(JSON.stringify(D.PERFIS)), rot = JSON.parse(JSON.stringify(produto("biscoito").atual));
  var p2 = JSON.parse(JSON.stringify(perfis)), r2 = JSON.parse(JSON.stringify(rot));
  D.analisarCasa(perfis, rot, { hoje: HOJE });
  assert.deepEqual(perfis, p2); assert.deepEqual(rot, r2);
});
t("demo: cada pessoa recebe evidência do mesmo rótulo e o motor registra versão", function () {
  var c = casa("biscoito", "atual");
  c.linhas.forEach(function (l) { assert.ok(l.analise.versaoMotor && l.analise.versaoPolitica); });
  assert.ok(c.evidencia);
});

/* ---------- Nunca "seguro" ---------- */
t("rótulos dos tons nunca dizem 'seguro'", function () {
  Object.keys(D.ROTULO_TOM).forEach(function (k) { assert.ok(!/seguro|liberado|aprovado|pode comer/i.test(D.ROTULO_TOM[k]), k); });
  assert.equal(D.ROTULO_TOM.ok, "Nada encontrado");
});
function so_negado(html, onde) {
  texto(html).split(/(?<=[.!?])\s+/).forEach(function (s) {
    if (/\b(seguro|segura|seguros)\b/i.test(s)) assert.ok(/\b(n[ãa]o|nunca|sem)\b/i.test(s), onde + ': "seguro" fora de uma negação → ' + s);
  });
}
t("nenhuma tela ou relatório gera 'seguro' como conclusão", function () {
  var demo = R.demoFamilia(HOJE, IA);
  so_negado(R.radarHtml({ perfis: demo.perfis, conferencias: demo.conferencias, hoje: HOJE, homologacao: true, temDemo: true }), "radar");
  so_negado(R.radarHtml({ perfis: [], conferencias: [], hoje: HOJE }), "radar vazio");
  so_negado(R.familiaHtml({ perfis: demo.perfis, hoje: HOJE, IA: IA }), "família");
  so_negado(S.exemplo(HOJE, IA), "relatório de exemplo");
  ["biscoito", "pao", "achocolatado"].forEach(function (id) {
    so_negado(U.casaHtml(casa(id, "atual"), { prefixo: "t" }), "casa " + id);
    var cmp = D.comparar(D.PERFIS, produto(id).anterior, produto(id).atual, { hoje: HOJE });
    so_negado(U.mudancasHtml(cmp), "mudanças " + id);
  });
});
t("rodapé deixa claro que o app não valida clinicamente", function () {
  assert.match(U.RODAPE, /nunca diz que um produto é seguro/);
  assert.match(U.RODAPE, /Confira sempre a embalagem/);
});
t("o tom verde sempre vem com ícone e texto (cor nunca é a única pista)", function () {
  ["risco", "atencao", "falta", "neutro", "ok"].forEach(function (tom) {
    var h = U.chipTom(tom, D.ROTULO_TOM[tom]);
    assert.ok(/<svg/.test(h), tom + " sem ícone"); assert.ok(texto(h).trim().length > 2, tom + " sem texto");
  });
});

/* ---------- Nomes disfarçados ---------- */
t("nomes disfarçados: caseinato, soro de leite, malte e traços são explicados", function () {
  /* a tela explica o termo que o motor achou, não o texto inteiro do ingrediente */
  ["caseinato de sódio", "soro de leite em pó", "extrato de malte", "contém glúten", "pode conter ovo"].forEach(function (texto) {
    var e = D.explicar(D.termoPrincipal(texto)); assert.ok(e && String(e).length > 20, texto);
  });
  var d = D.disfarcados(D.diferenca(produto("biscoito").anterior, produto("biscoito").atual));
  assert.ok(d.length >= 1, "o biscoito novo tem pelo menos um nome disfarçado");
});
t("simulador: devolve casa e comparação do produto escolhido", function () {
  ["biscoito", "pao", "achocolatado"].forEach(function (id) {
    var s = D.simular({ produtoId: id, hoje: HOJE });
    assert.equal(s.produto.id, id); assert.ok(s.casa.linhas.length === 4); assert.ok(s.comparacao.diferenca.mudou);
  });
});
t("simulador: perfil desligado sai do veredito", function () {
  var s = D.simular({ produtoId: "biscoito", hoje: HOJE, perfilIds: ["demo-ana"] });
  assert.equal(s.casa.linhas.length, 1);
});

/* ---------- Radar de mudança de fórmula ---------- */
t("radar: alertas só para produtos com duas versões diferentes, mais grave primeiro", function () {
  var demo = R.demoFamilia(HOJE, IA), al = R.alertasMudanca(demo.conferencias, demo.perfis, { hoje: HOJE });
  assert.equal(al.length, 3);
  var peso = { risco: 0, atencao: 1, falta: 2, neutro: 3, ok: 4 };
  for (var i = 1; i < al.length; i++) assert.ok(peso[al[i - 1].tom] <= peso[al[i].tom]);
  assert.equal(al[al.length - 1].produto, "Pão de forma integral");
});
t("radar: rótulo repetido sem mudança não gera alerta", function () {
  var demo = R.demoFamilia(HOJE, IA);
  var c = demo.conferencias.filter(function (x) { return /biscoito-atual/.test(x.id); })[0];
  var copia = JSON.parse(JSON.stringify(c)); copia.id = "demo-copia"; copia.quando = "2026-11-23T10:00:00.000Z";
  assert.equal(R.alertasMudanca([copia, c], demo.perfis, { hoje: HOJE }).length, 0);
});
t("radar: um produto só, uma versão só ou sem perfis não gera alerta nem erro", function () {
  var demo = R.demoFamilia(HOJE, IA);
  assert.deepEqual(R.alertasMudanca([demo.conferencias[1]], demo.perfis, { hoje: HOJE }), []);
  assert.deepEqual(R.alertasMudanca(demo.conferencias, [], { hoje: HOJE }), []);
  assert.deepEqual(R.alertasMudanca(null, demo.perfis, { hoje: HOJE }), []);
  assert.deepEqual(R.alertasMudanca([], demo.perfis, { hoje: HOJE }), []);
});
t("radar: só afeta quem acompanha o que mudou (Caio, preferência, não vira alerta de risco)", function () {
  var demo = R.demoFamilia(HOJE, IA), al = R.alertasMudanca(demo.conferencias, demo.perfis, { hoje: HOJE });
  var bisc = al.filter(function (a) { return /Biscoito/.test(a.produto); })[0];
  var pioraram = bisc.cmp.impactos.filter(function (i) { return i.piorou; }).map(function (i) { return i.perfil.apelido; }).sort();
  assert.deepEqual(pioraram, ["Ana", "Théo"]);
});
t("radar: pergunta para a consulta cabe em 340 caracteres e cita o que mudou", function () {
  var demo = R.demoFamilia(HOJE, IA);
  R.alertasMudanca(demo.conferencias, demo.perfis, { hoje: HOJE }).forEach(function (a) {
    var q = R.perguntaConsulta(a); assert.ok(q.length <= 340, q.length); assert.ok(q.indexOf(a.produto) === 0);
  });
});
t("radar: tela vazia, sem confs e com alertas mostram o que cada estado precisa", function () {
  var demo = R.demoFamilia(HOJE, IA);
  assert.match(texto(R.radarHtml({ perfis: [], conferencias: [], hoje: HOJE })), /Nenhuma pessoa na casa ainda/);
  assert.match(texto(R.radarHtml({ perfis: demo.perfis, conferencias: [], hoje: HOJE })), /Confira a primeira embalagem/);
  var com = R.radarHtml({ perfis: demo.perfis, conferencias: demo.conferencias, hoje: HOJE });
  assert.match(texto(com), /3 alertas/); assert.match(com, /data-act="radar-ver"/); assert.match(com, /data-act="radar-consulta"/);
});
t("radar: três formas de conferir e os quatro atalhos existem", function () {
  var h = R.radarHtml({ perfis: [], conferencias: [], hoje: HOJE });
  ["codigo", "foto", "busca"].forEach(function (m) { assert.ok(h.indexOf('data-act="scan" data-modo="' + m + '"') > 0, m); });
  ["prateleira", "comparar-proprios", "consulta", "dossie"].forEach(function (a) { assert.ok(h.indexOf('data-act="' + a + '"') > 0, a); });
});
t("radar: botão de demonstração só aparece em homologação", function () {
  assert.ok(!/demo-familia|demo-remover/.test(R.radarHtml({ perfis: [], conferencias: [], hoje: HOJE, homologacao: false })));
  assert.ok(/demo-familia/.test(R.radarHtml({ perfis: [], conferencias: [], hoje: HOJE, homologacao: true })));
});
t("radar: veredito da casa só aparece com duas ou mais pessoas", function () {
  var um = [D.PERFIS[0]], rot = produto("biscoito").atual;
  assert.equal(R.casaBlocoHtml(um, rot, HOJE), ""); assert.equal(R.casaChipsHtml(um, rot, HOJE), "");
  assert.ok(R.casaBlocoHtml(D.PERFIS, rot, HOJE).length > 100); assert.ok(R.casaChipsHtml(D.PERFIS, rot, HOJE).length > 100);
});
t("dados de demonstração têm prefixo demo- e são reconhecidos", function () {
  var demo = R.demoFamilia(HOJE, IA);
  assert.ok(demo.perfis.every(R.ehDemo) && demo.conferencias.every(R.ehDemo));
  assert.equal(R.ehDemo({ id: "perfil_real_1" }), false); assert.equal(R.ehDemo(null), false);
  demo.conferencias.forEach(function (c) { assert.match(c.rotulo.fonte.identificacao, /fictício/i); });
});

/* ---------- HTML escapado ---------- */
var VENENO = '<img src=x onerror=alert(1)>"><script>alert(2)</script>';
function limpo(html, onde) {
  assert.ok(!/<img\s+src=x/i.test(html), onde + ": <img> cru"); assert.ok(!/<script>alert/i.test(html), onde + ": <script> cru");
  assert.ok(!/\sonerror=/i.test(html.replace(/&lt;[^]*?&gt;/g, "")), onde + ": atributo de evento cru");
}
t("XSS: apelido, produto e termos vindos do usuário saem escapados em todas as telas", function () {
  var perfis = [{ id: "perfil_x_1", apelido: VENENO, faixaEtaria: "adulto", restricoes: [{ tipo: "aplv", situacao: "confirmada" }] },
    { id: "perfil_x_2", apelido: "Outra", faixaEtaria: "adulto", restricoes: [{ tipo: "alergia_amendoim", situacao: "confirmada" }] }];
  var ant = { nome: VENENO, ean: null, categoria: "alimento", ingredientes: ["farinha de arroz"], ingredientesCompletos: true, advertencias: { contem: [], podeConter: [] }, advertenciasCompletas: true, declaracaoGluten: "nao_contem", fonte: { identificacao: "teste", dataVerificacao: HOJE } };
  var atu = JSON.parse(JSON.stringify(ant)); atu.ingredientes = ["farinha de arroz", "soro de leite", VENENO]; atu.advertencias = { contem: ["leite", VENENO], podeConter: [] };
  var confs = [{ id: "c2", quando: "2026-11-22T10:00:00.000Z", produto: VENENO, ean: null, rotulo: atu }, { id: "c1", quando: "2026-11-10T10:00:00.000Z", produto: VENENO, ean: null, rotulo: ant }];
  var radar = R.radarHtml({ perfis: perfis, conferencias: confs, hoje: HOJE, homologacao: true });
  limpo(radar, "radar"); assert.match(radar, /radar-alerta/);
  limpo(R.familiaHtml({ perfis: perfis, hoje: HOJE, IA: IA }), "família");
  var al = R.alertasMudanca(confs, perfis, { hoje: HOJE });
  limpo(R.alertaDetalheHtml(al[0]), "detalhe"); limpo(R.casaBlocoHtml(perfis, atu, HOJE), "bloco"); limpo(R.casaChipsHtml(perfis, atu, HOJE), "chips");
  limpo(S.dossieHtml({ hoje: HOJE, perfis: perfis, conferencias: confs, IA: IA, duvidas: [{ item: VENENO, motivo: VENENO, pergunta: VENENO, resposta: VENENO }], dieta: { ativa: true, nome: VENENO, evitar: [VENENO], cuidados: [VENENO], obs: VENENO }, itensLista: [{ nome: VENENO, estado: VENENO }] }), "relatório");
  limpo(S.dossieDocumento({ hoje: HOJE, perfis: perfis, conferencias: confs, IA: IA }), "documento");
});

/* ---------- Relatório de dúvidas e consumo ---------- */
t("relatório: avisa que não é laudo e traz as versões do motor e da política", function () {
  var h = texto(S.dossieHtml({ hoje: HOJE, motor: { versaoMotor: "m-x", versaoPolitica: "p-y" } }));
  assert.match(h, /laudo, prescrição ou garantia/); assert.match(h, /não foram validadas clinicamente/);
  assert.match(h, /m-x/); assert.match(h, /p-y/); assert.match(h, /Para a nutricionista/);
});
t("relatório: cada seção pode ser desligada e todas ligadas por padrão", function () {
  var padrao = S.incluirPadrao(); assert.deepEqual(Object.keys(padrao), S.SECOES); S.SECOES.forEach(function (s) { assert.equal(padrao[s], true); });
  var demo = R.demoFamilia(HOJE, IA);
  var ctx = { hoje: HOJE, perfis: demo.perfis, conferencias: demo.conferencias, IA: IA, duvidas: [{ item: "x", pergunta: "y" }], dieta: { ativa: true, nome: "Plano", evitar: ["leite"] }, itensLista: [{ nome: "Pão", estado: "insuficiente" }] };
  var tudo = texto(S.dossieHtml(ctx));
  S.SECOES.forEach(function (s) {
    assert.ok(tudo.indexOf(S.NOMES[s]) >= 0, "seção ausente: " + s);
    var inc = S.incluirPadrao(); inc[s] = false; ctx.incluir = inc;
    assert.ok(texto(S.dossieHtml(ctx)).indexOf(S.NOMES[s]) < 0, "seção não saiu: " + s);
  });
  ctx.incluir = {}; assert.match(texto(S.dossieHtml(ctx)), /Nenhuma seção escolhida/);
});
t("relatório: plano alimentar marca o produto a evitar e um erro no plano não derruba o relatório", function () {
  var demo = R.demoFamilia(HOJE, IA), base = { hoje: HOJE, perfis: demo.perfis, conferencias: demo.conferencias, IA: IA, dieta: { ativa: true, nome: "Plano" } };
  var com = texto(S.dossieHtml(Object.assign({}, base, { dietaDe: function (n) { return /Biscoito/.test(n) ? "evitar" : "insuficiente"; } })));
  assert.equal((com.match(/Plano alimentar: evitar/g) || []).length, 2, "uma marca por conferência do biscoito");
  var sem = texto(S.dossieHtml(Object.assign({}, base, { dieta: { ativa: false }, dietaDe: function () { return "evitar"; } })));
  assert.ok(sem.indexOf("Plano alimentar: evitar") < 0, "dieta desligada não marca");
  var erro = S.dossieHtml(Object.assign({}, base, { dietaDe: function () { throw new Error("falhou"); } }));
  assert.ok(erro.indexOf("Biscoito recheado") > 0);
});
t("relatório: documento baixado é HTML autônomo, sem script e sem recurso externo", function () {
  var d = S.dossieDocumento({ hoje: HOJE }), baixo = d.toLowerCase();
  assert.match(d, /^<!doctype html>/i); assert.ok(baixo.indexOf("<script") < 0); assert.ok(!/(src|href)=["']?https?:/.test(baixo)); assert.ok(baixo.indexOf("<link") < 0);
  assert.equal(S.nomeArquivo(HOJE), "elida-relatorio-2026-11-22.html");
});
t("relatório: exemplo é fictício e não contém dados reais", function () {
  var h = texto(S.exemplo(HOJE, IA));
  assert.match(h, /exemplo/i); assert.match(h, /fictíci/i);
});

/* ---------- Arquitetura e privacidade ---------- */
["elida-demo.js", "elida-uau.js", "elida-radar.js", "elida-dossie.js"].forEach(function (f) {
  t("módulo " + f + ": sem rede, sem armazenamento, sem eval, sem HTML de terceiros", function () {
    var c = fs.readFileSync(path.join(RAIZ, f), "utf8");
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|importScripts|EventSource/.test(c), "rede");
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(c), "armazenamento");
    assert.ok(!/\beval\s*\(|new Function|document\.write|\.innerHTML\s*=\s*[a-z]+\s*\+\s*location/.test(c), "execução dinâmica");
    assert.ok(!/https?:\/\//.test(c.replace(/\/\*[^]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")), "URL embutida");
  });
});
t("app: demonstração só carrega em homologação e perfis reais nunca são apagados por ela", function () {
  var c = fs.readFileSync(path.join(RAIZ, "elida-app.js"), "utf8");
  assert.ok(/function demoFamiliaCarregar\(\)\{\s*if\(!AMB\.homologacao\) return;/.test(c));
  assert.ok(/filter\(function\(p\)\{ return !R\.ehDemo\(p\); \}\)\.concat\(dm\.perfis\)/.test(c), "só troca perfis demo");
  assert.ok(/filter\(function\(p\)\{ return !R\.ehDemo\(p\); \}\);\s*if\(!perfisEstado\.perfis\.some/.test(c), "remover só tira perfis demo");
});
t("index.html: CSP continua sem script inline e os módulos novos estão no cache offline", function () {
  var h = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8"), sw = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(h), "script inline");
  assert.ok(!/\son(click|load|error|submit)=/i.test(h), "atributo de evento inline");
  ["elida-demo.js", "elida-uau.js", "elida-radar.js", "elida-dossie.js", "elida-uau.css"].forEach(function (f) { assert.ok(sw.indexOf("./" + f) >= 0, f + " fora do cache offline"); assert.ok(h.indexOf(f) >= 0, f + " fora do index.html"); });
});

console.log("Elida · demonstração, Radar e relatório: " + ok + " testes passaram, " + falhas.length + " falharam.");
falhas.forEach(function (f) { console.log("FALHA " + f); });
process.exit(falhas.length ? 1 : 0);
