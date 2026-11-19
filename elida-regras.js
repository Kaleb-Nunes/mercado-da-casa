/* Elida IA · Marco 1: perfis, formulário, regras determinísticas e gatilhos.
   Adaptado do protótipo Elida_IA_Starter v0.1 depois de auditoria (docs/elida-ia/MARCO1.md).
   - Não substitui o DietaMotor (dieta.js), que continua cuidando dos avisos pelo nome na lista.
   - Aqui só entram dados do rótulo (ingredientes, advertências, declarações e fonte). Nome comercial
     nunca decide nada.
   - Nenhum resultado diz que um produto é seguro. Não há chamada de rede: pesquisa, código de barras
     e foto ficam bloqueados até o Marco 2.
   Não validado clinicamente. Política alimentar pendente de revisão profissional. */
(function (raiz, fabrica) {
  "use strict";
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ElidaRegras = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSAO_MOTOR = "m1-2026.11.18";
  var VERSAO_POLITICA = "pol-2026.11.18 (pendente de revisão profissional)";
  var VERSAO_PERFIS = 1;
  var IDADE_MAX_FONTE_DIAS = 365;

  var ESTADOS = Object.freeze({
    INCOMPATIVEL: "INCOMPATIVEL_IDENTIFICADO",
    CONTAMINACAO: "POSSIVEL_CONTAMINACAO",
    PROFISSIONAL: "REQUER_ORIENTACAO_PROFISSIONAL",
    INSUFICIENTE: "INFORMACAO_INSUFICIENTE",
    INFORMATIVO: "INFORMATIVO_SEM_AVALIACAO_CLINICA",
    NAO_IDENTIFICADO: "NAO_IDENTIFICADO_NOS_DADOS_VERIFICADOS"
  });
  /* Do mais grave para o menos grave. O geral é sempre o mais grave entre as restrições. */
  var GRAVIDADE = [ESTADOS.INCOMPATIVEL, ESTADOS.CONTAMINACAO, ESTADOS.PROFISSIONAL, ESTADOS.INSUFICIENTE, ESTADOS.INFORMATIVO, ESTADOS.NAO_IDENTIFICADO];
  var TEXTO_ESTADO = Object.freeze({
    INCOMPATIVEL_IDENTIFICADO: "Tem algo que precisa ser evitado",
    POSSIVEL_CONTAMINACAO: "Pode conter: risco de contaminação",
    REQUER_ORIENTACAO_PROFISSIONAL: "Precisa de orientação profissional",
    INFORMACAO_INSUFICIENTE: "Informação insuficiente: confira a embalagem",
    INFORMATIVO_SEM_AVALIACAO_CLINICA: "Só informativo: o app não avalia isso",
    NAO_IDENTIFICADO_NOS_DADOS_VERIFICADOS: "Nada encontrado nos dados conferidos (isso não garante que seja seguro)"
  });

  var RESTRICOES = Object.freeze({
    aplv: { nome: "Alergia à proteína do leite (APLV)", grupo: "leite" },
    lactose: { nome: "Intolerância à lactose", grupo: null },
    celiaca: { nome: "Doença celíaca (glúten)", grupo: "gluten" },
    alergia_trigo: { nome: "Alergia ao trigo", grupo: "trigo" },
    alergia_ovo: { nome: "Alergia ao ovo", grupo: "ovo" },
    alergia_soja: { nome: "Alergia à soja", grupo: "soja" },
    alergia_amendoim: { nome: "Alergia ao amendoim", grupo: "amendoim" },
    controle_glicose: { nome: "Controle de glicose", grupo: null }
  });
  var SITUACOES = Object.freeze({
    confirmada: "Confirmada por profissional",
    suspeita: "Suspeita, em investigação",
    orientacao_profissional: "Orientação profissional temporária",
    preferencia: "Preferência pessoal"
  });
  var FAIXAS = Object.freeze({ bebe: "Bebê", crianca: "Criança", adulto: "Adulto", idoso: "Pessoa idosa" });

  function normalizar(s) {
    return " " + String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").trim() + " ";
  }

  /* Termos por grupo, já sem acento. Frases de "não é deste grupo" são retiradas antes de procurar. */
  var TERMOS = {
    leite: ["leite", "leites", "lacteo", "lacteos", "lactea", "lacteas", "soro de leite", "soro do leite", "caseina", "caseinato", "caseinatos",
      "proteina do soro", "proteinas do soro", "whey", "lactoalbumina", "lactoglobulina", "manteiga", "nata", "creme de leite", "queijo", "queijos",
      "requeijao", "iogurte", "iogurtes", "coalhada", "ghee", "leitelho", "gordura lactea", "composto lacteo"],
    gluten: ["trigo", "centeio", "cevada", "malte", "extrato de malte", "aveia", "espelta", "triticale", "kamut", "semolina", "semola", "gluten"],
    trigo: ["trigo", "farinha de trigo", "semolina", "semola", "espelta", "triticale", "kamut", "gluten de trigo", "farelo de trigo", "germe de trigo"],
    ovo: ["ovo", "ovos", "clara de ovo", "gema", "gemas", "albumina", "ovoalbumina", "lisozima"],
    soja: ["soja", "lecitina de soja", "proteina de soja", "oleo de soja"],
    amendoim: ["amendoim", "amendoins"],
    lactose: ["lactose"]
  };
  var NAO_E = {
    leite: ["leite de coco", "leite de soja", "leite de amendoa", "leite de amendoas", "leite de aveia", "leite de arroz", "leite de castanha",
      "leite de castanhas", "leite vegetal", "manteiga de cacau", "manteiga de amendoim", "manteiga vegetal"],
    gluten: ["nao contem gluten", "sem gluten", "isento de gluten"],
    lactose: ["sem lactose", "zero lactose", "isento de lactose", "nao contem lactose", "baixo teor de lactose"]
  };

  function textoDe(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string"; }).join(" ; ") : (typeof v === "string" ? v : ""); }
  /* Devolve os termos do grupo encontrados no texto (lista ou string). */
  function encontrar(valor, grupo) {
    var t = normalizar(textoDe(valor));
    (NAO_E[grupo] || []).forEach(function (f) { t = t.split(" " + f + " ").join(" ; "); });
    var achados = [];
    (TERMOS[grupo] || []).forEach(function (termo) { if (t.indexOf(" " + termo + " ") >= 0 && achados.indexOf(termo) < 0) achados.push(termo); });
    return achados;
  }

  function dataValida(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z")); }
  function diasEntre(a, b) { return Math.floor((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000); }

  /* ---------- Perfis ---------- */
  function validarPerfil(p) {
    var erros = [];
    if (!p || typeof p !== "object") return { ok: false, erros: ["Perfil inexistente."] };
    if (typeof p.id !== "string" || !/^[a-z0-9_-]{3,64}$/i.test(p.id)) erros.push("ID de perfil inválido.");
    if (typeof p.apelido !== "string" || !p.apelido.trim() || p.apelido.trim().length > 60) erros.push("O apelido precisa ter de 1 a 60 letras.");
    else if (/\d{8,}/.test(p.apelido.replace(/[.\-\/\s]/g, ""))) erros.push("Não use números de documento no apelido.");
    if (p.faixaEtaria != null && p.faixaEtaria !== "" && !FAIXAS[p.faixaEtaria]) erros.push("Faixa etária inválida.");
    if (!Array.isArray(p.restricoes) || p.restricoes.length < 1) erros.push("Escolha pelo menos uma restrição.");
    else {
      var vistos = {};
      p.restricoes.forEach(function (r) {
        if (!r || !RESTRICOES[r.tipo]) { erros.push("Restrição não reconhecida."); return; }
        if (vistos[r.tipo]) erros.push("Restrição repetida: " + RESTRICOES[r.tipo].nome + ".");
        vistos[r.tipo] = 1;
        if (!SITUACOES[r.situacao]) erros.push("Diga a situação de: " + RESTRICOES[r.tipo].nome + ".");
      });
    }
    return { ok: erros.length === 0, erros: erros };
  }

  /* ---------- Formulário ---------- */
  var FORMULARIO = Object.freeze({
    versao: 1,
    campos: [
      { id: "apelido", tipo: "texto", obrigatorio: true, max: 60, rotulo: "Como quer chamar este perfil?", ajuda: "Um apelido basta. Não use nome completo nem documento." },
      { id: "faixaEtaria", tipo: "escolha", obrigatorio: false, opcoes: FAIXAS, rotulo: "Faixa etária (opcional)" },
      { id: "restricoes", tipo: "varias", obrigatorio: true, opcoes: RESTRICOES, rotulo: "O que deseja acompanhar?", ajuda: "Pode marcar mais de uma. Não precisa ter diagnóstico para consultar." },
      { id: "situacoes", tipo: "escolha-por-item", obrigatorio: true, opcoes: SITUACOES, rotulo: "Situação de cada restrição" },
      { id: "guardar", tipo: "confirmacao", obrigatorio: false, rotulo: "Guardar este perfil neste aparelho", ajuda: "Sem marcar, o perfil some ao fechar a página. Nada é enviado para a internet." }
    ]
  });
  var INFOS = Object.freeze({
    info_aplv_lactose: "APLV e intolerância à lactose são coisas diferentes. \"Sem lactose\" não quer dizer sem proteína do leite.",
    info_celiaca_trigo: "Doença celíaca e alergia ao trigo são diferentes. Para celíaca, o app olha a declaração de glúten do rótulo e cereais como trigo, centeio, cevada, malte e aveia.",
    info_glicose: "O app não prevê glicemia. Para controle de glicose ele só mostra informação, sem avaliar.",
    info_bebe_formula: "O app não escolhe nem indica fórmula infantil. Isso é com o profissional que acompanha o bebê."
  });
  function infosVisiveis(d) {
    var r = (d && d.restricoes) || [], v = [];
    if (r.indexOf("aplv") >= 0 || r.indexOf("lactose") >= 0) v.push("info_aplv_lactose");
    if (r.indexOf("celiaca") >= 0 || r.indexOf("alergia_trigo") >= 0) v.push("info_celiaca_trigo");
    if (r.indexOf("controle_glicose") >= 0) v.push("info_glicose");
    if (d && d.faixaEtaria === "bebe") v.push("info_bebe_formula");
    return v;
  }
  function novoId() { return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  /* Converte o que veio do formulário em perfil. Erros por campo, para mostrar ao lado de cada um. */
  function validarFormulario(d) {
    d = d || {};
    var erros = {}, restricoes = Array.isArray(d.restricoes) ? d.restricoes.filter(function (t, i, a) { return a.indexOf(t) === i; }) : [];
    var apelido = typeof d.apelido === "string" ? d.apelido.trim() : "";
    if (!apelido) erros.apelido = "Escreva um apelido.";
    else if (apelido.length > 60) erros.apelido = "Use até 60 letras.";
    else if (/\d{8,}/.test(apelido.replace(/[.\-\/\s]/g, ""))) erros.apelido = "Não use números de documento.";
    if (d.faixaEtaria && !FAIXAS[d.faixaEtaria]) erros.faixaEtaria = "Escolha uma das opções.";
    if (!restricoes.length) erros.restricoes = "Marque pelo menos uma.";
    else if (restricoes.some(function (t) { return !RESTRICOES[t]; })) erros.restricoes = "Opção desconhecida.";
    var sit = d.situacoes || {}, falta = restricoes.filter(function (t) { return RESTRICOES[t] && !SITUACOES[sit[t]]; });
    if (falta.length) erros.situacoes = "Diga a situação de: " + falta.map(function (t) { return RESTRICOES[t].nome; }).join(", ") + ".";
    var perfil = {
      id: typeof d.id === "string" && /^[a-z0-9_-]{3,64}$/i.test(d.id) ? d.id : novoId(),
      apelido: apelido, faixaEtaria: d.faixaEtaria || null,
      restricoes: restricoes.map(function (t) { return { tipo: t, situacao: sit[t] || null }; }),
      versao: VERSAO_PERFIS
    };
    var ok = Object.keys(erros).length === 0;
    if (ok) { var v = validarPerfil(perfil); if (!v.ok) { erros.geral = v.erros.join(" "); ok = false; } }
    return { ok: ok, erros: erros, perfil: ok ? perfil : null, infos: infosVisiveis(d) };
  }

  /* ---------- Rótulo ---------- */
  function validarRotulo(r) {
    var erros = [];
    if (!r || typeof r !== "object") return { ok: false, erros: ["Rótulo ausente."] };
    if (r.ean != null && r.ean !== "" && !/^(\d{8}|\d{12,14})$/.test(String(r.ean))) erros.push("Código de barras com formato inválido.");
    if (r.ingredientes != null && !Array.isArray(r.ingredientes) && typeof r.ingredientes !== "string") erros.push("Ingredientes em formato inválido.");
    if (r.declaracaoGluten != null && ["contem", "nao_contem", "nao_informado", "contraditorio"].indexOf(r.declaracaoGluten) < 0) erros.push("Declaração de glúten inválida.");
    if (r.declaracaoLactose != null && ["contem_lactose", "sem_lactose", "nao_informado", "contraditorio"].indexOf(r.declaracaoLactose) < 0) erros.push("Declaração de lactose inválida.");
    return { ok: erros.length === 0, erros: erros };
  }
  function fonteOk(r, hoje) {
    var f = r.fonte;
    if (!f || !f.identificacao || !dataValida(f.dataVerificacao)) return "sem fonte identificada e datada";
    if (f.desatualizada) return "fonte marcada como desatualizada";
    if (r.conflitoFontes) return "fontes com informações diferentes";
    if (hoje && diasEntre(f.dataVerificacao, hoje) > IDADE_MAX_FONTE_DIAS) return "fonte conferida há mais de " + IDADE_MAX_FONTE_DIAS + " dias";
    if (hoje && diasEntre(f.dataVerificacao, hoje) < 0) return "data da fonte no futuro";
    return "";
  }
  function res(tipo, estado, motivos, trechos) { return { restricao: tipo, nome: RESTRICOES[tipo] ? RESTRICOES[tipo].nome : tipo, estado: estado, texto: TEXTO_ESTADO[estado], motivos: motivos, trechos: trechos || [] }; }

  function analisarRestricao(r, rot, hoje) {
    var tipo = r.tipo, info = RESTRICOES[tipo];
    var ing = rot.ingredientes, contem = rot.advertencias && rot.advertencias.contem, pode = rot.advertencias && rot.advertencias.podeConter;
    var problemaFonte = fonteOk(rot, hoje);
    var completo = !!(rot.ingredientesCompletos && rot.advertenciasCompletas) && !problemaFonte;
    var falta = !rot.ingredientesCompletos ? "lista de ingredientes incompleta" : !rot.advertenciasCompletas ? "advertências de alergênicos incompletas" : problemaFonte;
    if (!info) return res(tipo, ESTADOS.INSUFICIENTE, ["Restrição sem política revisada."]);
    if (tipo === "controle_glicose") return res(tipo, ESTADOS.INFORMATIVO, ["O rótulo sozinho não prevê a resposta glicêmica de cada pessoa."]);

    if (tipo === "lactose") {
      var lacIng = encontrar(ing, "lactose"), lacAdv = encontrar(contem, "lactose"), leiteIng = encontrar(ing, "leite");
      if (rot.declaracaoLactose === "contraditorio") return res(tipo, ESTADOS.INSUFICIENTE, ["Declarações de lactose contraditórias."]);
      if (rot.declaracaoLactose === "sem_lactose" && (lacIng.length || lacAdv.length)) return res(tipo, ESTADOS.INSUFICIENTE, ["Diz \"sem lactose\", mas a lactose aparece no rótulo."], lacIng.concat(lacAdv));
      if (rot.declaracaoLactose === "contem_lactose" || lacIng.length || lacAdv.length) return res(tipo, ESTADOS.INCOMPATIVEL, ["Declaração ou ingrediente com lactose."], lacIng.concat(lacAdv));
      if (encontrar(pode, "lactose").length || encontrar(pode, "leite").length) return res(tipo, ESTADOS.CONTAMINACAO, ["O rótulo avisa que pode conter leite ou lactose."]);
      if (rot.declaracaoLactose !== "sem_lactose") return res(tipo, ESTADOS.INSUFICIENTE, [leiteIng.length ? "Tem leite e o rótulo não declara \"sem lactose\"." : "O rótulo não declara a lactose."], leiteIng);
      if (!completo) return res(tipo, ESTADOS.INSUFICIENTE, ["Falta conferir: " + falta + "."]);
      return res(tipo, ESTADOS.NAO_IDENTIFICADO, ["O rótulo declara \"sem lactose\". Isso não diz nada sobre APLV."]);
    }

    if (tipo === "celiaca") {
      var gIng = encontrar(ing, "gluten"), gAdv = encontrar(contem, "gluten"), gPode = encontrar(pode, "gluten"), decl = rot.declaracaoGluten || "nao_informado";
      if (decl === "contem" || gIng.length || gAdv.length) {
        var m = ["Declaração de glúten ou ingrediente com cereal ligado ao glúten."];
        if (decl === "nao_contem") m.push("Atenção: o rótulo diz \"não contém glúten\", mas lista ingrediente com glúten. Vale o alerta.");
        return res(tipo, ESTADOS.INCOMPATIVEL, m, gIng.concat(gAdv));
      }
      if (decl === "contraditorio") return res(tipo, ESTADOS.INSUFICIENTE, ["Declarações de glúten contraditórias."]);
      if (gPode.length) return res(tipo, ESTADOS.CONTAMINACAO, ["O rótulo avisa possível contaminação com glúten."], gPode);
      if (decl !== "nao_contem") return res(tipo, ESTADOS.INSUFICIENTE, ["Falta a declaração \"contém\" ou \"não contém glúten\"."]);
      if (!completo) return res(tipo, ESTADOS.INSUFICIENTE, ["Falta conferir: " + falta + "."]);
      return res(tipo, ESTADOS.NAO_IDENTIFICADO, ["O rótulo conferido declara \"não contém glúten\"."]);
    }

    var g = info.grupo, aIng = encontrar(ing, g), aAdv = encontrar(contem, g);
    if (aIng.length || aAdv.length) return res(tipo, ESTADOS.INCOMPATIVEL, ["Ingrediente ou advertência ligada a " + g + "."], aIng.concat(aAdv));
    var aPode = encontrar(pode, g);
    if (aPode.length) return res(tipo, ESTADOS.CONTAMINACAO, ["O rótulo avisa que pode conter " + g + "."], aPode);
    if (tipo === "aplv") {
      var lac = encontrar(ing, "lactose").concat(encontrar(contem, "lactose"));
      if (lac.length) return res(tipo, ESTADOS.PROFISSIONAL, ["A lactose vem do leite e pode trazer resto de proteína. Pergunte ao profissional."], lac);
    }
    if (!completo) return res(tipo, ESTADOS.INSUFICIENTE, ["Falta conferir: " + falta + "."]);
    return res(tipo, ESTADOS.NAO_IDENTIFICADO, ["Nada ligado a " + g + " nos dados conferidos. Isso não garante que seja seguro."]);
  }

  /* Resumo do rótulo para saber se o resultado ainda vale (mudou o rótulo, muda a evidência). */
  function evidencia(rot) {
    var s = JSON.stringify([textoDe(rot.ingredientes), textoDe(rot.advertencias && rot.advertencias.contem), textoDe(rot.advertencias && rot.advertencias.podeConter),
      rot.declaracaoGluten || "", rot.declaracaoLactose || "", rot.categoria || "", !!rot.ingredientesCompletos, !!rot.advertenciasCompletas,
      rot.fonte ? [rot.fonte.identificacao || "", rot.fonte.dataVerificacao || "", !!rot.fonte.desatualizada] : null, !!rot.conflitoFontes, rot.ean || ""]);
    var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return "ev-" + h.toString(36);
  }

  function analisar(perfil, rotulo, opcoes) {
    opcoes = opcoes || {};
    var vp = validarPerfil(perfil), vr = validarRotulo(rotulo);
    if (!vp.ok || !vr.ok) return { status: "INVALIDO", erros: vp.erros.concat(vr.erros), versaoMotor: VERSAO_MOTOR };
    var hoje = opcoes.hoje || null;
    var detalhes = perfil.restricoes.map(function (r) { return analisarRestricao(r, rotulo, hoje); });
    var geral = GRAVIDADE.filter(function (e) { return detalhes.some(function (d) { return d.estado === e; }); })[0] || ESTADOS.INSUFICIENTE;
    var formula = rotulo.categoria === "formula_infantil";
    if (formula && geral !== ESTADOS.INCOMPATIVEL && geral !== ESTADOS.CONTAMINACAO) geral = ESTADOS.PROFISSIONAL;
    return {
      status: geral, texto: TEXTO_ESTADO[geral], perfilId: perfil.id,
      produto: { nome: typeof rotulo.nome === "string" ? rotulo.nome : "", ean: rotulo.ean || null },
      detalhes: detalhes,
      aviso: formula ? "Fórmula infantil: o app não escolhe nem autoriza fórmula. Siga o profissional que acompanha o bebê."
        : "O resultado não garante que o produto seja seguro. Confira a embalagem atual e a orientação profissional.",
      evidencia: evidencia(rotulo), versaoMotor: VERSAO_MOTOR, versaoPolitica: VERSAO_POLITICA,
      carimbo: opcoes.agora || new Date().toISOString()
    };
  }
  /* Um resultado só continua valendo se perfil e rótulo forem os mesmos. Marcação manual não apaga alerta. */
  function resultadoValido(resultado, perfil, rotulo) {
    if (!resultado || !perfil || !rotulo) return false;
    return resultado.perfilId === perfil.id && resultado.evidencia === evidencia(rotulo) && resultado.versaoMotor === VERSAO_MOTOR &&
      resultado.assinaturaPerfil === assinaturaPerfil(perfil);
  }
  function assinaturaPerfil(p) { return (p.restricoes || []).map(function (r) { return r.tipo + ":" + r.situacao; }).sort().join("|"); }
  function analisarComAssinatura(perfil, rotulo, opcoes) { var r = analisar(perfil, rotulo, opcoes); if (r.status !== "INVALIDO") r.assinaturaPerfil = assinaturaPerfil(perfil); return r; }
  /* Trilha de auditoria sem dado sensível: nada de apelido, restrições ou ingredientes. */
  function registroAuditoria(r) {
    return { quando: r.carimbo, versaoMotor: r.versaoMotor, versaoPolitica: r.versaoPolitica, evidencia: r.evidencia, status: r.status, restricoesAvaliadas: (r.detalhes || []).length };
  }

  /* ---------- Gatilhos ---------- */
  var GATILHOS = Object.freeze({
    PERFIL_SALVO: { acao: "REAVALIAR_RESULTADOS_LOCAIS" },
    RESTRICAO_ALTERADA: { acao: "INVALIDAR_RESULTADOS_E_REAVALIAR" },
    PERFIL_EXCLUIDO: { acao: "EXCLUIR_DADOS_DO_PERFIL" },
    ROTULO_ATUALIZADO: { acao: "INVALIDAR_RESULTADO_E_REAVALIAR" },
    FONTE_DESATUALIZADA: { acao: "MARCAR_INFORMACAO_INSUFICIENTE" },
    SEM_INTERNET: { acao: "USAR_SO_DADOS_LOCAIS_COM_DATA" },
    COMPRA_SOLICITADA: { acao: "MOSTRAR_ALERTAS_SEM_BLOQUEAR_A_LISTA" },
    PESQUISA_SOLICITADA: { acao: "BUSCAR_PRODUTO_E_APLICAR_PERFIL", rede: true },
    CODIGO_LIDO: { acao: "CONSULTAR_FONTE_E_APLICAR_PERFIL", rede: true },
    ROTULO_FOTOGRAFADO: { acao: "EXTRAIR_PEDIR_CONFIRMACAO_E_APLICAR_PERFIL", rede: true }
  });
  /* handlers: { ACAO: function(ctx) }. Só eventos da lista; nada de gatilho dentro de gatilho;
     ação de rede só com pedido do usuário e fornecedor aprovado (no Marco 1, nunca). */
  function criarGatilhos(handlers, config) {
    handlers = handlers || {}; config = config || {};
    var rodando = false, registro = [];
    function anota(evento, acao, resultado) { var e = { evento: evento, acao: acao, resultado: resultado }; registro.push(e); if (registro.length > 50) registro.shift(); return e; }
    return {
      disparar: function (evento, ctx) {
        ctx = ctx || {};
        var g = Object.prototype.hasOwnProperty.call(GATILHOS, evento) ? GATILHOS[evento] : null;
        if (!g) return anota(String(evento).slice(0, 40), "IGNORAR", "evento fora da lista");
        if (rodando) return anota(evento, g.acao, "bloqueado: gatilho dentro de gatilho");
        if (g.rede && ctx.origem !== "usuario") return anota(evento, g.acao, "bloqueado: precisa de pedido do usuário");
        if (g.rede && !config.fornecedorAprovado) return anota(evento, g.acao, "bloqueado: nenhum fornecedor aprovado (Marco 2)");
        var fn = handlers[g.acao];
        if (typeof fn !== "function") return anota(evento, g.acao, "sem ação configurada");
        rodando = true;
        try { fn(ctx); return anota(evento, g.acao, "executado"); }
        catch (e) { return anota(evento, g.acao, "erro: " + String(e && e.message || e).slice(0, 80)); }
        finally { rodando = false; }
      },
      registro: function () { return registro.slice(); }
    };
  }

  /* ---------- Armazenamento (só com consentimento) ---------- */
  function estadoVazio() { return { formato: "elida-perfis", versao: VERSAO_PERFIS, perfis: [], ativo: null, guardar: false, consentidoEm: null }; }
  function migrarPerfis(o) {
    if (!o || typeof o !== "object" || o.formato !== "elida-perfis") return estadoVazio();
    var e = estadoVazio();
    e.perfis = Array.isArray(o.perfis) ? o.perfis.filter(function (p) { return validarPerfil(p).ok; }) : [];
    e.ativo = e.perfis.some(function (p) { return p.id === o.ativo; }) ? o.ativo : null;
    e.guardar = o.guardar === true; e.consentidoEm = o.guardar === true ? (o.consentidoEm || null) : null;
    return e;
  }
  function criarArmazem(storage, chave) {
    function ler() { try { return migrarPerfis(JSON.parse(storage.getItem(chave) || "null")); } catch (e) { return estadoVazio(); } }
    return {
      carregar: ler,
      /* Sem consentimento, nada fica no aparelho (e o que havia é apagado). */
      salvar: function (estado) {
        if (!estado || estado.guardar !== true) { try { storage.removeItem(chave); } catch (e) {} return false; }
        try { storage.setItem(chave, JSON.stringify(migrarPerfis(estado))); return true; } catch (e) { return false; }
      },
      excluirTudo: function () { try { storage.removeItem(chave); } catch (e) {} return estadoVazio(); }
    };
  }
  function excluirPerfil(estado, id) {
    var e = migrarPerfis(estado); e.guardar = !!(estado && estado.guardar); e.consentidoEm = estado && estado.consentidoEm || null;
    e.perfis = e.perfis.filter(function (p) { return p.id !== id; });
    if (e.ativo === id) e.ativo = null;
    return e;
  }
  function exportar(estado) { return JSON.stringify(migrarPerfis(estado), null, 2); }

  return Object.freeze({
    VERSAO_MOTOR: VERSAO_MOTOR, VERSAO_POLITICA: VERSAO_POLITICA, VERSAO_PERFIS: VERSAO_PERFIS, IDADE_MAX_FONTE_DIAS: IDADE_MAX_FONTE_DIAS,
    ESTADOS: ESTADOS, TEXTO_ESTADO: TEXTO_ESTADO, GRAVIDADE: GRAVIDADE, RESTRICOES: RESTRICOES, SITUACOES: SITUACOES, FAIXAS: FAIXAS,
    FORMULARIO: FORMULARIO, INFOS: INFOS, GATILHOS: GATILHOS,
    normalizar: normalizar, encontrar: encontrar,
    validarPerfil: validarPerfil, validarFormulario: validarFormulario, infosVisiveis: infosVisiveis,
    validarRotulo: validarRotulo, analisar: analisarComAssinatura, resultadoValido: resultadoValido, evidencia: evidencia, registroAuditoria: registroAuditoria,
    criarGatilhos: criarGatilhos, criarArmazem: criarArmazem, migrarPerfis: migrarPerfis, excluirPerfil: excluirPerfil, exportar: exportar, estadoVazio: estadoVazio
  });
});
