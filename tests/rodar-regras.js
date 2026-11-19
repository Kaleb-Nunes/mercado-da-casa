/* Elida IA · Marco 1: testes do motor de regras, formulário, gatilhos e armazenamento.
   Inclui os 29 casos do protótipo (adaptados à API nova) e os casos que a auditoria achou.
   Uso: node tests/rodar-regras.js */
"use strict";
var assert = require("node:assert/strict");
var path = require("path"), fs = require("fs");
var R = require(path.join(__dirname, "..", "elida-regras.js"));
var E = R.ESTADOS, HOJE = "2026-11-18";
var ok = 0, falhas = [];
function t(nome, fn) { try { fn(); ok++; } catch (e) { falhas.push(nome + ": " + e.message.split("\n")[0]); } }
function perfil() { var tipos = [].slice.call(arguments); return { id: "perfil_teste_001", apelido: "Pessoa teste", faixaEtaria: "adulto", restricoes: tipos.map(function (tipo) { return { tipo: tipo, situacao: "confirmada" }; }) }; }
function rot(x) { return Object.assign({ nome: "Biscoito de teste", ean: "7891234567890", categoria: "alimento", ingredientes: ["farinha de arroz", "sal"], ingredientesCompletos: true,
  advertencias: { contem: [], podeConter: [] }, advertenciasCompletas: true, declaracaoGluten: "nao_contem", fonte: { identificacao: "foto do rótulo de teste", dataVerificacao: "2026-11-18" } }, x || {}); }
function st(p, l) { return R.analisar(p, l, { hoje: HOJE }).status; }
function est(p, l, tipo) { return R.analisar(p, l, { hoje: HOJE }).detalhes.filter(function (d) { return d.restricao === tipo; })[0].estado; }

/* --- 29 casos do protótipo --- */
t("perfil válido", function () { assert.equal(R.validarPerfil(perfil("aplv", "celiaca")).ok, true); });
t("perfil sem restrições rejeitado", function () { var p = perfil("aplv"); p.restricoes = []; assert.equal(R.validarPerfil(p).ok, false); });
t("restrição duplicada rejeitada", function () { assert.equal(R.validarPerfil(perfil("aplv", "aplv")).ok, false); });
t("rótulo ausente rejeitado", function () { assert.equal(R.analisar(perfil("aplv"), null).status, "INVALIDO"); });
t("APLV: contém leite pela advertência", function () { assert.equal(st(perfil("aplv"), rot({ advertencias: { contem: ["leite"], podeConter: [] } })), E.INCOMPATIVEL); });
t("APLV: soro de leite nos ingredientes", function () { assert.equal(st(perfil("aplv"), rot({ ingredientes: ["soro de leite"] })), E.INCOMPATIVEL); });
t("APLV: pode conter leite", function () { assert.equal(st(perfil("aplv"), rot({ advertencias: { contem: [], podeConter: ["leite"] } })), E.CONTAMINACAO); });
t("APLV: rótulo incompleto", function () { assert.equal(st(perfil("aplv"), rot({ ingredientesCompletos: false })), E.INSUFICIENTE); });
t("APLV: sem lactose não substitui análise do leite", function () { assert.equal(st(perfil("aplv"), rot({ declaracaoLactose: "sem_lactose", advertencias: { contem: ["leite"], podeConter: [] } })), E.INCOMPATIVEL); });
t("celíaca: declaração contém glúten", function () { assert.equal(st(perfil("celiaca"), rot({ declaracaoGluten: "contem" })), E.INCOMPATIVEL); });
t("celíaca: declarações contraditórias", function () { assert.equal(st(perfil("celiaca"), rot({ declaracaoGluten: "contraditorio" })), E.INSUFICIENTE); });
t("celíaca: sem declaração", function () { assert.equal(st(perfil("celiaca"), rot({ declaracaoGluten: "nao_informado" })), E.INSUFICIENTE); });
t("celíaca: trigo nos ingredientes", function () { assert.equal(st(perfil("celiaca"), rot({ ingredientes: ["farinha de trigo"] })), E.INCOMPATIVEL); });
t("celíaca: não contém glúten e completo", function () { assert.equal(st(perfil("celiaca"), rot()), E.NAO_IDENTIFICADO); });
t("várias restrições: o mais grave prevalece", function () { assert.equal(st(perfil("aplv", "celiaca"), rot({ advertencias: { contem: ["leite"], podeConter: [] } })), E.INCOMPATIVEL); });
t("alergia à soja declarada", function () { assert.equal(st(perfil("alergia_soja"), rot({ advertencias: { contem: ["soja"], podeConter: [] } })), E.INCOMPATIVEL); });
t("alergia ao amendoim: pode conter", function () { assert.equal(st(perfil("alergia_amendoim"), rot({ advertencias: { contem: [], podeConter: ["amendoim"] } })), E.CONTAMINACAO); });
t("lactose precisa de declaração", function () { assert.equal(st(perfil("lactose"), rot()), E.INSUFICIENTE); });
t("lactose com \"sem lactose\"", function () { assert.equal(st(perfil("lactose"), rot({ declaracaoLactose: "sem_lactose" })), E.NAO_IDENTIFICADO); });
t("glicose só informativo", function () { assert.equal(st(perfil("controle_glicose"), rot()), E.INFORMATIVO); });
t("fórmula infantil não é autorizada", function () { assert.equal(st(perfil("aplv"), rot({ categoria: "formula_infantil" })), E.PROFISSIONAL); });
t("nome comercial não supre dados", function () { assert.equal(st(perfil("aplv"), rot({ nome: "Marca fictícia infantil", ingredientesCompletos: false })), E.INSUFICIENTE); });
t("fonte ausente não dá resultado favorável", function () { assert.equal(st(perfil("aplv"), rot({ fonte: null })), E.INSUFICIENTE); });
t("leite de coco isolado não é leite animal", function () { assert.equal(st(perfil("aplv"), rot({ ingredientes: ["leite de coco"] })), E.NAO_IDENTIFICADO); });
t("leite sem lactose para intolerância", function () { assert.equal(st(perfil("lactose"), rot({ ingredientes: ["leite"], declaracaoLactose: "sem_lactose" })), E.NAO_IDENTIFICADO); });
t("lactose na lista não libera APLV", function () { assert.notEqual(st(perfil("aplv"), rot({ ingredientes: ["lactose"] })), E.NAO_IDENTIFICADO); });
t("fonte desatualizada", function () { assert.equal(st(perfil("aplv"), rot({ fonte: { identificacao: "rótulo", dataVerificacao: "2026-11-18", desatualizada: true } })), E.INSUFICIENTE); });
t("gatilho: restrição alterada invalida resultados", function () { var g = R.criarGatilhos({ INVALIDAR_RESULTADOS_E_REAVALIAR: function () {} }); assert.equal(g.disparar("RESTRICAO_ALTERADA").resultado, "executado"); });
t("gatilho: evento desconhecido é ignorado", function () { var g = R.criarGatilhos({}); assert.equal(g.disparar("FORMULARIO_EXECUTAR_JAVASCRIPT").acao, "IGNORAR"); });

/* --- Achados da auditoria do protótipo --- */
t("[auditoria] leite + lactose nos ingredientes continua INCOMPATÍVEL (protótipo dava insuficiente)", function () { assert.equal(st(perfil("aplv"), rot({ ingredientes: ["leite integral", "lactose"] })), E.INCOMPATIVEL); });
t("[auditoria] advertência \"derivados de leite\" pega (protótipo só aceitava a palavra exata)", function () { assert.equal(st(perfil("aplv"), rot({ advertencias: { contem: ["derivados de leite"], podeConter: [] } })), E.INCOMPATIVEL); });
t("[auditoria] advertência em texto corrido", function () { assert.equal(st(perfil("aplv", "alergia_trigo"), rot({ advertencias: { contem: "ALÉRGICOS: CONTÉM LEITE E DERIVADOS DE TRIGO", podeConter: "" } })), E.INCOMPATIVEL); });
t("[auditoria] pode conter em texto corrido", function () { assert.equal(st(perfil("alergia_ovo"), rot({ advertencias: { contem: [], podeConter: "PODE CONTER OVO E SOJA" } })), E.CONTAMINACAO); });
["manteiga", "queijo parmesão", "requeijão", "iogurte natural", "creme de leite", "nata", "coalhada", "composto lácteo", "caseinato de sódio", "whey protein", "proteína do soro", "ghee"].forEach(function (i) {
  t("[auditoria] APLV pega \"" + i + "\"", function () { assert.equal(st(perfil("aplv"), rot({ ingredientes: [i] })), E.INCOMPATIVEL); });
});
["manteiga de cacau", "leite de amêndoas", "leite de aveia", "manteiga de amendoim"].forEach(function (i) {
  t("[auditoria] APLV não confunde \"" + i + "\"", function () { assert.equal(est(perfil("aplv"), rot({ ingredientes: [i] }), "aplv"), E.NAO_IDENTIFICADO); });
});
t("[auditoria] manteiga de amendoim pega na alergia ao amendoim", function () { assert.equal(st(perfil("alergia_amendoim"), rot({ ingredientes: ["manteiga de amendoim"] })), E.INCOMPATIVEL); });
t("[auditoria] leite de soja pega na alergia à soja", function () { assert.equal(st(perfil("alergia_soja"), rot({ ingredientes: ["leite de soja"] })), E.INCOMPATIVEL); });
["malte", "extrato de malte", "aveia", "centeio", "cevada", "semolina"].forEach(function (i) {
  t("[auditoria] celíaca pega \"" + i + "\"", function () { assert.equal(st(perfil("celiaca"), rot({ ingredientes: [i] })), E.INCOMPATIVEL); });
});
t("[auditoria] \"não contém glúten\" mas com trigo: vale o alerta", function () { assert.equal(st(perfil("celiaca"), rot({ declaracaoGluten: "nao_contem", ingredientes: ["farinha de trigo"] })), E.INCOMPATIVEL); });
t("[auditoria] frase \"não contém glúten\" nos ingredientes não vira alerta falso", function () { assert.equal(st(perfil("celiaca"), rot({ ingredientes: ["arroz", "NÃO CONTÉM GLÚTEN"] })), E.NAO_IDENTIFICADO); });
t("[auditoria] pode conter cevada para celíaca", function () { assert.equal(st(perfil("celiaca"), rot({ advertencias: { contem: [], podeConter: ["pode conter cevada"] } })), E.CONTAMINACAO); });
t("[auditoria] fonte com mais de 365 dias", function () { assert.equal(st(perfil("aplv"), rot({ fonte: { identificacao: "rótulo", dataVerificacao: "2025-10-01" } })), E.INSUFICIENTE); });
t("[auditoria] fonte com data no futuro", function () { assert.equal(st(perfil("aplv"), rot({ fonte: { identificacao: "rótulo", dataVerificacao: "2027-01-01" } })), E.INSUFICIENTE); });
t("[auditoria] fontes em conflito", function () { assert.equal(st(perfil("aplv"), rot({ conflitoFontes: true })), E.INSUFICIENTE); });
t("[auditoria] advertências incompletas", function () { assert.equal(st(perfil("alergia_ovo"), rot({ advertenciasCompletas: false })), E.INSUFICIENTE); });
t("[auditoria] lactose: diz sem lactose e lista lactose", function () { assert.equal(st(perfil("lactose"), rot({ declaracaoLactose: "sem_lactose", ingredientes: ["lactose"] })), E.INSUFICIENTE); });
t("[auditoria] lactose: leite sem declaração fica insuficiente, nunca favorável", function () { assert.equal(st(perfil("lactose"), rot({ ingredientes: ["leite"] })), E.INSUFICIENTE); });
t("[auditoria] sem lactose não diz nada sobre APLV", function () { assert.equal(st(perfil("aplv"), rot({ declaracaoLactose: "sem_lactose", ingredientes: ["leite zero lactose"] })), E.INCOMPATIVEL); });
t("[auditoria] APLV com lactose isolada pede profissional", function () { assert.equal(st(perfil("aplv"), rot({ ingredientes: ["lactose"] })), E.PROFISSIONAL); });
t("[auditoria] celíaca ≠ alergia ao trigo: amido sem glúten declarado não libera trigo", function () {
  var r = R.analisar(perfil("celiaca", "alergia_trigo"), rot({ ingredientes: ["amido de trigo"], declaracaoGluten: "nao_contem" }), { hoje: HOJE });
  assert.equal(r.detalhes[1].estado, E.INCOMPATIVEL);
});
t("[auditoria] fórmula com leite continua INCOMPATÍVEL (não vira só orientação)", function () { assert.equal(st(perfil("aplv"), rot({ categoria: "formula_infantil", ingredientes: ["leite em pó"] })), E.INCOMPATIVEL); });
t("[auditoria] várias restrições: resultado por restrição, nenhum some", function () {
  var r = R.analisar(perfil("aplv", "celiaca", "alergia_ovo"), rot({ advertencias: { contem: ["ovo"], podeConter: ["leite"] }, declaracaoGluten: "nao_informado" }), { hoje: HOJE });
  /* Marco 3: a pior situação vem primeiro; todas as restrições continuam aparecendo. */
  assert.deepEqual(r.detalhes.map(function (d) { return d.estado; }), [E.INCOMPATIVEL, E.CONTAMINACAO, E.INSUFICIENTE]);
  assert.deepEqual(r.detalhes.map(function (d) { return d.restricao; }).sort(), ["alergia_ovo", "aplv", "celiaca"]);
  assert.equal(r.status, E.INCOMPATIVEL);
});
t("[auditoria] nenhum texto diz \"seguro\" de forma positiva", function () {
  var casos = [rot(), rot({ ingredientes: ["leite"] }), rot({ categoria: "formula_infantil" }), rot({ fonte: null })];
  ["aplv", "lactose", "celiaca", "alergia_trigo", "alergia_ovo", "alergia_soja", "alergia_amendoim", "controle_glicose"].forEach(function (tipo) {
    casos.forEach(function (c) {
      var s = JSON.stringify(R.analisar(perfil(tipo), c, { hoje: HOJE })).toLowerCase();
      assert.ok(!/\bseguro\b/.test(s.replace(/garante que (seja|o produto seja) seguro/g, "")), tipo + " gerou 'seguro'");
      assert.ok(s.indexOf('"seguro"') < 0 && s.indexOf("seguro para") < 0);
    });
  });
});
t("[auditoria] código de barras inválido rejeitado", function () { assert.equal(R.analisar(perfil("aplv"), rot({ ean: "123" })).status, "INVALIDO"); });
t("[auditoria] resultado deixa de valer se o rótulo muda", function () { var p = perfil("aplv"), l = rot(), r = R.analisar(p, l, { hoje: HOJE }); assert.ok(R.resultadoValido(r, p, l)); l.ingredientes = ["leite"]; assert.ok(!R.resultadoValido(r, p, l)); });
t("[auditoria] resultado deixa de valer se a restrição muda", function () { var p = perfil("aplv"), l = rot(), r = R.analisar(p, l, { hoje: HOJE }); p.restricoes[0].situacao = "suspeita"; assert.ok(!R.resultadoValido(r, p, l)); });
t("[auditoria] auditoria sem dado sensível", function () { var r = R.analisar(perfil("aplv"), rot({ ingredientes: ["leite"] }), { hoje: HOJE, agora: "2026-11-18T12:00:00Z" }); var a = JSON.stringify(R.registroAuditoria(r)); assert.ok(!/aplv|leite|Pessoa|perfil_teste/i.test(a)); });
t("[auditoria] situação \"preferência\" nunca afrouxa o alerta", function () { var p = perfil("aplv"); p.restricoes[0].situacao = "preferencia"; assert.equal(st(p, rot({ ingredientes: ["leite"] })), E.INCOMPATIVEL); });

/* --- Formulário --- */
t("formulário: válido vira perfil", function () { var r = R.validarFormulario({ apelido: " Mãe ", restricoes: ["aplv"], situacoes: { aplv: "suspeita" } }); assert.ok(r.ok); assert.equal(r.perfil.apelido, "Mãe"); assert.equal(r.perfil.restricoes[0].situacao, "suspeita"); });
t("formulário: erros por campo", function () { var r = R.validarFormulario({ apelido: "", restricoes: [] }); assert.ok(!r.ok); assert.ok(r.erros.apelido && r.erros.restricoes); });
t("formulário: situação obrigatória para cada restrição", function () { var r = R.validarFormulario({ apelido: "A", restricoes: ["aplv", "celiaca"], situacoes: { aplv: "confirmada" } }); assert.ok(/celíaca/i.test(r.erros.situacoes)); });
t("formulário: apelido com número de documento é recusado", function () { assert.ok(R.validarFormulario({ apelido: "Ana 1234567890", restricoes: ["aplv"], situacoes: { aplv: "confirmada" } }).erros.apelido); });
t("formulário: não pede diagnóstico (preferência basta)", function () { assert.ok(R.validarFormulario({ apelido: "Eu", restricoes: ["lactose"], situacoes: { lactose: "preferencia" } }).ok); });
t("formulário: sem campos de CPF, nascimento ou diagnóstico livre", function () { var ids = R.FORMULARIO.campos.map(function (c) { return c.id; }).join(" "); assert.ok(!/cpf|nascimento|diagnostico/i.test(ids)); });
t("formulário: avisos condicionais", function () {
  assert.deepEqual(R.infosVisiveis({ restricoes: ["aplv"], faixaEtaria: "bebe" }), ["info_aplv_lactose", "info_bebe_formula"]);
  assert.deepEqual(R.infosVisiveis({ restricoes: ["celiaca", "controle_glicose"] }), ["info_celiaca_trigo", "info_glicose"]);
});
t("formulário: restrições repetidas são unificadas", function () { var r = R.validarFormulario({ apelido: "A", restricoes: ["aplv", "aplv"], situacoes: { aplv: "confirmada" } }); assert.equal(r.perfil.restricoes.length, 1); });

/* --- Gatilhos --- */
t("gatilho: pesquisa sem pedido do usuário é bloqueada", function () { var chamou = 0, g = R.criarGatilhos({ BUSCAR_PRODUTO_E_APLICAR_PERFIL: function () { chamou++; } }); assert.match(g.disparar("PESQUISA_SOLICITADA", {}).resultado, /pedido do usuário/); assert.equal(chamou, 0); });
t("gatilho: rede bloqueada no Marco 1 mesmo com pedido", function () { var chamou = 0, g = R.criarGatilhos({ CONSULTAR_FONTE_E_APLICAR_PERFIL: function () { chamou++; } }); assert.match(g.disparar("CODIGO_LIDO", { origem: "usuario" }).resultado, /fornecedor/); assert.equal(chamou, 0); });
t("gatilho: sem loop (gatilho dentro de gatilho é bloqueado)", function () {
  var n = 0, g; g = R.criarGatilhos({ REAVALIAR_RESULTADOS_LOCAIS: function () { n++; g.disparar("PERFIL_SALVO"); } });
  g.disparar("PERFIL_SALVO"); assert.equal(n, 1); assert.match(g.registro()[0].resultado, /gatilho dentro de gatilho/);
});
t("gatilho: erro na ação não derruba e não trava", function () { var g = R.criarGatilhos({ EXCLUIR_DADOS_DO_PERFIL: function () { throw new Error("x"); }, REAVALIAR_RESULTADOS_LOCAIS: function () {} }); assert.match(g.disparar("PERFIL_EXCLUIDO").resultado, /^erro/); assert.equal(g.disparar("PERFIL_SALVO").resultado, "executado"); });
t("gatilho: nomes herdados de Object não executam", function () { var g = R.criarGatilhos({}); assert.equal(g.disparar("constructor").acao, "IGNORAR"); assert.equal(g.disparar("__proto__").acao, "IGNORAR"); });

/* --- Armazenamento --- */
function memoria() { var m = {}; return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, _m: m }; }
var P1 = R.validarFormulario({ apelido: "Teste", restricoes: ["aplv"], situacoes: { aplv: "confirmada" } }).perfil;
t("armazém: sem consentimento nada fica salvo", function () { var s = memoria(), a = R.criarArmazem(s, "hml:elida-perfis-v1"), e = R.estadoVazio(); e.perfis.push(P1); assert.equal(a.salvar(e), false); assert.equal(Object.keys(s._m).length, 0); });
t("armazém: com consentimento salva e recarrega", function () { var s = memoria(), a = R.criarArmazem(s, "k"), e = R.estadoVazio(); e.guardar = true; e.perfis.push(P1); e.ativo = P1.id; assert.ok(a.salvar(e)); assert.equal(a.carregar().perfis[0].apelido, "Teste"); assert.equal(a.carregar().ativo, P1.id); });
t("armazém: tirar o consentimento apaga do aparelho", function () { var s = memoria(), a = R.criarArmazem(s, "k"), e = R.estadoVazio(); e.guardar = true; e.perfis.push(P1); a.salvar(e); e.guardar = false; a.salvar(e); assert.equal(s.getItem("k"), null); });
t("armazém: excluir perfil limpa o ativo", function () { var e = R.estadoVazio(); e.perfis.push(P1); e.ativo = P1.id; var d = R.excluirPerfil(e, P1.id); assert.equal(d.perfis.length, 0); assert.equal(d.ativo, null); });
t("armazém: dado corrompido ou estranho vira estado vazio", function () { var s = memoria(); s.setItem("k", "{lixo"); assert.deepEqual(R.criarArmazem(s, "k").carregar().perfis, []); s.setItem("k", JSON.stringify({ formato: "elida-perfis", perfis: [{ id: "x" }] })); assert.equal(R.criarArmazem(s, "k").carregar().perfis.length, 0); });
t("armazém: exportação é JSON com formato e versão", function () { var e = R.estadoVazio(); e.perfis.push(P1); var j = JSON.parse(R.exportar(e)); assert.equal(j.formato, "elida-perfis"); assert.equal(j.versao, 1); });

/* --- Marco 3: rascunho, várias restrições, evidência --- */
t("rascunho nunca vira 'não identificado', mesmo marcado como completo", function () {
  ["aplv", "lactose", "celiaca", "alergia_trigo", "alergia_ovo", "alergia_soja", "alergia_amendoim"].forEach(function (tipo) {
    var r = R.analisar(perfil(tipo), rot({ rascunho: true, declaracaoGluten: "nao_contem", declaracaoLactose: "sem_lactose" }), { hoje: HOJE });
    assert.notEqual(r.status, E.NAO_IDENTIFICADO, tipo); assert.equal(r.rascunho, true);
  });
  var f = R.analisar(perfil("aplv"), rot({ fonte: { identificacao: "OFF", dataVerificacao: HOJE, rascunho: true } }), { hoje: HOJE });
  assert.equal(f.status, E.INSUFICIENTE); assert.match(f.detalhes[0].motivos.join(" "), /rascunho/);
});
t("rascunho ainda mostra incompatibilidade e contaminação", function () {
  assert.equal(R.analisar(perfil("aplv"), rot({ rascunho: true, ingredientes: ["leite em pó"] }), { hoje: HOJE }).status, E.INCOMPATIVEL);
  assert.equal(R.analisar(perfil("aplv"), rot({ rascunho: true, advertencias: { contem: "", podeConter: "PODE CONTER LEITE" } }), { hoje: HOJE }).status, E.CONTAMINACAO);
});
t("favorável numa restrição não esconde incompatível em outra (geral = pior; pior vem primeiro)", function () {
  var r = R.analisar(perfil("celiaca", "aplv"), rot({ declaracaoGluten: "nao_contem", advertencias: { contem: "ALÉRGICOS: CONTÉM LEITE", podeConter: "" } }), { hoje: HOJE });
  assert.equal(r.status, E.INCOMPATIVEL); assert.equal(r.detalhes[0].restricao, "aplv"); assert.equal(r.detalhes[0].estado, E.INCOMPATIVEL);
  assert.equal(r.detalhes[1].estado, E.NAO_IDENTIFICADO);
});
t("resultado guarda fonte, data, evidência e versões do motor e da política", function () {
  var r = R.analisar(perfil("aplv"), rot({ fonte: { identificacao: "Foto conferida", dataVerificacao: HOJE } }), { hoje: HOJE, agora: "2026-11-19T12:00:00.000Z" });
  assert.deepEqual(r.fonte, { identificacao: "Foto conferida", dataVerificacao: HOJE }); assert.match(r.evidencia, /^ev-/); assert.equal(r.versaoMotor, "m3-2026.11.19"); assert.ok(r.versaoPolitica); assert.equal(r.carimbo, "2026-11-19T12:00:00.000Z");
});
t("evidência muda quando o rótulo deixa de ser rascunho", function () {
  assert.notEqual(R.analisar(perfil("aplv"), rot({ rascunho: true }), { hoje: HOJE }).evidencia, R.analisar(perfil("aplv"), rot({ rascunho: false }), { hoje: HOJE }).evidencia);
});

/* --- Convivência com o app atual --- */
t("app: DietaMotor intacto, chaves da Despensa iguais e motor novo integrado", function () {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(/PFX \+ "mercado-casa-v1"/.test(html));
  assert.ok(/<script src="dieta\.js"><\/script>\s*<script src="elida-regras\.js"><\/script>\s*<script src="elida-busca\.js"><\/script>\s*<script src="elida-ocr\.js"><\/script>/.test(html));
  assert.ok(/IA\.criarArmazem\(window\.localStorage, PFX \+ "elida-perfis-v1"\)/.test(html), "perfis na mesma origem do app, com prefixo de homologação");
  assert.ok(/function criarProvedorIA\(\)\{\s*if\(!AMB\.homologacao\) return null;/.test(html), "produção: nenhum provedor (fictício ou OFF)");
  assert.ok(/return AMB\.catalogoFicticio \? BUS\.provedorFicticio\(\) : null;/.test(html), "dados fictícios só na homologação");
  assert.ok(/BUS\.criarBusca\(\{ provedor: criarProvedorIA\(\), producao: AMB\.producao \}\)/.test(html));
  assert.ok(!fs.existsSync(path.join(__dirname, "..", "perfis.html")), "não pode haver segunda experiência isolada");
});
t("app: restrições nunca vão para a URL e não há rede nos módulos novos", function () {
  /* Marco 3: só o elida-busca.js tem rede (provedor OFF, testado em rodar-busca.js). Regras e leitor de foto não têm. */
  ["elida-regras.js", "elida-ocr.js"].forEach(function (f) { var c = fs.readFileSync(path.join(__dirname, "..", f), "utf8"); assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|importScripts/.test(c), f); });
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(!/location\.(search|hash)\s*=\s*[^;]*perfil/.test(html));
});
t("service worker guarda os módulos novos para uso offline", function () { var sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8"); assert.ok(/"\.\/elida-regras\.js", "\.\/elida-busca\.js", "\.\/elida-ocr\.js"/.test(sw)); assert.ok(/CACHE_OCR = AMB\.prefixoCache \+ "-ocr-1"/.test(sw)); });

console.log("Elida IA · regras: " + ok + " testes passaram, " + falhas.length + " falharam.");
falhas.forEach(function (f) { console.log("FALHA " + f); });
process.exit(falhas.length ? 1 : 0);
