/* Elida IA · Marco 2: contrato de busca de rótulos e provedor de dados FICTÍCIOS.
   - Nenhuma chamada de rede neste arquivo. Fonte real só entra depois de aprovada (custo, termos, licença).
   - O provedor fictício só existe para homologação e testes. Em produção a busca responde "indisponível".
   - Foto: só o contrato. A leitura (OCR + confirmação humana) é o Marco 3.
   Todo produto devolvido traz a fonte: provedor, identificação, data da conferência e licença. */
(function (raiz, fabrica) {
  "use strict";
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ElidaBusca = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSAO_CONTRATO = 1;
  var STATUS = Object.freeze({ OK: "ok", NAO_ENCONTRADO: "nao_encontrado", INDISPONIVEL: "indisponivel", INVALIDO: "invalido", NAO_IMPLEMENTADO: "nao_implementado" });
  var TEMPO_LIMITE_MS = 8000;

  function normalizar(s) { return " " + String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " "; }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  /* GTIN-8/12/13/14 com dígito verificador. */
  function gtinValido(c) {
    c = String(c == null ? "" : c).replace(/\D/g, "");
    if (!/^(\d{8}|\d{12,14})$/.test(c)) return false;
    var soma = 0, n = c.length;
    for (var i = 0; i < n - 1; i++) soma += Number(c[n - 2 - i]) * (i % 2 === 0 ? 3 : 1);
    return (10 - soma % 10) % 10 === Number(c[n - 1]);
  }

  /* Contrato do produto devolvido por qualquer provedor. */
  function validarProduto(p) {
    var e = [];
    if (!p || typeof p !== "object") return { ok: false, erros: ["produto ausente"] };
    if (typeof p.id !== "string" || !p.id) e.push("id");
    if (typeof p.nome !== "string" || !p.nome.trim()) e.push("nome");
    if (p.ean != null && !gtinValido(p.ean)) e.push("ean");
    if (!p.rotulo || typeof p.rotulo !== "object") e.push("rotulo");
    var f = p.fonte;
    if (!f || typeof f.provedor !== "string" || typeof f.identificacao !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(f.dataVerificacao || "") || typeof f.licenca !== "string" || typeof f.ficticio !== "boolean") e.push("fonte");
    return { ok: e.length === 0, erros: e };
  }
  /* Junta a fonte no rótulo no formato que o ElidaRegras espera. */
  function rotuloParaRegras(p) {
    var r = copia(p.rotulo);
    r.nome = p.nome; r.ean = p.ean || null;
    r.fonte = { identificacao: p.fonte.provedor + " · " + p.fonte.identificacao, dataVerificacao: p.fonte.dataVerificacao, desatualizada: !!p.fonte.desatualizada };
    return r;
  }

  /* ---------- Provedor fictício (determinístico) ---------- */
  var F = { provedor: "Catálogo fictício de teste", licenca: "Dados inventados para homologação. Não são produtos reais.", ficticio: true };
  function fonte(data, id, extra) { return Object.assign({}, F, { identificacao: id, dataVerificacao: data }, extra || {}); }
  var CATALOGO = [
    { id: "t-polvilho", nome: "Biscoito de polvilho (teste)", marca: "Marca Teste", ean: "2000000000015", fonte: fonte("2026-11-10", "ficha T-01"),
      rotulo: { categoria: "alimento", ingredientes: ["polvilho azedo", "óleo de girassol", "sal", "água"], advertencias: { contem: "", podeConter: "" }, declaracaoGluten: "nao_contem", declaracaoLactose: "nao_informado", ingredientesCompletos: true, advertenciasCompletas: true } },
    { id: "t-bolo", nome: "Bolo de chocolate (teste)", marca: "Marca Teste", ean: "2000000000022", fonte: fonte("2026-11-10", "ficha T-02"),
      rotulo: { categoria: "alimento", ingredientes: ["farinha de trigo enriquecida com ferro e ácido fólico", "açúcar", "ovos", "leite em pó integral", "cacau em pó", "fermento químico"], advertencias: { contem: "ALÉRGICOS: CONTÉM TRIGO, OVO E LEITE.", podeConter: "" }, declaracaoGluten: "contem", declaracaoLactose: "contem_lactose", ingredientesCompletos: true, advertenciasCompletas: true } },
    { id: "t-pao", nome: "Pão de forma (teste)", marca: "Padaria Teste", ean: "2000000000039", fonte: fonte("2026-11-12", "ficha T-03"),
      rotulo: { categoria: "alimento", ingredientes: ["farinha de trigo enriquecida", "água", "açúcar", "óleo de soja", "sal", "fermento biológico"], advertencias: { contem: "ALÉRGICOS: CONTÉM TRIGO E SOJA.", podeConter: "PODE CONTER LEITE." }, declaracaoGluten: "contem", declaracaoLactose: "nao_informado", ingredientesCompletos: true, advertenciasCompletas: true } },
    { id: "t-bebida-arroz", nome: "Bebida de arroz (teste)", marca: "Marca Teste", ean: "2000000000046", fonte: fonte("2026-11-12", "ficha T-04"),
      rotulo: { categoria: "alimento", ingredientes: ["água", "arroz", "óleo de girassol", "sal"], advertencias: { contem: "", podeConter: "" }, declaracaoGluten: "nao_contem", declaracaoLactose: "nao_informado", ingredientesCompletos: true, advertenciasCompletas: true } },
    { id: "t-iogurte", nome: "Iogurte zero lactose (teste)", marca: "Laticínio Teste", ean: "2000000000053", fonte: fonte("2026-11-12", "ficha T-05"),
      rotulo: { categoria: "alimento", ingredientes: ["leite desnatado", "fermento lácteo", "enzima lactase"], advertencias: { contem: "ALÉRGICOS: CONTÉM LEITE.", podeConter: "" }, declaracaoGluten: "nao_contem", declaracaoLactose: "sem_lactose", ingredientesCompletos: true, advertenciasCompletas: true } },
    { id: "t-chocolate", nome: "Chocolate meio amargo (teste)", marca: "Doces Teste", ean: "2000000000060", fonte: fonte("2026-11-14", "ficha T-06"),
      rotulo: { categoria: "alimento", ingredientes: ["massa de cacau", "açúcar", "manteiga de cacau", "lecitina de soja"], advertencias: { contem: "ALÉRGICOS: CONTÉM SOJA.", podeConter: "PODE CONTER LEITE E AMENDOIM." }, declaracaoGluten: "nao_contem", declaracaoLactose: "nao_informado", ingredientesCompletos: true, advertenciasCompletas: true } },
    { id: "t-granola", nome: "Granola com mel (teste)", marca: "Marca Teste", ean: "2000000000077", fonte: fonte("2026-11-14", "ficha T-07"),
      rotulo: { categoria: "alimento", ingredientes: ["flocos de aveia", "mel", "uva-passa", "castanha-do-pará"], advertencias: { contem: "ALÉRGICOS: CONTÉM AVEIA E CASTANHA-DO-PARÁ.", podeConter: "PODE CONTER TRIGO." }, declaracaoGluten: "contem", declaracaoLactose: "nao_informado", ingredientesCompletos: true, advertenciasCompletas: true } },
    { id: "t-formula", nome: "Fórmula infantil (teste)", marca: "Nutri Teste", ean: "2000000000084", fonte: fonte("2026-11-14", "ficha T-08"),
      rotulo: { categoria: "formula_infantil", ingredientes: ["proteína de arroz hidrolisada", "maltodextrina", "óleos vegetais"], advertencias: { contem: "", podeConter: "" }, declaracaoGluten: "nao_contem", declaracaoLactose: "nao_informado", ingredientesCompletos: true, advertenciasCompletas: true } },
    { id: "t-antigo", nome: "Biscoito de arroz (teste, ficha antiga)", marca: "Marca Teste", ean: "2000000000091", fonte: fonte("2024-05-02", "ficha T-09"),
      rotulo: { categoria: "alimento", ingredientes: ["arroz", "sal"], advertencias: { contem: "", podeConter: "" }, declaracaoGluten: "nao_contem", declaracaoLactose: "nao_informado", ingredientesCompletos: true, advertenciasCompletas: true } },
    { id: "t-incompleto", nome: "Salgadinho de milho (teste, rótulo incompleto)", marca: "Marca Teste", ean: "2000000000107", fonte: fonte("2026-11-15", "ficha T-10"),
      rotulo: { categoria: "alimento", ingredientes: ["milho", "óleo vegetal"], advertencias: { contem: "", podeConter: "" }, declaracaoGluten: "nao_informado", declaracaoLactose: "nao_informado", ingredientesCompletos: false, advertenciasCompletas: false } }
  ];
  function provedorFicticio(opcoes) {
    opcoes = opcoes || {};
    return {
      nome: "ficticio", ficticio: true,
      porNome: function (q) {
        var t = normalizar(q).trim();
        var achados = CATALOGO.filter(function (p) { return t.split(" ").every(function (w) { return normalizar(p.nome + " " + p.marca).indexOf(" " + w) >= 0; }); });
        return Promise.resolve(achados.map(copia));
      },
      porCodigo: function (ean) { return Promise.resolve(CATALOGO.filter(function (p) { return p.ean === ean; }).map(copia)); },
      _atraso: opcoes.atraso || 0
    };
  }
  function provedorIndisponivel(motivo) {
    var erro = function () { return Promise.reject(new Error(motivo || "fonte fora do ar")); };
    return { nome: "indisponivel", ficticio: false, porNome: erro, porCodigo: erro };
  }

  function comTempoLimite(promessa, ms) {
    return new Promise(function (ok, falha) {
      var t = setTimeout(function () { falha(new Error("tempo esgotado")); }, ms);
      promessa.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); falha(e); });
    });
  }
  function resposta(status, consulta, produtos, avisos) { return { status: status, versaoContrato: VERSAO_CONTRATO, consulta: consulta, produtos: produtos || [], avisos: avisos || [] }; }

  /* criarBusca({ provedor, producao, tempoLimiteMs })
     Em produção, sem provedor real aprovado, toda busca responde "indisponível". */
  function criarBusca(config) {
    config = config || {};
    var prov = config.provedor || null;
    if (config.producao && (!prov || prov.ficticio)) prov = null;
    var limite = config.tempoLimiteMs || TEMPO_LIMITE_MS;
    function rodar(tipo, valor, chamada) {
      var consulta = { tipo: tipo, valor: valor };
      if (!prov) return Promise.resolve(resposta(STATUS.INDISPONIVEL, consulta, [], ["Ainda não há fonte de rótulos aprovada. Confira a embalagem."]));
      return comTempoLimite(Promise.resolve().then(chamada), limite).then(function (lista) {
        var avisos = [], validos = (Array.isArray(lista) ? lista : []).filter(function (p) {
          var v = validarProduto(p); if (!v.ok) avisos.push("Um resultado foi descartado: dados fora do contrato (" + v.erros.join(", ") + ")."); return v.ok;
        });
        if (prov.ficticio) avisos.unshift("Dados fictícios de teste: não são produtos reais.");
        return resposta(validos.length ? STATUS.OK : STATUS.NAO_ENCONTRADO, consulta, validos, avisos);
      }, function (e) {
        return resposta(STATUS.INDISPONIVEL, consulta, [], ["A fonte não respondeu (" + String(e && e.message || e).slice(0, 60) + "). Confira a embalagem."]);
      });
    }
    return {
      fornecedor: prov ? prov.nome : null, ficticio: !!(prov && prov.ficticio),
      porNome: function (q) {
        var t = String(q == null ? "" : q).trim();
        if (t.length < 2 || t.length > 80) return Promise.resolve(resposta(STATUS.INVALIDO, { tipo: "nome", valor: t }, [], ["Digite de 2 a 80 letras."]));
        return rodar("nome", t, function () { return prov.porNome(t); });
      },
      porCodigo: function (c) {
        var d = String(c == null ? "" : c).replace(/\D/g, "");
        if (!gtinValido(d)) return Promise.resolve(resposta(STATUS.INVALIDO, { tipo: "codigo", valor: d }, [], ["Código de barras inválido: confira os números."]));
        return rodar("codigo", d, function () { return prov.porCodigo(d); });
      },
      /* Contrato do Marco 3: foto -> OCR -> confirmação humana -> regras. Não existe ainda. */
      porFoto: function () { return Promise.resolve(resposta(STATUS.NAO_IMPLEMENTADO, { tipo: "foto", valor: null }, [], ["Leitura por foto ainda não existe. Ela vai exigir que você confirme o texto lido antes de qualquer análise."])); }
    };
  }
  /* Busca que entende o que foi digitado: só números = código de barras; o resto = nome. */
  function consultar(busca, texto) {
    var t = String(texto == null ? "" : texto).trim();
    return /^[\d\s.-]{8,}$/.test(t) ? busca.porCodigo(t) : busca.porNome(t);
  }

  return Object.freeze({ VERSAO_CONTRATO: VERSAO_CONTRATO, STATUS: STATUS, gtinValido: gtinValido, validarProduto: validarProduto, rotuloParaRegras: rotuloParaRegras,
    provedorFicticio: provedorFicticio, provedorIndisponivel: provedorIndisponivel, criarBusca: criarBusca, consultar: consultar, _catalogo: function () { return CATALOGO.map(copia); } });
});
