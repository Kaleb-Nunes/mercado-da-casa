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
t("resposta traz versão do contrato e a consulta", function () { return busca.porNome("bolo").then(function (r) { assert.equal(r.versaoContrato, 2); assert.deepEqual(r.consulta, { tipo: "nome", valor: "bolo" }); }); });

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
t("foto: não passa pela busca (leitura é local)", function () { return busca.porFoto().then(function (r) { assert.equal(r.status, "nao_implementado"); assert.match(r.avisos[0], /próprio aparelho/); }); });

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

/* ---------- Marco 3: Open Food Facts (rede simulada, sem chamada real) ---------- */
var fs = require("fs");
function fx(c) { return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "off", c + ".json"), "utf8")); }
function redeFalsa(rotas, log) {
  return function (url, opcoes) {
    log && log.push({ url: url, opcoes: opcoes });
    for (var i = 0; i < rotas.length; i++) if (rotas[i][0].test(url)) { var r = rotas[i][1](url); return Promise.resolve({ status: r.status || 200, ok: (r.status || 200) < 400, json: function () { return Promise.resolve(r.corpo); } }); }
    return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.resolve({ status: 0 }); } });
  };
}
var relogio = { t: Date.parse("2026-11-19T12:00:00Z") };
function off(rotas, log, extra) { return B.provedorOpenFoodFacts(Object.assign({ fetch: redeFalsa(rotas, log), agora: function () { return relogio.t; }, hoje: function () { return HOJE; }, appName: "Elida-teste", appVersion: "t" }, extra || {})); }
var ROTAS = [[/api\/v2\/product\/(\d+)/, function (u) { var c = u.match(/product\/(\d+)/)[1]; try { return { corpo: fx(c) }; } catch (e) { return { status: 404, corpo: { status: 0 } }; } }],
  [/search\.openfoodfacts\.org\/search/, function () { return { corpo: { hits: [{ code: "7898215151784", product_name: "Creme de Leite", brands: "Piracanjuba", quantity: "200 g" }, { code: "123", product_name: "inválido" }] } }; }]];

t("OFF: produto vem como rascunho, nunca completo", function () {
  return B.criarBusca({ provedor: off(ROTAS) }).porCodigo("7898215151784").then(function (r) {
    var p = r.produtos[0]; assert.equal(r.status, "ok"); assert.equal(p.rotulo.rascunho, true); assert.equal(p.rotulo.ingredientesCompletos, false); assert.equal(p.rotulo.advertenciasCompletas, false);
    assert.equal(p.fonte.rascunho, true); assert.match(p.fonte.licenca, /ODbL/); assert.match(r.avisos[0], /Rascunho do Open Food Facts/);
  });
});
t("OFF: dado sozinho nunca gera conclusão favorável (várias restrições)", function () {
  var bus = B.criarBusca({ provedor: off(ROTAS) });
  return Promise.all(["7898215151784", "7891962053189", "7896423419276", "7894904005482"].map(function (c) { return bus.porCodigo(c); })).then(function (rs) {
    rs.forEach(function (r) {
      var a = R.analisar(perfil("aplv", "celiaca", "lactose", "alergia_soja", "alergia_ovo", "alergia_trigo"), B.rotuloParaRegras(r.produtos[0]), { hoje: HOJE });
      assert.notEqual(a.status, E.NAO_IDENTIFICADO, r.consulta.valor);
      a.detalhes.forEach(function (d) { assert.notEqual(d.estado, E.NAO_IDENTIFICADO, r.consulta.valor + " " + d.restricao); });
      assert.equal(a.rascunho, true);
    });
  });
});
t("OFF: alergênico indicado pelo OFF só agrava (creme de leite = incompatível para APLV)", function () {
  return B.criarBusca({ provedor: off(ROTAS) }).porCodigo("7898215151784").then(function (r) { assert.equal(R.analisar(perfil("aplv"), B.rotuloParaRegras(r.produtos[0]), { hoje: HOJE }).status, E.INCOMPATIVEL); });
});
t("OFF: campo de ingredientes com lixo vira lista vazia", function () {
  return B.criarBusca({ provedor: off(ROTAS) }).porCodigo("7896423419276").then(function (r) { assert.deepEqual(r.produtos[0].rotulo.ingredientes, []); });
});
t("OFF: produto inexistente = não encontrado", function () {
  return B.criarBusca({ provedor: off(ROTAS) }).porCodigo("7891000100103").then(function (r) { assert.equal(r.status, "nao_encontrado"); });
});
t("OFF: só o código e a identificação do app saem; sem cookie, sem referrer, sem perfil", function () {
  var log = [];
  return B.criarBusca({ provedor: off(ROTAS, log) }).porCodigo("7898215151784").then(function () {
    assert.equal(log.length, 1); var u = log[0].url;
    assert.match(u, /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/7898215151784\.json\?fields=/); assert.match(u, /app_name=Elida-teste&app_version=t$/);
    assert.equal(log[0].opcoes.credentials, "omit"); assert.equal(log[0].opcoes.referrerPolicy, "no-referrer");
    assert.ok(!/aplv|celiac|perfil|restri/i.test(u));
  });
});
t("OFF: cache de 7 dias evita nova chamada", function () {
  var log = [], prov = off(ROTAS, log), bus = B.criarBusca({ provedor: prov });
  return bus.porCodigo("7898215151784").then(function () { return bus.porCodigo("7898215151784"); }).then(function () { assert.equal(log.length, 1); });
});
t("OFF: limite de 12 leituras por minuto (a 13ª não sai)", function () {
  var log = [], bus = B.criarBusca({ provedor: off(ROTAS, log) });
  var validos = []; for (var n = 0; validos.length < 13; n++) { var base = "7891000" + String(100000 + n).slice(1); for (var d = 0; d < 10; d++) if (B.gtinValido(base + d)) { validos.push(base + d); break; } }
  return validos.reduce(function (p, c) { return p.then(function (acc) { return bus.porCodigo(c).then(function (r) { acc.push(r); return acc; }); }); }, Promise.resolve([])).then(function (rs) {
    assert.equal(log.length, 12); assert.equal(rs[12].status, "indisponivel"); assert.match(rs[12].avisos.join(" "), /limite de consultas/);
  });
});
t("OFF: 429/503 bloqueia novas chamadas e o app avisa", function () {
  var log = [], bus = B.criarBusca({ provedor: off([[/product/, function () { return { status: 503, corpo: {} }; }]], log) });
  return bus.porCodigo("7898215151784").then(function (r) { assert.equal(r.status, "indisponivel"); assert.match(r.avisos.join(" "), /ocupado \(503\)/); return bus.porCodigo("7891962053189"); })
    .then(function (r) { assert.equal(log.length, 1, "não chama de novo durante a espera"); assert.match(r.avisos.join(" "), /limite de consultas; tente em \d+ s/); });
});
t("OFF: busca por nome devolve só sugestões, sem ingredientes, códigos válidos", function () {
  return B.criarBusca({ provedor: off(ROTAS) }).porNome("creme de leite").then(function (r) {
    assert.equal(r.produtos.length, 1); assert.equal(r.produtos[0].sugestao, true); assert.deepEqual(r.produtos[0].rotulo.ingredientes, []); assert.match(r.avisos[0], /confirme se é o mesmo produto, sabor e tamanho/);
  });
});
t("OFF: em produção fica desligado sem aprovação expressa", function () {
  var log = [], bus = B.criarBusca({ provedor: off(ROTAS, log), producao: true });
  return bus.porCodigo("7898215151784").then(function (r) { assert.equal(r.status, "indisponivel"); assert.equal(log.length, 0); assert.equal(bus.fornecedor, null); });
});
t("OFF: módulo só conhece os dois endereços do OFF", function () {
  var c = fs.readFileSync(path.join(__dirname, "..", "elida-busca.js"), "utf8"), urls = c.match(/https?:\/\/[^\s"')]+/g) || [];
  urls.forEach(function (u) { assert.ok(/^https:\/\/(world|search)\.openfoodfacts\.org\//.test(u), u); });
});

/* ---------- Código de barras sem dado na base e memória da casa (23/11/2026) ----------
   Caso real: Pão Sanduíche Trabulai, EAN 7896999099186. Embalagem fotografada em 23/11/2026:
   "ALÉRGICOS: CONTÉM DERIVADOS DE TRIGO E SOJA. PODE CONTER CASTANHA-DO-PARÁ, CENTEIO, CEVADA, AVEIA, OVO E LEITE. CONTÉM GLÚTEN".
   A ficha do OFF consultada no mesmo dia (fixture) não tinha ingredientes nem alérgicos. */
var OCR = require(path.join(__dirname, "..", "elida-ocr.js"));
var PAO_ING = "Farinha de trigo enriquecida com ferro e ácido fólico, açúcar, óleo vegetal, sal, conservador propionato de cálcio e emulsificantes: mono e diglicerídeos de ácidos graxos.";
var PAO_AVISOS = "ALÉRGICOS: CONTÉM DERIVADOS DE TRIGO E SOJA. PODE CONTER CASTANHA-DO-PARÁ, CENTEIO, CEVADA, AVEIA, OVO E LEITE. CONTÉM GLÚTEN";
function estado(perfilTeste, rot) { return R.analisar(perfilTeste, rot, { hoje: HOJE }).detalhes[0].estado; }
t("código real sem dado no OFF: cobertura vazia e nenhuma restrição sai favorável", function () {
  return B.criarBusca({ provedor: off(ROTAS) }).porCodigo("7896999099186").then(function (r) {
    var p = r.produtos[0];
    assert.equal(r.status, "ok"); assert.equal(p.nome, "Pão Sanduíche");
    assert.deepEqual(p.cobertura, { ingredientes: false, avisos: false, declaracoes: false });
    ["aplv", "lactose", "celiaca", "alergia_soja", "alergia_ovo"].forEach(function (tipo) { assert.equal(estado(perfil(tipo), B.rotuloParaRegras(p)), E.INSUFICIENTE, tipo); });
  });
});
t("bloco ALÉRGICOS colado nos ingredientes do OFF: 'pode conter leite' não vira ingrediente nem 'contém'", function () {
  var p = B._produtoOFF({ code: "7896999099186", product_name: "Pão Sanduíche", brands: "Trabulai", ingredients_text_pt: PAO_ING + " " + PAO_AVISOS, allergens_tags: [], traces_tags: [] }, HOJE, false);
  var rot = B.rotuloParaRegras(p);
  assert.ok(!rot.ingredientes.some(function (i) { return /leite|ovo|castanha/i.test(i); }), rot.ingredientes.join(" | "));
  assert.match(rot.advertencias.contem, /TRIGO E SOJA/); assert.match(rot.advertencias.podeConter, /OVO E LEITE/);
  assert.deepEqual(p.cobertura, { ingredientes: true, avisos: true, declaracoes: true });
  assert.equal(estado(perfil("aplv"), rot), E.CONTAMINACAO);
  assert.equal(estado(perfil("lactose"), rot), E.CONTAMINACAO);
  assert.equal(estado(perfil("alergia_ovo"), rot), E.CONTAMINACAO);
  assert.equal(estado(perfil("celiaca"), rot), E.INCOMPATIVEL);
  assert.equal(estado(perfil("alergia_soja"), rot), E.INCOMPATIVEL);
});
t("separarAvisos: '(contém lactose)' dentro do ingrediente e 'não contém glúten' não viram aviso", function () {
  var s = B.separarAvisos("Ingredientes: leite integral (contém lactose), açúcar, cacau. Não contém glúten.");
  assert.equal(s.contem, ""); assert.equal(s.podeConter, ""); assert.match(s.ingredientes, /^leite integral \(contém lactose\), açúcar, cacau$/);
  var s2 = B.separarAvisos("arroz, sal. Pode conter traços de leite e soja.");
  assert.equal(s2.ingredientes, "arroz, sal"); assert.match(s2.podeConter, /traços de leite e soja/); assert.equal(s2.contem, "");
});
t("tags do OFF e texto do OFF somam avisos, sem repetir em ingrediente", function () {
  var p = B._produtoOFF({ code: "7896999099186", product_name: "x", ingredients_text_pt: "arroz, sal. Contém soja.", allergens_tags: ["en:soybeans"], traces_tags: ["en:milk"] }, HOJE, false);
  assert.match(p.rotulo.advertencias.contem, /Open Food Facts indica: soja.*Texto cadastrado no OFF: Contém soja/);
  assert.match(p.rotulo.advertencias.podeConter, /traços de: leite/); assert.deepEqual(p.rotulo.ingredientes, ["arroz", "sal"]);
});
function conferenciaDoPao(quando, ean) {
  var lido = OCR.interpretar("INGREDIENTES: " + PAO_ING + " " + PAO_AVISOS, { hoje: HOJE });
  var c = OCR.confirmar(lido.rotulo, { nome: "Pão Sanduíche Trabulai" }, { textoConferido: true, ingredientesCompletos: true, advertenciasCompletas: true }, HOJE);
  assert.ok(c.ok); c.rotulo.ean = ean;
  return { id: "c-" + quando, quando: quando, produto: "Pão Sanduíche Trabulai", ean: ean, rotulo: c.rotulo };
}
t("memória da casa: depois da foto conferida, o código sozinho já avisa 'pode conter leite'", function () {
  var lista = [conferenciaDoPao("2026-11-19T10:00:00Z", "7896999099186")];
  var achado = B.conferidoPorCodigo(lista, "7896999099186");
  assert.ok(achado, "acha pelo código");
  assert.equal(estado(perfil("aplv"), achado.rotulo), E.CONTAMINACAO);
  assert.equal(estado(perfil("celiaca"), achado.rotulo), E.INCOMPATIVEL);
  assert.ok(!achado.rotulo.ingredientes.some(function (i) { return /leite/i.test(i); }), "leite fica em 'pode conter', não em ingrediente");
});
t("memória da casa: pega a conferência mais nova, ignora rascunho e outro código, aceita zero à esquerda", function () {
  var velha = conferenciaDoPao("2026-10-01T10:00:00Z", "7896999099186"), nova = conferenciaDoPao("2026-11-20T10:00:00Z", "07896999099186");
  var rasc = { id: "r", quando: "2026-11-22T10:00:00Z", ean: "7896999099186", rotulo: { rascunho: true, ingredientes: [] } };
  var outro = conferenciaDoPao("2026-11-23T10:00:00Z", "7891000100103");
  assert.equal(B.conferidoPorCodigo([velha, rasc, nova, outro], "7896999099186").id, nova.id);
  assert.equal(B.conferidoPorCodigo([velha, nova], "7891000100103"), null);
  assert.equal(B.conferidoPorCodigo(null, "7896999099186"), null);
  assert.equal(B.conferidoPorCodigo([rasc], "7896999099186"), null);
});

(function roda(i) {
  if (i >= fila.length) { console.log("Elida IA · busca: " + ok + " testes passaram, " + falhas.length + " falharam."); falhas.forEach(function (f) { console.log("FALHA " + f); }); process.exit(falhas.length ? 1 : 0); }
  var nome = fila[i][0];
  Promise.resolve().then(fila[i][1]).then(function () { ok++; }, function (e) { falhas.push(nome + ": " + String(e && e.message || e).split("\n")[0]); }).then(function () { roda(i + 1); });
})(0);
