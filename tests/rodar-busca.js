/* Elida IA · Marco 2: contrato de busca e provedor fictício (determinístico, sem rede).
   Uso: node tests/rodar-busca.js */
"use strict";
var assert = require("node:assert/strict");
var path = require("path");
var B = require(path.join(__dirname, "..", "elida-busca.js"));
var R = require(path.join(__dirname, "..", "elida-regras.js"));
var E = R.ESTADOS, HOJE = "2026-11-19";
var ok = 0, falhas = [], fila = [];
function t(nome, fn) { fila.push([nome, fn]); }
function perfil() { return { id: "perfil_teste", apelido: "Teste", restricoes: [].slice.call(arguments).map(function (tipo) { return { tipo: tipo, situacao: "confirmada" }; }) }; }
var busca = B.criarBusca({ provedor: B.provedorFicticio() });
function primeiro(q) { return B.consultar(busca, q).then(function (r) { assert.equal(r.status, "ok", q + " deveria achar"); return r.produtos[0]; }); }
function avaliar(q, p) { return primeiro(q).then(function (prod) { return R.analisar(p, B.rotuloParaRegras(prod), { hoje: HOJE }); }); }

/* Contrato */
t("GTIN: aceita dígito verificador certo e recusa errado", function () {
  assert.ok(B.gtinValido("7891000100103")); assert.ok(B.gtinValido("2000000000015"));
  assert.ok(!B.gtinValido("7891000100104")); assert.ok(!B.gtinValido("123")); assert.ok(!B.gtinValido("abcdefghijklm"));
});
t("todo produto do catálogo cumpre o contrato e é marcado como fictício", function () {
  B._catalogo().forEach(function (p) { var v = B.validarProduto(p); assert.ok(v.ok, p.id + " " + v.erros); assert.equal(p.fonte.ficticio, true); assert.ok(/teste/i.test(p.nome)); });
});
t("produto fora do contrato é descartado com aviso", function () {
  var ruim = { nome: "x", porNome: function () { return Promise.resolve([{ id: "a", nome: "Sem fonte" }]); }, porCodigo: function () { return Promise.resolve([]); } };
  return B.criarBusca({ provedor: ruim }).porNome("sem fonte").then(function (r) { assert.equal(r.status, "nao_encontrado"); assert.match(r.avisos.join(" "), /descartado/); });
});
t("resposta traz versão do contrato e a consulta", function () { return busca.porNome("bolo").then(function (r) { assert.equal(r.versaoContrato, 1); assert.deepEqual(r.consulta, { tipo: "nome", valor: "bolo" }); }); });

/* Busca por nome e código */
t("busca por nome ignora acento e maiúscula", function () { return busca.porNome("PÃO DE FORMA").then(function (r) { assert.equal(r.produtos[0].id, "t-pao"); }); });
t("busca por nome com várias palavras exige todas", function () { return busca.porNome("biscoito arroz").then(function (r) { assert.deepEqual(r.produtos.map(function (p) { return p.id; }), ["t-antigo"]); }); });
t("busca por código acha o produto exato", function () { return busca.porCodigo("2000000000053").then(function (r) { assert.equal(r.produtos[0].id, "t-iogurte"); }); });
t("consultar entende número como código de barras", function () { return B.consultar(busca, "2000000000022").then(function (r) { assert.equal(r.consulta.tipo, "codigo"); assert.equal(r.produtos[0].id, "t-bolo"); }); });
t("código com dígito errado é inválido e não consulta", function () { var chamou = 0, p = B.provedorFicticio(), orig = p.porCodigo; p.porCodigo = function (c) { chamou++; return orig(c); };
  return B.criarBusca({ provedor: p }).porCodigo("2000000000016").then(function (r) { assert.equal(r.status, "invalido"); assert.equal(chamou, 0); }); });
t("nome curto demais é inválido", function () { return busca.porNome("a").then(function (r) { assert.equal(r.status, "invalido"); }); });
t("nada encontrado", function () { return busca.porNome("caviar").then(function (r) { assert.equal(r.status, "nao_encontrado"); assert.equal(r.produtos.length, 0); }); });
t("mesma busca dá sempre o mesmo resultado", function () { return Promise.all([busca.porNome("teste"), busca.porNome("teste")]).then(function (rs) { assert.deepEqual(rs[0], rs[1]); assert.equal(rs[0].produtos.length, 10); }); });
t("resultado é cópia: mexer nele não altera o catálogo", function () { return busca.porCodigo("2000000000015").then(function (r) { r.produtos[0].rotulo.ingredientes.push("leite"); return busca.porCodigo("2000000000015"); }).then(function (r) { assert.ok(r.produtos[0].rotulo.ingredientes.indexOf("leite") < 0); }); });
t("dados fictícios vêm com aviso", function () { return busca.porNome("bolo").then(function (r) { assert.match(r.avisos[0], /fictícios/); }); });

/* Falhas e produção */
t("fonte fora do ar vira indisponível, não erro", function () { return B.criarBusca({ provedor: B.provedorIndisponivel("503") }).porNome("bolo").then(function (r) { assert.equal(r.status, "indisponivel"); assert.match(r.avisos[0], /embalagem/); }); });
t("fonte lenta estoura o tempo limite", function () { var lento = { nome: "lento", porNome: function () { return new Promise(function () {}); }, porCodigo: function () { return new Promise(function () {}); } };
  return B.criarBusca({ provedor: lento, tempoLimiteMs: 30 }).porNome("bolo").then(function (r) { assert.equal(r.status, "indisponivel"); assert.match(r.avisos[0], /tempo/); }); });
t("produção nunca usa dados fictícios", function () { var b = B.criarBusca({ provedor: B.provedorFicticio(), producao: true }); assert.equal(b.fornecedor, null);
  return b.porNome("bolo").then(function (r) { assert.equal(r.status, "indisponivel"); assert.equal(r.produtos.length, 0); }); });
t("foto: só contrato, responde não implementado", function () { return busca.porFoto().then(function (r) { assert.equal(r.status, "nao_implementado"); assert.match(r.avisos[0], /confirme/); }); });

/* Regras aplicadas aos resultados (perfil ativo) */
t("APLV: bolo com leite é incompatível", function () { return avaliar("bolo", perfil("aplv")).then(function (a) { assert.equal(a.status, E.INCOMPATIVEL); }); });
t("APLV: pão com pode conter leite", function () { return avaliar("pão de forma", perfil("aplv")).then(function (a) { assert.equal(a.status, E.CONTAMINACAO); }); });
t("APLV: iogurte zero lactose continua incompatível", function () { return avaliar("iogurte", perfil("aplv")).then(function (a) { assert.equal(a.status, E.INCOMPATIVEL); }); });
t("lactose: iogurte zero lactose sem nada identificado", function () { return avaliar("iogurte", perfil("lactose")).then(function (a) { assert.equal(a.status, E.NAO_IDENTIFICADO); }); });
t("APLV: chocolate com manteiga de cacau e pode conter leite", function () { return avaliar("chocolate meio amargo", perfil("aplv")).then(function (a) { assert.equal(a.status, E.CONTAMINACAO); }); });
t("celíaca: granola com aveia é incompatível", function () { return avaliar("granola", perfil("celiaca")).then(function (a) { assert.equal(a.status, E.INCOMPATIVEL); }); });
t("celíaca e APLV: polvilho sem nada identificado nas duas", function () { return avaliar("polvilho", perfil("aplv", "celiaca")).then(function (a) { assert.equal(a.status, E.NAO_IDENTIFICADO); assert.equal(a.detalhes.length, 2); }); });
t("fórmula infantil pede orientação profissional", function () { return avaliar("fórmula", perfil("aplv")).then(function (a) { assert.equal(a.status, E.PROFISSIONAL); }); });
t("ficha antiga: informação insuficiente", function () { return avaliar("ficha antiga", perfil("aplv")).then(function (a) { assert.equal(a.status, E.INSUFICIENTE); }); });
t("rótulo incompleto: informação insuficiente", function () { return avaliar("salgadinho", perfil("alergia_ovo")).then(function (a) { assert.equal(a.status, E.INSUFICIENTE); }); });
t("trocar o perfil muda o resultado do mesmo produto", function () {
  return primeiro("pão de forma").then(function (p) {
    var r1 = R.analisar(perfil("aplv"), B.rotuloParaRegras(p), { hoje: HOJE }), r2 = R.analisar(perfil("alergia_soja"), B.rotuloParaRegras(p), { hoje: HOJE });
    assert.equal(r1.status, E.CONTAMINACAO); assert.equal(r2.status, E.INCOMPATIVEL);
  });
});
t("a fonte do produto chega ao motor com provedor e data", function () { return primeiro("bolo").then(function (p) { var r = B.rotuloParaRegras(p); assert.match(r.fonte.identificacao, /Catálogo fictício/); assert.equal(r.fonte.dataVerificacao, "2026-11-10"); }); });
t("nenhum resultado do catálogo diz seguro", function () {
  return busca.porNome("teste").then(function (r) {
    ["aplv", "lactose", "celiaca", "alergia_trigo", "alergia_ovo", "alergia_soja", "alergia_amendoim", "controle_glicose"].forEach(function (tipo) {
      r.produtos.forEach(function (p) { var s = JSON.stringify(R.analisar(perfil(tipo), B.rotuloParaRegras(p), { hoje: HOJE })).toLowerCase(); assert.ok(s.indexOf("seguro para") < 0 && s.indexOf('"seguro"') < 0); });
    });
  });
});

(function roda(i) {
  if (i >= fila.length) { console.log("Elida IA · busca: " + ok + " testes passaram, " + falhas.length + " falharam."); falhas.forEach(function (f) { console.log("FALHA " + f); }); process.exit(falhas.length ? 1 : 0); }
  var nome = fila[i][0];
  Promise.resolve().then(fila[i][1]).then(function () { ok++; }, function (e) { falhas.push(nome + ": " + String(e && e.message || e).split("\n")[0]); }).then(function () { roda(i + 1); });
})(0);
