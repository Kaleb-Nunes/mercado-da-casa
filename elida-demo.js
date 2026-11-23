/* Elida · demonstração e radar de mudança de fórmula.
   Camada de apresentação sobre o motor de regras (elida-regras.js). Este arquivo NÃO decide nada
   clínico: ele só (1) monta rótulos e perfis de DEMONSTRAÇÃO, claramente fictícios, (2) roda o motor
   real para cada pessoa da casa, (3) compara duas versões de um mesmo rótulo e (4) traduz o estado do
   motor em cor e frase. A frase "seguro" não existe aqui: o melhor resultado possível continua sendo
   "nada encontrado nos dados conferidos", que não garante nada.
   Sem rede, sem armazenamento, sem dados reais. Não validado clinicamente. */
(function (raiz, fabrica) {
  "use strict";
  var api = fabrica(typeof module === "object" && module.exports ? require("./elida-regras.js") : raiz.ElidaRegras);
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ElidaDemo = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (IA) {
  "use strict";

  var VERSAO = "demo-2026.11.22";
  var ESTADOS = IA.ESTADOS;

  /* ---------- Níveis: só apresentação, derivados do que a pessoa declarou ---------- */
  /* O motor não modela "gravidade clínica" nem anafilaxia. Aqui o nível vem apenas do tipo da
     restrição e da situação informada: alergia ou doença confirmada, intolerância ou suspeita,
     preferência. Isso muda a cor do aviso, nunca o que o motor encontrou. */
  var NIVEIS = Object.freeze({
    alergia: { chave: "alergia", ordem: 3, rotulo: "Alergia ou doença" },
    intolerancia: { chave: "intolerancia", ordem: 2, rotulo: "Intolerância ou suspeita" },
    preferencia: { chave: "preferencia", ordem: 1, rotulo: "Preferência" }
  });
  var TIPOS_ALERGIA = { aplv: 1, celiaca: 1, alergia_trigo: 1, alergia_ovo: 1, alergia_soja: 1, alergia_amendoim: 1 };

  function nivelRestricao(r) {
    if (!r || r.situacao === "preferencia" || r.tipo === "controle_glicose") return NIVEIS.preferencia;
    if (TIPOS_ALERGIA[r.tipo] && r.situacao === "confirmada") return NIVEIS.alergia;
    return NIVEIS.intolerancia;
  }
  function nivelPerfil(perfil) {
    var rs = (perfil && perfil.restricoes) || [], melhor = NIVEIS.preferencia;
    rs.forEach(function (r) { var n = nivelRestricao(r); if (n.ordem > melhor.ordem) melhor = n; });
    return melhor;
  }

  /* ---------- Tom visual de cada estado ---------- */
  /* risco = vermelho · atencao = âmbar · falta = cinza · neutro = azul-acinzentado · ok = verde.
     Verde quer dizer "nada encontrado nos dados conferidos". Não quer dizer "seguro". */
  var ORDEM_TOM = ["risco", "atencao", "falta", "neutro", "ok"];
  var ROTULO_TOM = Object.freeze({
    risco: "Evitar",
    atencao: "Atenção",
    falta: "Faltam dados",
    neutro: "Só informativo",
    ok: "Nada encontrado"
  });
  function tom(estado, nivel) {
    nivel = nivel || NIVEIS.intolerancia;
    if (estado === ESTADOS.INCOMPATIVEL) return nivel.chave === "preferencia" ? "atencao" : "risco";
    if (estado === ESTADOS.CONTAMINACAO) return nivel.chave === "alergia" ? "risco" : "atencao";
    if (estado === ESTADOS.PROFISSIONAL) return "atencao";
    if (estado === ESTADOS.INSUFICIENTE) return "falta";
    if (estado === ESTADOS.INFORMATIVO) return "neutro";
    return "ok";
  }
  function piorTom(tons) {
    for (var i = 0; i < ORDEM_TOM.length; i++) if (tons.indexOf(ORDEM_TOM[i]) >= 0) return ORDEM_TOM[i];
    return "falta";
  }
  function frasePorTom(t, nivel) {
    if (t === "risco") return nivel && nivel.chave === "alergia" ? "Tem algo que essa pessoa precisa evitar" : "Tem algo que precisa ser evitado";
    if (t === "atencao") return nivel && nivel.chave === "preferencia" ? "Fora da preferência dessa pessoa" : "Pede atenção antes de comprar";
    if (t === "falta") return "Faltam dados: confira a embalagem";
    if (t === "neutro") return "O app só mostra: não avalia isso";
    return "Nada encontrado nos dados conferidos";
  }

  /* ---------- Glossário dos "nomes disfarçados" ---------- */
  /* Cada termo vem da mesma lista que o motor usa para encontrar; aqui só há a explicação em palavras simples. */
  var EXPLICACOES = Object.freeze({
    "soro de leite": "Soro de leite é a parte líquida do leite. Traz proteína do leite e, em geral, lactose.",
    "soro do leite": "Soro do leite é a parte líquida do leite. Traz proteína do leite e, em geral, lactose.",
    "proteina do soro": "Proteína do soro é proteína do leite.",
    "proteinas do soro": "Proteína do soro é proteína do leite.",
    "whey": "Whey é o nome em inglês do soro de leite.",
    "caseina": "Caseína é a principal proteína do leite.",
    "caseinato": "Caseinato vem da caseína, a proteína do leite.",
    "caseinatos": "Caseinato vem da caseína, a proteína do leite.",
    "lactoalbumina": "Lactoalbumina é uma proteína do leite.",
    "lactoglobulina": "Lactoglobulina é uma proteína do leite.",
    "leite": "Leite e derivados contêm proteína do leite e lactose.",
    "lacteo": "Lácteo quer dizer derivado do leite.",
    "composto lacteo": "Composto lácteo é uma mistura que leva derivados do leite.",
    "gordura lactea": "Gordura láctea é a gordura do leite.",
    "manteiga": "Manteiga é derivada do leite.",
    "queijo": "Queijo é derivado do leite.",
    "malte": "Malte costuma vir da cevada, que tem glúten.",
    "extrato de malte": "Extrato de malte costuma vir da cevada, que tem glúten.",
    "cevada": "Cevada é um cereal com glúten.",
    "centeio": "Centeio é um cereal com glúten.",
    "gluten": "Glúten é a proteína do trigo, da cevada e do centeio.",
    "ovo": "Ovo é um dos alérgenos que a embalagem precisa destacar.",
    "clara de ovo": "Clara de ovo é parte do ovo.",
    "albumina": "Albumina costuma vir da clara do ovo.",
    "trigo": "Trigo tem glúten.",
    "farinha de trigo": "Farinha de trigo tem glúten.",
    "aveia": "Aveia entra na lista do glúten por risco de contaminação durante o processo.",
    "semolina": "Semolina é feita de trigo.",
    "amendoim": "Amendoim é um dos alérgenos que a embalagem precisa destacar.",
    "lecitina de soja": "Lecitina de soja é um ingrediente que vem da soja.",
    "soja": "Soja é um dos alérgenos que a embalagem precisa destacar.",
    "lactose": "Lactose é o açúcar do leite."
  });
  function explicar(termo) {
    var t = String(termo || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    return EXPLICACOES[t] || "";
  }

  /* ---------- Perfis de demonstração (fictícios) ---------- */
  var PERFIS = Object.freeze([
    { id: "demo-ana", apelido: "Ana", papel: "Mãe", faixaEtaria: "adulto", restricoes: [{ tipo: "lactose", situacao: "confirmada" }] },
    { id: "demo-theo", apelido: "Théo", papel: "Filho", faixaEtaria: "crianca", restricoes: [{ tipo: "alergia_amendoim", situacao: "confirmada" }] },
    { id: "demo-caio", apelido: "Caio", papel: "Pai", faixaEtaria: "adulto", restricoes: [{ tipo: "controle_glicose", situacao: "preferencia" }] },
    { id: "demo-vera", apelido: "Vovó Vera", papel: "Avó", faixaEtaria: "idoso", restricoes: [{ tipo: "celiaca", situacao: "confirmada" }] }
  ]);

  /* ---------- Produtos de demonstração ---------- */
  /* Rótulos fictícios, escritos para ensinar. Não são de nenhuma marca. Cada produto tem a versão
     anterior (a que a família guardou) e a atual (a que está na prateleira hoje). */
  function rotulo(nome, ingredientes, contem, podeConter, hoje, extra) {
    var r = {
      nome: nome, categoria: "alimento", ingredientes: ingredientes,
      advertencias: { contem: contem, podeConter: podeConter },
      ingredientesCompletos: true, advertenciasCompletas: true,
      fonte: { identificacao: "Rótulo de demonstração fictício", dataVerificacao: hoje }
    };
    if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
    return r;
  }
  function produtos(hoje) {
    return [
      {
        id: "biscoito", nome: "Biscoito recheado de chocolate", detalhe: "Exemplo fictício · pacote 140 g", icone: "biscoito",
        anterior: rotulo("Biscoito recheado de chocolate (versão anterior)",
          ["açúcar", "farinha de trigo enriquecida com ferro e ácido fólico", "gordura vegetal", "cacau em pó", "amido", "sal", "fermentos químicos", "emulsificante lecitina de soja", "aromatizante"],
          "Trigo e soja. Contém glúten.", "", hoje, { declaracaoGluten: "contem", declaracaoLactose: "sem_lactose" }),
        atual: rotulo("Biscoito recheado de chocolate (versão atual)",
          ["açúcar", "farinha de trigo enriquecida com ferro e ácido fólico", "gordura vegetal", "soro de leite em pó", "cacau em pó", "amido", "sal", "fermentos químicos", "emulsificante lecitina de soja", "aromatizante"],
          "Trigo, leite e soja. Contém glúten. Contém lactose.", "amendoim", hoje, { declaracaoGluten: "contem", declaracaoLactose: "contem_lactose" })
      },
      {
        id: "pao", nome: "Pão de forma integral", detalhe: "Exemplo fictício · pacote 500 g", icone: "pao",
        anterior: rotulo("Pão de forma integral (versão anterior)",
          ["farinha de trigo integral", "água", "açúcar mascavo", "fermento biológico", "sal", "óleo de soja", "vinagre", "conservador propionato de cálcio"],
          "Trigo e soja. Contém glúten.", "", hoje, { declaracaoGluten: "contem" }),
        atual: rotulo("Pão de forma integral (versão atual)",
          ["farinha de trigo integral", "água", "açúcar mascavo", "fermento biológico", "sal", "óleo de soja", "caseinato de sódio", "vinagre", "conservador propionato de cálcio"],
          "Trigo, leite e soja. Contém glúten.", "", hoje, { declaracaoGluten: "contem" })
      },
      {
        id: "achocolatado", nome: "Achocolatado em pó", detalhe: "Exemplo fictício · pote 400 g", icone: "achocolatado",
        anterior: rotulo("Achocolatado em pó (versão anterior)",
          ["açúcar", "cacau em pó", "maltodextrina", "minerais (ferro e zinco)", "vitaminas", "sal", "emulsificante lecitina de soja", "aromatizante"],
          "Soja. Não contém glúten.", "", hoje, { declaracaoGluten: "nao_contem", declaracaoLactose: "sem_lactose" }),
        atual: rotulo("Achocolatado em pó (versão atual)",
          ["açúcar", "cacau em pó", "maltodextrina", "extrato de malte", "minerais (ferro e zinco)", "vitaminas", "sal", "emulsificante lecitina de soja", "aromatizante"],
          "Soja.", "", hoje, { declaracaoGluten: "nao_informado", declaracaoLactose: "sem_lactose" })
      }
    ];
  }

  /* ---------- Análise da casa ---------- */
  /* Analisa o mesmo rótulo para todas as pessoas escolhidas e devolve uma linha por pessoa, com a pior situação no topo. */
  function analisarCasa(perfis, rot, opcoes) {
    opcoes = opcoes || {};
    var linhas = (perfis || []).map(function (p) {
      var a = IA.analisar(p, rot, { hoje: opcoes.hoje, agora: opcoes.agora });
      var nivel = nivelPerfil(p);
      if (a.status === "INVALIDO") return { perfil: p, nivel: nivel, analise: a, tom: "falta", estado: ESTADOS.INSUFICIENTE, frase: "Não foi possível analisar", detalhes: [], achados: [] };
      var t = tom(a.status, nivel);
      var achados = [];
      a.detalhes.forEach(function (d) { (d.trechos || []).forEach(function (x) { if (achados.indexOf(x) < 0) achados.push(x); }); });
      return { perfil: p, nivel: nivel, analise: a, tom: t, estado: a.status, frase: frasePorTom(t, nivel), detalhes: a.detalhes, achados: achados };
    });
    linhas.sort(function (x, y) { return ORDEM_TOM.indexOf(x.tom) - ORDEM_TOM.indexOf(y.tom); });
    var contagem = { risco: 0, atencao: 0, falta: 0, neutro: 0, ok: 0 };
    linhas.forEach(function (l) { contagem[l.tom]++; });
    var geral = piorTom(linhas.map(function (l) { return l.tom; }));
    return { geral: geral, linhas: linhas, contagem: contagem, resumo: resumoCasa(linhas), evidencia: linhas.length ? linhas[0].analise.evidencia : null };
  }
  function nomes(lista) {
    var n = lista.map(function (l) { return l.perfil.apelido; });
    return n.length < 2 ? n.join("") : n.slice(0, -1).join(", ") + " e " + n[n.length - 1];
  }
  /* Quem está em cada faixa. O título da tela já diz quantas pessoas precisam evitar; aqui entram os nomes. */
  function resumoCasa(linhas) {
    if (!linhas.length) return "Escolha quem vai comer para ver o resultado da casa.";
    var rot = { risco: "Evitar", atencao: "Atenção", falta: "Faltam dados", neutro: "Só informativo", ok: "Nada encontrado" };
    return ORDEM_TOM.map(function (t) {
      var g = linhas.filter(function (l) { return l.tom === t; });
      return g.length ? rot[t] + ": " + nomes(g) : "";
    }).filter(Boolean).join(" · ");
  }

  /* ---------- Diferença entre duas versões ---------- */
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function listaIngredientes(r) {
    var i = r && r.ingredientes;
    var itens = Array.isArray(i) ? i : String(i || "").split(/[,;\n]/);
    return itens.map(function (x) { return String(x).trim(); }).filter(Boolean);
  }
  function termosAviso(texto) {
    var t = Array.isArray(texto) ? texto.join(" , ") : String(texto || "");
    return t.split(/[,;.]| e /i).map(function (x) { return x.trim(); }).filter(function (x) { return x && !/contem gluten|^contem$/i.test(norm(x)); });
  }
  function diferenca(anterior, atual) {
    var a = listaIngredientes(anterior), b = listaIngredientes(atual);
    var na = a.map(norm), nb = b.map(norm);
    var entrou = b.filter(function (x, i) { return na.indexOf(nb[i]) < 0; });
    var saiu = a.filter(function (x, i) { return nb.indexOf(na[i]) < 0; });
    function avisos(r, campo) { return termosAviso(r && r.advertencias && r.advertencias[campo]); }
    function novos(campo) {
      var antes = avisos(anterior, campo).map(norm);
      return avisos(atual, campo).filter(function (x) { return antes.indexOf(norm(x)) < 0; });
    }
    function sumidos(campo) {
      var depois = avisos(atual, campo).map(norm);
      return avisos(anterior, campo).filter(function (x) { return depois.indexOf(norm(x)) < 0; });
    }
    var d = {
      ingredientesNovos: entrou, ingredientesRetirados: saiu,
      contemNovos: novos("contem"), contemRetirados: sumidos("contem"),
      podeConterNovos: novos("podeConter"), podeConterRetirados: sumidos("podeConter")
    };
    d.mudou = !!(entrou.length || saiu.length || d.contemNovos.length || d.contemRetirados.length || d.podeConterNovos.length || d.podeConterRetirados.length);
    return d;
  }

  /* Compara as duas versões para cada pessoa: o que era, o que passou a ser e se piorou. */
  function comparar(perfis, anterior, atual, opcoes) {
    var antes = analisarCasa(perfis, anterior, opcoes), agora = analisarCasa(perfis, atual, opcoes);
    var impactos = agora.linhas.map(function (l) {
      var l0 = antes.linhas.filter(function (x) { return x.perfil.id === l.perfil.id; })[0];
      var de = l0 ? l0.tom : "falta", para = l.tom;
      return {
        perfil: l.perfil, nivel: l.nivel, de: de, para: para,
        piorou: ORDEM_TOM.indexOf(para) < ORDEM_TOM.indexOf(de),
        melhorou: ORDEM_TOM.indexOf(para) > ORDEM_TOM.indexOf(de),
        achados: l.achados.filter(function (x) { return !l0 || l0.achados.indexOf(x) < 0; })
      };
    });
    /* "Relevante" = piorou, ou entrou algo que o motor reconhece para aquela pessoa (mesmo sem mudar de cor). */
    impactos.forEach(function (i) { i.relevante = i.piorou || i.achados.length > 0; });
    return { diferenca: diferenca(anterior, atual), antes: antes, agora: agora, impactos: impactos,
      piorou: impactos.some(function (i) { return i.piorou; }), relevante: impactos.some(function (i) { return i.relevante; }) };
  }

  /* Termos novos que o motor reconhece como "nome disfarçado", com a explicação para cada um. */
  function disfarcados(diff) {
    var vistos = {}, saida = [];
    ([].concat(diff.ingredientesNovos, diff.contemNovos, diff.podeConterNovos)).forEach(function (txt) {
      ["leite", "gluten", "trigo", "ovo", "soja", "amendoim", "lactose"].forEach(function (grupo) {
        IA.encontrar(txt, grupo).forEach(function (termo) {
          var e = explicar(termo);
          if (e && !vistos[termo]) { vistos[termo] = 1; saida.push({ termo: termo, texto: txt, explicacao: e }); }
        });
      });
    });
    return saida;
  }


  /* ---------- Quem é afetado por qual termo ---------- */
  /* Grupos de termos que cada restrição acompanha (os mesmos grupos que o motor usa para encontrar). */
  var GRUPOS_RESTRICAO = Object.freeze({
    aplv: ["leite", "lactose"], lactose: ["lactose", "leite"], celiaca: ["gluten"], alergia_trigo: ["trigo"],
    alergia_ovo: ["ovo"], alergia_soja: ["soja"], alergia_amendoim: ["amendoim"], controle_glicose: []
  });
  function gruposDoPerfil(perfil) {
    var g = [];
    ((perfil && perfil.restricoes) || []).forEach(function (r) { (GRUPOS_RESTRICAO[r.tipo] || []).forEach(function (x) { if (g.indexOf(x) < 0) g.push(x); }); });
    return g;
  }
  function termosNoTexto(texto, grupos) {
    var achados = [];
    grupos.forEach(function (g) { IA.encontrar(texto, g).forEach(function (t) { if (achados.indexOf(t) < 0) achados.push(t); }); });
    return achados;
  }
  /* Termo mais específico primeiro ("soro de leite" antes de "leite"). */
  function termoPrincipal(texto) {
    var todos = termosNoTexto(texto, ["leite", "lactose", "gluten", "trigo", "ovo", "soja", "amendoim"]);
    todos.sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < todos.length; i++) if (explicar(todos[i])) return todos[i];
    return todos[0] || "";
  }
  /* Pessoas (já analisadas em comparar) que o trecho de texto afeta. */
  function afetados(impactos, texto) {
    return impactos.filter(function (i) { return i.relevante && termosNoTexto(texto, gruposDoPerfil(i.perfil)).length > 0; });
  }
  /* Mapa termo -> tom para destacar no rótulo: só o que cada pessoa da casa acompanha, com a cor da situação dela. */
  function termosDestacar(casa, rot) {
    var mapa = {}, campos = [rot.ingredientes, rot.advertencias && rot.advertencias.contem, rot.advertencias && rot.advertencias.podeConter];
    var textoTudo = campos.map(function (c) { return Array.isArray(c) ? c.join(" ; ") : String(c || ""); }).join(" ; ");
    casa.linhas.forEach(function (l) {
      termosNoTexto(textoTudo, gruposDoPerfil(l.perfil)).forEach(function (t) { mapa[t] = piorTom([mapa[t] || "ok", l.tom]); });
    });
    return mapa;
  }

  /* ---------- Simulação pronta para a tela ---------- */
  function simular(opcoes) {
    opcoes = opcoes || {};
    var hoje = opcoes.hoje;
    var lista = produtos(hoje);
    var p = lista.filter(function (x) { return x.id === opcoes.produtoId; })[0] || lista[0];
    var ids = Array.isArray(opcoes.perfilIds) ? opcoes.perfilIds : PERFIS.map(function (x) { return x.id; });
    var perfis = PERFIS.filter(function (x) { return ids.indexOf(x.id) >= 0; });
    var cmp = comparar(perfis, p.anterior, p.atual, { hoje: hoje });
    var versao = opcoes.versao === "anterior" ? "anterior" : "atual";
    return {
      produto: p, versao: versao, perfis: perfis,
      rotulo: p[versao], casa: versao === "atual" ? cmp.agora : cmp.antes,
      comparacao: cmp, disfarcados: disfarcados(cmp.diferenca)
    };
  }

  return Object.freeze({
    VERSAO: VERSAO, NIVEIS: NIVEIS, ROTULO_TOM: ROTULO_TOM, ORDEM_TOM: ORDEM_TOM,
    PERFIS: PERFIS, produtos: produtos,
    nivelRestricao: nivelRestricao, nivelPerfil: nivelPerfil, tom: tom, frasePorTom: frasePorTom, piorTom: piorTom,
    explicar: explicar, normalizar: norm, encontrarTermos: IA.encontrar, gruposDoPerfil: gruposDoPerfil, termoPrincipal: termoPrincipal, afetados: afetados, termosDestacar: termosDestacar, analisarCasa: analisarCasa, diferenca: diferenca, comparar: comparar, disfarcados: disfarcados, simular: simular
  });
});
