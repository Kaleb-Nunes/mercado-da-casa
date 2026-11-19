/* Elida IA · contrato de busca de rótulos.
   - Marco 2: provedor de dados FICTÍCIOS, só para homologação e testes.
   - Marco 3: provedor Open Food Facts, autorizado só em homologação. Tudo que vem dele é RASCUNHO:
     nunca conta como advertências completas e nunca gera conclusão favorável sozinho.
     A busca por nome só devolve sugestões, que exigem confirmar produto e variante.
     Só o código de barras ou o termo digitado saem do aparelho; perfil e restrições nunca.
   - Em produção, provedor que exige aprovação fica desligado: a busca responde "indisponível".
   Todo produto devolvido traz a fonte: provedor, identificação, data da conferência e licença. */
(function (raiz, fabrica) {
  "use strict";
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ElidaBusca = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSAO_CONTRATO = 2;
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
    r.fonte = { identificacao: p.fonte.provedor + " · " + p.fonte.identificacao, dataVerificacao: p.fonte.dataVerificacao, desatualizada: !!p.fonte.desatualizada, rascunho: !!p.fonte.rascunho };
    if (p.fonte.rascunho || p.rotulo.rascunho) { r.rascunho = true; r.ingredientesCompletos = false; r.advertenciasCompletas = false; }
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


  /* ---------- Provedor Open Food Facts (Marco 3, só homologação) ---------- */
  var OFF = Object.freeze({ produto: "https://world.openfoodfacts.org/api/v2/product/", busca: "https://search.openfoodfacts.org/search",
    campos: "code,product_name,product_name_pt,generic_name_pt,brands,quantity,ingredients_text_pt,ingredients_text,allergens_tags,traces_tags,last_modified_t",
    licenca: "Open Food Facts · ODbL (base) / DbCL (conteúdo). Dado colaborativo: pode estar errado ou incompleto.",
    leiturasPorMinuto: 12, buscasPorMinuto: 8, cacheDias: 7 });
  var TAG = { "en:milk": "leite", "en:gluten": "glúten", "en:soybeans": "soja", "en:eggs": "ovo", "en:peanuts": "amendoim", "en:nuts": "castanhas",
    "en:wheat": "trigo", "en:fish": "peixe", "en:crustaceans": "crustáceos", "en:sesame-seeds": "gergelim", "en:oats": "aveia", "en:barley": "cevada", "en:rye": "centeio", "en:molluscs": "moluscos", "en:lupin": "tremoço" };
  /* Janela deslizante: no máximo N chamadas por minuto; espera crescente depois de 429/503. */
  function limitador(porMinuto, agora) {
    var marcas = [], bloqueadoAte = 0, falhas = 0;
    return {
      pode: function () { var t = agora(); marcas = marcas.filter(function (m) { return t - m < 60000; }); return t >= bloqueadoAte && marcas.length < porMinuto; },
      usar: function () { marcas.push(agora()); },
      ocupado: function () { falhas++; bloqueadoAte = agora() + Math.min(600000, 30000 * Math.pow(2, falhas - 1)); },
      ok: function () { falhas = 0; },
      esperaMs: function () { var t = agora(); return Math.max(0, bloqueadoAte - t, marcas.length >= porMinuto ? 60000 - (t - marcas[0]) : 0); }
    };
  }
  function cacheMemoria() { var m = {}; return { ler: function (k) { return m[k] || null; }, gravar: function (k, v) { m[k] = v; } }; }
  function separarIngredientes(t) {
    var partes = [], atual = "", nivel = 0;
    for (var i = 0; i < t.length; i++) { var c = t.charAt(i); if (c === "(" || c === "[") nivel++; else if ((c === ")" || c === "]") && nivel > 0) nivel--; if ((c === "," || c === ";") && nivel === 0) { partes.push(atual); atual = ""; } else atual += c; }
    partes.push(atual);
    return partes.map(function (p) { return p.replace(/^[\s.:;_*-]+|[\s.:;_*-]+$/g, ""); }).filter(function (p) { return /[A-Za-zÀ-ú]{2,}/.test(p); });
  }
  function plausivel(t) { return t.length >= 3 && !/\bprice\b|\bpre[çc]o\b|r\$|^[\d\s.,]+$/i.test(t); }
  function declaracao(texto, rxNao, rxSim) {
    var n = normalizar(texto), nao = rxNao.test(n), sim = false, m, rx = new RegExp(rxSim.source, "g");
    while ((m = rx.exec(n))) { if (!/nao\s*$/.test(n.slice(Math.max(0, m.index - 5), m.index))) sim = true; }
    return [nao, sim];
  }
  function produtoOFF(p, hoje, sugestao) {
    var codigo = String(p.code || "").replace(/\D/g, "");
    var bruto = String(p.ingredients_text_pt || p.ingredients_text || "").trim(), ing = plausivel(bruto) ? separarIngredientes(bruto) : [];
    var g = declaracao(bruto, /nao contem gluten|sem gluten|isento de gluten/, /contem gluten/), l = declaracao(bruto, /nao contem lactose|(sem|zero|isento de) lactose/, /contem lactose/);
    var tagsA = (p.allergens_tags || []).map(function (x) { return TAG[x]; }).filter(Boolean), tagsT = (p.traces_tags || []).map(function (x) { return TAG[x]; }).filter(Boolean);
    var editado = p.last_modified_t ? new Date(p.last_modified_t * 1000).toISOString().slice(0, 10) : null;
    var nome = String(p.product_name_pt || p.product_name || p.generic_name_pt || "").trim() || ("Produto " + codigo);
    return {
      id: "off-" + codigo, nome: nome, marca: String(p.brands || "").split(",")[0].trim(), quantidade: String(p.quantity || ""),
      ean: gtinValido(codigo) ? codigo : null, sugestao: !!sugestao,
      rotulo: { categoria: "alimento", ingredientes: ing,
        /* Sinais do OFF só podem deixar o resultado mais grave: viram "contém"/"pode conter", nunca "completo". */
        advertencias: { contem: tagsA.length ? "Open Food Facts indica: " + tagsA.join(", ") : "", podeConter: tagsT.length ? "Open Food Facts indica traços de: " + tagsT.join(", ") : "" },
        declaracaoGluten: g[0] && g[1] ? "contraditorio" : g[1] ? "contem" : g[0] ? "nao_contem" : "nao_informado",
        declaracaoLactose: l[0] && l[1] ? "contraditorio" : l[1] ? "contem_lactose" : l[0] ? "sem_lactose" : "nao_informado",
        ingredientesCompletos: false, advertenciasCompletas: false, rascunho: true },
      fonte: { provedor: "Open Food Facts (colaborativo)", identificacao: "GTIN " + codigo + (editado ? " · editado no OFF em " + editado.split("-").reverse().join("/") : ""),
        dataVerificacao: hoje, licenca: OFF.licenca, ficticio: false, rascunho: true, urlProduto: "https://world.openfoodfacts.org/product/" + codigo }
    };
  }
  /* provedorOpenFoodFacts({ fetch, agora, hoje, cache, appName, appVersion }) */
  function provedorOpenFoodFacts(op) {
    op = op || {};
    var buscar = op.fetch || (typeof fetch === "function" ? function (u, o) { return fetch(u, o); } : null);
    var agora = op.agora || function () { return Date.now(); };
    var hoje = op.hoje || function () { return new Date().toISOString().slice(0, 10); };
    var cache = op.cache || cacheMemoria();
    var lim = { leitura: limitador(OFF.leiturasPorMinuto, agora), busca: limitador(OFF.buscasPorMinuto, agora) };
    var app = "app_name=" + encodeURIComponent(op.appName || "Elida") + "&app_version=" + encodeURIComponent(op.appVersion || "hml");
    function chamar(tipo, url) {
      var l = lim[tipo];
      if (!buscar) return Promise.reject(new Error("sem acesso à rede"));
      if (!l.pode()) return Promise.reject(new Error("limite de consultas; tente em " + Math.ceil(l.esperaMs() / 1000) + " s"));
      l.usar();
      return buscar(url, { headers: { Accept: "application/json" }, credentials: "omit", referrerPolicy: "no-referrer" }).then(function (r) {
        if (r.status === 429 || r.status === 503) { l.ocupado(); throw new Error("Open Food Facts ocupado (" + r.status + "); tente mais tarde"); }
        if (r.status === 404) { l.ok(); return null; }
        if (!r.ok) throw new Error("Open Food Facts respondeu " + r.status);
        l.ok(); return r.json();
      });
    }
    return {
      nome: "openfoodfacts", ficticio: false, exigeAprovacaoProducao: true, colaborativo: true,
      porCodigo: function (codigo) {
        var k = "off:" + codigo, c = cache.ler(k);
        if (c && agora() - c.em < OFF.cacheDias * 86400000) return Promise.resolve(c.produtos);
        return chamar("leitura", OFF.produto + encodeURIComponent(codigo) + ".json?fields=" + OFF.campos + "&" + app).then(function (d) {
          var lista = d && d.status === 1 && d.product ? [produtoOFF(d.product, hoje(), false)] : [];
          cache.gravar(k, { em: agora(), produtos: lista });
          return lista;
        });
      },
      porNome: function (termo) {
        return chamar("busca", OFF.busca + "?q=" + encodeURIComponent(termo) + "&page_size=5&fields=code,product_name,product_name_pt,brands,quantity&" + app).then(function (d) {
          return ((d && d.hits) || []).filter(function (h) { return gtinValido(h.code); }).map(function (h) { return produtoOFF(h, hoje(), true); });
        });
      }
    };
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
    if (config.producao && prov && prov.exigeAprovacaoProducao && !config.aprovadoProducao) prov = null;
    var limite = config.tempoLimiteMs || TEMPO_LIMITE_MS;
    function rodar(tipo, valor, chamada) {
      var consulta = { tipo: tipo, valor: valor };
      if (!prov) return Promise.resolve(resposta(STATUS.INDISPONIVEL, consulta, [], ["Ainda não há fonte de rótulos aprovada. Confira a embalagem."]));
      return comTempoLimite(Promise.resolve().then(chamada), limite).then(function (lista) {
        var avisos = [], validos = (Array.isArray(lista) ? lista : []).filter(function (p) {
          var v = validarProduto(p); if (!v.ok) avisos.push("Um resultado foi descartado: dados fora do contrato (" + v.erros.join(", ") + ")."); return v.ok;
        });
        if (prov.ficticio) avisos.unshift("Dados fictícios de teste: não são produtos reais.");
        if (prov.colaborativo) avisos.unshift(tipo === "nome" ? "Sugestões do Open Food Facts: confirme se é o mesmo produto, sabor e tamanho antes de ver a avaliação."
          : "Rascunho do Open Food Facts (dado colaborativo): confira a embalagem antes de confiar no resultado.");
        return resposta(validos.length ? STATUS.OK : STATUS.NAO_ENCONTRADO, consulta, validos, avisos);
      }, function (e) {
        return resposta(STATUS.INDISPONIVEL, consulta, [], ["A fonte não respondeu (" + String(e && e.message || e).slice(0, 60) + "). Confira a embalagem."]);
      });
    }
    return {
      fornecedor: prov ? prov.nome : null, ficticio: !!(prov && prov.ficticio), colaborativo: !!(prov && prov.colaborativo),
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
      /* Foto: a leitura é local (elida-ocr.js) e passa pela confirmação humana; nada vai para o provedor. */
      porFoto: function () { return Promise.resolve(resposta(STATUS.NAO_IMPLEMENTADO, { tipo: "foto", valor: null }, [], ["A foto é lida no próprio aparelho, pela tela de leitura de rótulo. Ela não passa pela busca."])); }
    };
  }
  /* Busca que entende o que foi digitado: só números = código de barras; o resto = nome. */
  function consultar(busca, texto) {
    var t = String(texto == null ? "" : texto).trim();
    return /^[\d\s.-]{8,}$/.test(t) ? busca.porCodigo(t) : busca.porNome(t);
  }

  return Object.freeze({ VERSAO_CONTRATO: VERSAO_CONTRATO, STATUS: STATUS, gtinValido: gtinValido, validarProduto: validarProduto, rotuloParaRegras: rotuloParaRegras,
    provedorFicticio: provedorFicticio, provedorIndisponivel: provedorIndisponivel, provedorOpenFoodFacts: provedorOpenFoodFacts, OFF: OFF, _produtoOFF: produtoOFF, criarBusca: criarBusca, consultar: consultar, _catalogo: function () { return CATALOGO.map(copia); } });
});
