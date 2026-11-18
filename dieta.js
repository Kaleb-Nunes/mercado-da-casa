/* Motor da dieta do app Elida.

   Cada item recebe uma de três respostas:
   - "evitar":       o nome do item tem um termo da lista da dieta;
   - "conferido":    alguém da casa leu o rótulo e marcou que não achou nada da lista;
   - "insuficiente": o padrão. Só pelo nome não dá para saber.

   O motor nunca diz que um alimento é seguro. "Conferido" registra uma ação de
   uma pessoa (quem leu o rótulo e quando), não uma avaliação do app.

   A lista de termos do modelo "sem leite" AINDA NÃO FOI REVISADA por profissional
   de saúde. Ela é um lembrete da orientação médica, não substitui a leitura do rótulo.

   Funciona no navegador (window.DietaMotor) e no Node (require), para os testes
   rodarem contra o mesmo código que o app usa. */
(function (raiz, fabrica) {
  "use strict";
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.DietaMotor = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Prazo de validade de uma conferência de rótulo. Receitas mudam.
     Valor provisório: deve ser definido pelo profissional de saúde. */
  var VALIDADE_CONFERENCIA_DIAS = 180;

  var AVISO_FIXO = "O app só olha o nome do item: não lê os ingredientes nem as advertências do rótulo. Os avisos são um lembrete da orientação médica e não dizem que um alimento é seguro. Sempre leia o rótulo inteiro.";
  var AVISO_CURTO = "Leia o rótulo.";

  /* Sintaxe dos termos:
     - palavra ou frase inteira: "nata", "creme de leite";
     - "*" no fim: a última palavra pode continuar ("leite*" pega leite, leitelho, LeiteNinho). */
  var MODELO_SEM_LEITE = {
    id: "sem-leite",
    versao: "2026-11-18.1",
    nome: "Sem leite (proteína do leite de vaca)",
    acaoConferir: "Li o rótulo: não tem leite",
    revisao: { status: "pendente", profissional: "", registro: "", data: "" },
    grupos: [
      { nome: "Leite e palavras com leite", termos: [
        "leite*", "lácte*", "lactos*", "laticín*", "lacticín*", "proteína do soro", "proteínas do soro", "whey"] },
      { nome: "Proteínas e gorduras do leite", termos: [
        "caseín*", "lactoalbumin*", "lactoglobulin*", "lactoferrin*", "manteiga*", "ghee", "nata",
        "chantilly", "chantili", "molho branco", "bechamel"] },
      { nome: "Queijos e fermentados", termos: [
        "queij*", "requeij*", "mussarel*", "muçarel*", "muzzarel*", "mozzarel*", "parmes*", "ricota", "ricotta",
        "provolone", "cheddar", "gorgonzola", "gouda", "brie", "camembert", "emmental", "gruyère", "pecorino",
        "grana padano", "mascarpone", "burrata", "cottage", "catupiry", "polenguinho", "coalhada", "coalho", "kefir",
        "iogurt*", "yogurt*", "yoghurt*", "petit suisse", "danoninho", "yakult"] },
      { nome: "Doces feitos com leite", termos: [
        "pudim", "pudins", "brigadeiro*", "beijinho*", "chocolate branco"] },
      { nome: "Abreviações de cupom", termos: [
        "lte", "qjo", "qj", "req", "iog", "muss", "parm", "mant"] },
      { nome: "Em inglês", termos: [
        "milk*", "butter*", "cheese*", "cream cheese", "ice cream", "sour cream", "whipped cream", "heavy cream"] }
    ],
    /* Exceções: parecem, mas não são leite. As 8 primeiras vêm da versão anterior do app;
       as outras entraram nesta versão. Todas aguardam revisão profissional. */
    pode: [
      "leite de coco", "leite condensado de coco", "leite de aveia", "lactato de cálcio", "lactato de sódio",
      "estearoil-lactil-lactato", "manteiga de cacau", "creme tártaro",
      "manteiga de amendoim", "manteiga de karité", "peanut butter", "cocoa butter", "shea butter",
      "coconut milk", "oat milk"
    ],
    cuidados: [
      "Zero lactose e sem lactose não servem: ainda têm a proteína do leite.",
      "\"Pode conter leite\": siga o que o médico orientou.",
      "A granel não tem rótulo: não dá para conferir.",
      "Frios fatiados na hora passam na mesma máquina do queijo.",
      "Embalagem nova, até da marca de sempre: leia de novo. A receita muda."
    ]
  };

  /* Termos da versão anterior do app (33). A nova lista precisa continuar pegando todos. */
  var LEGADO_EVITAR = ["Contém leite", "Pode conter leite", "Leite", "Leite em pó", "Soro de leite", "Whey", "Caseína",
    "Caseinato", "Lactoalbumina", "Lactoglobulina", "Lactose", "Sem lactose", "Zero lactose", "Gordura láctea",
    "Composto lácteo", "Queijo", "Requeijão", "Iogurte", "Manteiga", "Margarina com leite", "Creme de leite", "Nata",
    "Coalho", "Ghee", "Petit suisse", "Bebida láctea", "Leite fermentado", "Leite condensado", "Doce de leite", "Pudim",
    "Chocolate ao leite", "Molho branco", "Leite de cabra"];
  var LEGADO_PODE = ["Leite de coco", "Leite condensado de coco", "Leite de aveia", "Lactato de cálcio", "Lactato de sódio",
    "Estearoil-lactil-lactato", "Manteiga de cacau", "Creme tártaro"];
  var LEGADO_CUIDADOS = ["Zero lactose e sem lactose não servem: ainda têm a proteína do leite.",
    "\"Pode conter leite\": evite até falar com o pediatra.", "Nada a granel: sem rótulo, não dá pra conferir.",
    "Nada de frio fatiado na hora: a máquina é a mesma do queijo.",
    "Leia toda embalagem nova, até da marca de sempre: a receita muda."];

  /* Dicas para o estado "insuficiente": não mudam o estado, só explicam por que conferir.
     bloqueia: a pessoa não pode marcar como conferido pelo app. */
  var DICAS = [
    { termos: ["formula*", "composto alimentar", "hidrolisad*", "aminoacid*"], bloqueia: true,
      texto: "Fórmula infantil: só a que o pediatra indicou. O app não avalia fórmula." },
    { termos: ["granel", "a granel", "fatiado na hora", "fatiados na hora", "fatiada na hora", "fatiadas na hora"], bloqueia: true,
      texto: "Sem rótulo para conferir." },
    { termos: ["papinha*", "papa", "cereal infantil"],
      texto: "Alimento de bebê: leia a composição inteira." },
    { termos: ["margarina*", "creme vegetal"],
      texto: "Muitas margarinas levam soro de leite." },
    { termos: ["pao", "paes", "bisnaguinha*", "bisnaga*", "torrada*", "bolo", "bolos", "bolinho*", "biscoito*", "bolacha*", "cookie*", "wafer*",
      "rosquinha*", "panetone*", "chocotone*", "croissant*", "sonho*", "cuca*", "waffle*", "panqueca*", "crepe*"],
      texto: "Pães, bolos e biscoitos costumam levar leite." },
    { termos: ["salsicha*", "presunto*", "apresuntado*", "mortadela*", "peito de peru", "salame*", "linguica*", "blanquet*",
      "frios", "hamburguer*", "hamburger*", "empanado*", "nugget*", "almondega*", "kibe*", "quibe*"],
      texto: "Embutidos e empanados podem levar proteína do leite." },
    { termos: ["chocolate*", "achocolatado*", "cappuccino*", "capuccino*", "sorvete*", "picole*", "mousse*", "creme*",
      "cobertura*", "bombom*", "bombons", "trufa*", "pave", "granola*", "barra de cereal", "barra de cereais", "cereal*"],
      texto: "Doces, cremes e cereais costumam levar leite." },
    { termos: ["molho*", "tempero*", "caldo*", "sopa*", "pure", "lasanha*", "pizza*", "nhoque*", "strogonoff*", "estrogonofe*",
      "torta*", "salgado*", "coxinha*", "pastel*", "empada*", "empadinha*", "quiche*", "miojo*", "macarrao instantaneo"],
      texto: "Pratos, molhos e temperos prontos podem levar leite ou soro de leite." }
  ];

  var CATEGORIAS_SEM_AVALIACAO = ["Limpeza e casa"];

  function normalizar(s) {
    var t = String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
    return " " + t + " ";
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  var cacheRe = {};
  function compilar(termo) {
    var bruto = String(termo == null ? "" : termo).trim();
    if (!bruto) return null;
    if (cacheRe[bruto]) return cacheRe[bruto];
    var prefixo = /\*$/.test(bruto);
    var corpo = normalizar(bruto.replace(/\*+$/, "")).trim();
    if (!corpo) return null;
    var fonte = " " + corpo.split(" ").map(escRe).join(" ") + (prefixo ? "[a-z0-9]*" : "") + " ";
    var c = { termo: bruto, re: new RegExp(fonte), reG: new RegExp(fonte, "g") };
    cacheRe[bruto] = c;
    return c;
  }
  function tirarExcecoes(texto, lista) {
    var t = texto;
    (lista || []).forEach(function (x) {
      var c = compilar(x); if (!c) return;
      var antes;
      do { antes = t; t = t.replace(c.reG, " "); } while (t !== antes);
    });
    return t;
  }
  function procurar(texto, lista) {
    for (var i = 0; i < (lista || []).length; i++) {
      var c = compilar(lista[i]); if (!c) continue;
      var m = c.re.exec(texto);
      if (m) return { regra: lista[i], achado: m[0].trim() };
    }
    return null;
  }

  /* Devolve o pedaço do nome como a pessoa escreveu ("Requeijão", não "requeijao"). */
  function trechoOriginal(nome, achado) {
    var orig = String(nome == null ? "" : nome).split(/[^0-9A-Za-z\u00C0-\u024F]+/).filter(Boolean);
    var norm = orig.map(function (w) { return normalizar(w).trim(); });
    var alvo = achado.split(" "), k = alvo.length;
    for (var i = 0; i + k <= norm.length; i++) {
      if (norm.slice(i, i + k).join(" ") === achado) return orig.slice(i, i + k).join(" ");
    }
    return achado;
  }

  function modeloPorId(id) { return id === MODELO_SEM_LEITE.id ? MODELO_SEM_LEITE : null; }
  function termosDoModelo(mod) {
    var out = [];
    (mod && mod.grupos || []).forEach(function (g) { out = out.concat(g.termos); });
    return out;
  }
  /* Exceção da pessoa que anularia um aviso inteiro (ex.: "leite", "queijo") é ignorada.
     Regra: se a exceção, sozinha, já seria "evitar" e é uma palavra só, ou é igual a um
     termo da lista, ela apagaria todos os produtos com aquele termo. Fica guardada, mas
     o motor não usa e a tela mostra que foi ignorada. As exceções do modelo são curadas. */
  function validarExcecoes(dieta) {
    var mod = modeloPorId(dieta && dieta.modelo);
    var evitar = termosDoModelo(mod).concat(dieta && dieta.evitar || []);
    var base = {};
    evitar.forEach(function (t) { base[normalizar(String(t).replace(/\*+$/, "")).trim()] = 1; });
    var validas = [], ignoradas = [];
    (dieta && dieta.pode || []).forEach(function (x) {
      var n = normalizar(String(x).replace(/\*+$/, "")).trim();
      if (!n) return;
      var bate = procurar(" " + n + " ", evitar);
      if (bate && (base[n] || n.split(" ").length < 2 || /\*$/.test(String(x).trim()))) {
        ignoradas.push({ termo: x, motivo: "anularia o aviso de “" + rotuloTermo(bate.regra) + "” em todos os produtos" });
      } else validas.push(x);
    });
    return { validas: validas, ignoradas: ignoradas };
  }
  function listasDaDieta(dieta) {
    var mod = modeloPorId(dieta && dieta.modelo);
    return {
      modelo: mod,
      evitar: termosDoModelo(mod).concat(dieta && dieta.evitar || []),
      pode: (mod ? mod.pode : []).concat(validarExcecoes(dieta).validas)
    };
  }

  function diasEntre(a, b) {
    var pa = String(a).split("-"), pb = String(b).split("-");
    var da = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]), db = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }
  function somarDias(s, n) {
    var p = String(s).split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
  }
  function hojeStr() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  /* Avalia um item. item: {nome, cat, conf} ou só o nome (texto).
     opcoes.hoje: "AAAA-MM-DD" (para testes). */
  function avaliar(item, dieta, opcoes) {
    var it = typeof item === "string" ? { nome: item } : (item || {});
    var hoje = (opcoes && opcoes.hoje) || hojeStr();
    if (!dieta || !dieta.ativa) return { estado: "desligada" };
    if (it.cat && CATEGORIAS_SEM_AVALIACAO.indexOf(it.cat) >= 0) return { estado: "nao_alimento" };

    var L = listasDaDieta(dieta);
    var base = normalizar(it.nome);
    var texto = tirarExcecoes(base, L.pode);
    var achou = procurar(texto, L.evitar);
    if (achou) return { estado: "evitar", termo: trechoOriginal(it.nome, achou.achado), regra: achou.regra };

    var dica = null;
    for (var i = 0; i < DICAS.length && !dica; i++) {
      if (procurar(base, DICAS[i].termos)) dica = DICAS[i];
    }
    var res = { estado: "insuficiente", dica: dica ? dica.texto : "", bloqueiaConferencia: !!(dica && dica.bloqueia) };
    /* O item já teve "evitar" com outro nome: o aviso não some só porque o nome mudou. */
    if (it.ev && it.ev.n && it.ev.n !== base) res.avisoAnterior = { termo: it.ev.t || "", nome: it.ev.nome || "" };

    var c = it.conf;
    if (c && c.d && !res.bloqueiaConferencia && !res.avisoAnterior) {
      if (c.n != null && c.n !== base) { res.motivo = "O nome mudou depois da conferência."; return res; }
      var idade = diasEntre(c.d, hoje);
      if (idade > VALIDADE_CONFERENCIA_DIAS) { res.motivo = "A conferência de " + c.d + " venceu. Confira de novo."; return res; }
      if (idade < 0) { res.motivo = "Data de conferência inválida."; return res; }
      return { estado: "conferido", conferencia: { d: c.d, q: c.q || "", vence: somarDias(c.d, VALIDADE_CONFERENCIA_DIAS) } };
    }
    return res;
  }

  /* Registro de conferência a guardar no item. */
  function conferir(item, quem, hoje) {
    return { d: hoje || hojeStr(), n: normalizar(item && item.nome), q: quem || "" };
  }

  function dietaVazia() {
    return { ativa: false, nome: "", modelo: null, evitar: [], pode: [], cuidados: [], obs: "", revisao: "" };
  }
  function dietaDoModelo(id, atual) {
    var mod = modeloPorId(id) || MODELO_SEM_LEITE;
    var a = atual || {};
    return { ativa: true, nome: a.nome || mod.nome, modelo: mod.id, evitar: a.evitar || [], pode: a.pode || [],
      cuidados: a.cuidados || [], obs: a.obs || "", revisao: a.revisao || "" };
  }

  function chaves(lista) { var o = {}; (lista || []).forEach(function (x) { o[normalizar(x)] = 1; }); return o; }
  function menos(lista, tirar) { var k = chaves(tirar); return (lista || []).filter(function (x) { return !k[normalizar(x)]; }); }
  function contemTodos(lista, todos) { var k = chaves(lista); return todos.every(function (x) { return k[normalizar(x)]; }); }

  /* Converte a dieta salva pela versão anterior do app, sem perder nada que a pessoa escreveu.
     - Se a lista dela tem todos os 33 termos antigos: passa a usar o modelo, e o que ela acrescentou vira "extra".
     - Se ela tirou algum termo: a lista dela fica como está, e o app sugere o modelo. */
  function migrar(d) {
    if (!d || typeof d !== "object") return dietaVazia();
    if (Object.prototype.hasOwnProperty.call(d, "modelo")) return d;
    var anterior = JSON.parse(JSON.stringify(d));
    var evitar = d.evitar || [], pode = d.pode || [], cuidados = d.cuidados || [];
    var out = { ativa: !!d.ativa, nome: d.nome || "", evitar: evitar, pode: pode, cuidados: cuidados,
      obs: d.obs || "", revisao: d.revisao || "", anterior: anterior };
    if (contemTodos(evitar, LEGADO_EVITAR)) {
      out.modelo = MODELO_SEM_LEITE.id;
      out.evitar = menos(evitar, LEGADO_EVITAR);
      out.pode = menos(pode, LEGADO_PODE);
      out.cuidados = menos(cuidados, LEGADO_CUIDADOS);
    } else {
      out.modelo = null;
      if (evitar.length) out.sugerirModelo = true;
    }
    return out;
  }

  /* Marca que o item teve "evitar", para o aviso sobreviver a uma troca de nome.
     Devolve o novo valor de item.ev (ou undefined para apagar). */
  function marcaEvitar(item, dieta) {
    var r = avaliar({ nome: item.nome, cat: item.cat }, dieta);
    var base = normalizar(item.nome);
    if (r.estado === "evitar") return { t: r.termo, n: base, nome: item.nome };
    if (item.ev && item.ev.n === base) return undefined;
    return item.ev;
  }

  /* Texto de cada termo para a tela da dieta. */
  function rotuloTermo(t) { return /\*$/.test(t) ? t.replace(/\*+$/, "") + "…" : t; }

  return {
    VALIDADE_CONFERENCIA_DIAS: VALIDADE_CONFERENCIA_DIAS,
    AVISO_FIXO: AVISO_FIXO,
    AVISO_CURTO: AVISO_CURTO,
    MODELO_SEM_LEITE: MODELO_SEM_LEITE,
    LEGADO_EVITAR: LEGADO_EVITAR,
    LEGADO_PODE: LEGADO_PODE,
    normalizar: normalizar,
    avaliar: avaliar,
    conferir: conferir,
    dietaVazia: dietaVazia,
    dietaDoModelo: dietaDoModelo,
    modeloPorId: modeloPorId,
    termosDoModelo: termosDoModelo,
    migrar: migrar,
    validarExcecoes: validarExcecoes,
    marcaEvitar: marcaEvitar,
    rotuloTermo: rotuloTermo
  };
});
