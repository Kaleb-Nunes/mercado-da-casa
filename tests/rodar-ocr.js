/* Elida IA · Marco 3: interpretação do texto lido na foto (sem imagem, sem rede).
   Uso: node tests/rodar-ocr.js */
"use strict";
var assert = require("node:assert/strict");
var path = require("path");
var O = require(path.join(__dirname, "..", "elida-ocr.js"));
var R = require(path.join(__dirname, "..", "elida-regras.js"));
var E = R.ESTADOS, HOJE = "2026-11-19", INS = O.STATUS.INSUFICIENTE;
var ok = 0, falhas = [];
function t(nome, fn) { try { fn(); ok++; } catch (e) { falhas.push(nome + ": " + String(e.message).split("\n")[0]); } }
function perfil() { return { id: "perfil_teste", apelido: "Teste", restricoes: [].slice.call(arguments).map(function (tipo) { return { tipo: tipo, situacao: "confirmada" }; }) }; }
function ler(txt, conf) { return O.interpretar(txt, { confianca: conf == null ? 88 : conf, hoje: HOJE }); }
var TORRADA = "INGREDIENTES: FARINHA DE TRIGO ENRIQUECIDA COM FERRO E ÁCIDO FÓLICO, GORDURA VEGETAL, AÇÚCAR, SAL E EXTRATO DE MALTE.\nCONTÉM GLÚTEN. ALÉRGICOS: CONTÉM DERIVADOS DE CEVADA, SOJA E DE TRIGO. PODE CONTER: AMÊNDOAS,\nAMENDOIM, AVEIA, AVELÃS, CASTANHA-DE-\nCAJU, CENTEIO, GERGELIM, LEITE E OVOS.";
var BATATA = "Ingredientes: batata, óleo vegetal, sal, fécula de batata e\nantiumectante dióxido de silício.\nNÃO CONTÉM GLÚTEN.";

t("rótulo completo: lista, contém, pode conter e glúten", function () {
  var r = ler(TORRADA);
  assert.equal(r.status, "ok");
  assert.equal(r.rotulo.ingredientes.length, 4);
  assert.match(r.rotulo.advertencias.contem, /CEVADA, SOJA E DE TRIGO/);
  assert.match(r.rotulo.advertencias.podeConter, /LEITE E OVOS/);
  assert.match(r.rotulo.advertencias.podeConter, /CASTANHA-DE-CAJU/, "hífen no fim da linha cola a palavra");
  assert.equal(r.rotulo.declaracaoGluten, "contem");
});
t("sempre rascunho: nada completo antes da conferência", function () {
  var r = ler(TORRADA).rotulo;
  assert.equal(r.rascunho, true); assert.equal(r.ingredientesCompletos, false); assert.equal(r.advertenciasCompletas, false);
  assert.match(r.fonte.identificacao, /não conferida/); assert.equal(r.fonte.dataVerificacao, HOJE);
});
t("ruído comum do OCR: INGREDIBNTES, CONTEM sem acento, PODE : CONTER", function () {
  var r = ler("“TNGREDIBNTES: ACÚCAR, MASSA DE CACAU, LEITE EM PÓ. ALERGICOS: CONTEM LEITE E DERIVADOS DE SOJA. PODE\n: CONTER AMENDOIM E DERIVADOS DE TRIGO. conTÉM GLUTEN.");
  assert.equal(r.status, "ok"); assert.match(r.rotulo.advertencias.contem, /LEITE/); assert.match(r.rotulo.advertencias.podeConter, /AMENDOIM/); assert.equal(r.rotulo.declaracaoGluten, "contem");
});
t("abreviação INGR.: e leitura sem o I (NGR.:)", function () {
  assert.equal(ler("INGR.: ÁGUA GASEIFICADA, EXTRATO DE NOZ DE COLA, CAFEÍNA. NÃO CONTÉM GLÚTEN").status, "ok");
  assert.equal(ler("NGR.: AGUA GASEIFICADA, EXTRATO DE NOZ DE COLA, CAFEINA").status, "ok");
});
t("ingrediente único (Ingrediente: gelatina)", function () { var r = ler("INGREDIENTE: GELATINA.\nNÃO CONTÉM GLÚTEN."); assert.equal(r.status, "ok"); assert.deepEqual(r.rotulo.ingredientes, ["GELATINA"]); });
t("vírgula dentro de parênteses não separa ingrediente", function () {
  var r = ler("Ingredientes: milho, especiarias (cravo, pimenta-preta e cominho), sal. NÃO CONTÉM GLÚTEN.");
  assert.deepEqual(r.rotulo.ingredientes, ["milho", "especiarias (cravo, pimenta-preta e cominho)", "sal"]);
});
t("não contém glúten / contém lactose / sem lactose / contraditório", function () {
  assert.equal(ler(BATATA).rotulo.declaracaoGluten, "nao_contem");
  assert.equal(ler("Ingredientes: leite, açúcar. CONTÉM LACTOSE. NÃO CONTÉM GLÚTEN.").rotulo.declaracaoLactose, "contem_lactose");
  assert.equal(ler("Ingredientes: leite, lactase. ZERO LACTOSE.").rotulo.declaracaoLactose, "sem_lactose");
  assert.equal(ler("Ingredientes: aveia. CONTÉM GLÚTEN. NÃO CONTÉM GLÚTEN.").rotulo.declaracaoGluten, "contraditorio");
});
t("'contém glúten' e 'contém lactose' não viram advertência de alérgico", function () {
  assert.equal(ler("Ingredientes: leite, açúcar. CONTÉM LACTOSE. NÃO CONTÉM GLÚTEN.").rotulo.advertencias.contem, "");
});
t("ilegível (confiança baixa) = INFORMAÇÃO INSUFICIENTE", function () { var r = ler(TORRADA, 48); assert.equal(r.status, INS); assert.match(r.motivos[0], /pouco legível \(confiança 48%\)/); });
t("sem a palavra Ingredientes = INFORMAÇÃO INSUFICIENTE", function () { var r = ler("BISCOITOS DE ARROZ"); assert.equal(r.status, INS); assert.ok(r.motivos.some(function (m) { return /Ingredientes/.test(m); })); });
t("foto só do bloco de alérgicos = INFORMAÇÃO INSUFICIENTE", function () { assert.equal(ler("ALÉRGICOS: PODE CONTER SOJA. NÃO CONTÉM GLÚTEN").status, INS); });
t("foto vazia = INFORMAÇÃO INSUFICIENTE", function () { assert.equal(ler("", 0).status, INS); assert.equal(ler("ê", 90).status, INS); });
t("sem bloco de alérgicos nem glúten: avisa para conferir a embalagem", function () { var r = ler("Ingredientes: água, polpa de tomate, vinagre, açúcar."); assert.equal(r.status, "ok"); assert.match(r.avisos[0], /bloco ALÉRGICOS/); });
t("palavras com confiança baixa são listadas para revisão", function () {
  var r = O.interpretar(TORRADA, { confianca: 80, palavras: [{ texto: "FARINHA", confianca: 95 }, { texto: "NRIQUI", confianca: 41 }, { texto: "E", confianca: 10 }] });
  assert.deepEqual(r.palavrasDuvidosas, ["NRIQUI"]);
});
t("rascunho da foto nunca dá 'não identificado' (várias restrições)", function () {
  [TORRADA, BATATA, "Ingredientes: arroz, sal. ALÉRGICOS: NÃO CONTÉM. NÃO CONTÉM GLÚTEN. SEM LACTOSE."].forEach(function (txt) {
    var a = R.analisar(perfil("aplv", "celiaca", "lactose", "alergia_soja"), ler(txt).rotulo, { hoje: HOJE });
    a.detalhes.forEach(function (d) { assert.notEqual(d.estado, E.NAO_IDENTIFICADO, d.restricao); });
  });
});
t("confirmar exige conferir o texto", function () { var c = O.confirmar(ler(BATATA).rotulo, {}, { ingredientesCompletos: true, advertenciasCompletas: true }, HOJE); assert.equal(c.ok, false); assert.match(c.erros[0], /Confira o texto/); });
t("confirmar: texto corrigido pela pessoa vale, fonte vira 'conferida por você'", function () {
  var c = O.confirmar(ler(BATATA).rotulo, { nome: "Batata palha", ingredientes: "batata, óleo vegetal, sal", contem: "", podeConter: "PODE CONTER LEITE" }, { textoConferido: true, ingredientesCompletos: true, advertenciasCompletas: true }, HOJE);
  assert.equal(c.ok, true); assert.equal(c.rotulo.rascunho, false); assert.deepEqual(c.rotulo.ingredientes, ["batata", "óleo vegetal", "sal"]);
  assert.match(c.rotulo.fonte.identificacao, /conferida por você/);
  var a = R.analisar(perfil("celiaca", "aplv"), c.rotulo, { hoje: HOJE });
  assert.equal(a.status, E.CONTAMINACAO, "pode conter leite pesa mais que o 'não contém glúten'");
  assert.equal(a.detalhes[0].restricao, "aplv");
});
t("confirmar sem marcar 'completo' continua insuficiente", function () {
  var c = O.confirmar(ler(BATATA).rotulo, {}, { textoConferido: true }, HOJE);
  assert.equal(R.analisar(perfil("celiaca"), c.rotulo, { hoje: HOJE }).status, E.INSUFICIENTE);
});
t("confirmado e completo: celíaca com 'não contém glúten' = não identificado (nunca 'seguro')", function () {
  var c = O.confirmar(ler(BATATA).rotulo, {}, { textoConferido: true, ingredientesCompletos: true, advertenciasCompletas: true }, HOJE);
  var a = R.analisar(perfil("celiaca"), c.rotulo, { hoje: HOJE });
  assert.equal(a.status, E.NAO_IDENTIFICADO); assert.ok(!/seguro/i.test(a.texto.replace(/não garante que seja seguro/i, "")), a.texto);
});
t("módulo não tem rede nem envia imagem", function () {
  var c = require("fs").readFileSync(path.join(__dirname, "..", "elida-ocr.js"), "utf8");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//.test(c));
  assert.ok(/workerBlobURL: false/.test(c) && /\.\/vendor\/ocr\//.test(c), "leitor vem do próprio site");
});

t("foto com fragmentos como na captura do celular é recusada mesmo com média alta", function(){
  var r = ler("ea ·? Thabrula: INGREDIENTES: Farinha de trigo enriquecida com ter e ácido fólico e diglicerídeos de ácidos A. de = í ácido ascórbico. ALÉRGICOS: CONTÉM DE VADOS DE nÃ SOJA. PODE CONTER CASTANHA-DO-PA CENTEIO, CEVADA, À OVOS E LEITE CONTÉM GLÚTEN.", 86);
  assert.equal(r.status, INS);
});
t("separa os avisos que ficaram sem pontuação no OCR", function(){
  var r = ler("Ingredientes: farinha, sal. ALÉRGICOS: CONTÉM SOJA PODE CONTER LEITE E OVOS CONTÉM GLÚTEN.");
  assert.equal(r.rotulo.advertencias.contem,"CONTÉM SOJA");
  assert.equal(r.rotulo.advertencias.podeConter,"PODE CONTER LEITE E OVOS");
  assert.equal(r.rotulo.declaracaoGluten,"contem");
});
t("muitas palavras pouco confiáveis pedem nova foto",function(){
  var palavras=Array.from({length:12},function(_,i){return {texto:"palavra",confianca:i<4?45:95};});
  assert.equal(O.interpretar(TORRADA,{confianca:83,palavras:palavras}).status,INS);
});

console.log("Elida IA · OCR: " + ok + " testes passaram, " + falhas.length + " falharam.");
falhas.forEach(function (f) { console.log("FALHA " + f); });
process.exit(falhas.length ? 1 : 0);
