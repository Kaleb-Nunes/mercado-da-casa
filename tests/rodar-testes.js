#!/usr/bin/env node
/* Testes do app Elida. Sem dependências: node tests/rodar-testes.js
   Sai com código 1 se houver falha crítica (falso negativo, "conferido" indevido,
   regressão da lista antiga, dado pessoal nos arquivos ou Firebase ligado). */
"use strict";
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var D = require("../dieta.js");
var casos = require("./casos-alimentares.js");

var RAIZ = path.join(__dirname, "..");
var HOJE = "2026-11-18";
var falhas = [], avisos = [], ok = 0;
function confere(cond, msg, critico) {
  if (cond) { ok++; return true; }
  (critico === false ? avisos : falhas).push(msg);
  return false;
}
function dieta() { return D.dietaDoModelo("sem-leite"); }
function aval(nome, extra) { return D.avaliar(Object.assign({ nome: nome }, extra || {}), dieta(), { hoje: HOJE }); }

/* 1. Bateria de casos */
function bateria(lista, rotulo) {
  var r = { total: lista.length, A: 0, S: 0, I: 0, fn: [], fp: [], indevido: [], cautela: [] };
  lista.forEach(function (c) {
    var id = c[0], nome = c[1], ref = c[2], res = aval(nome);
    r[ref]++;
    if (ref === "A") {
      if (!confere(res.estado === "evitar", rotulo + " " + id + " \"" + nome + "\": falso negativo (veio " + res.estado + ")")) r.fn.push(id);
    } else if (ref === "S") {
      if (res.estado === "evitar") { r.fp.push(id + " [" + res.termo + "]"); }
      else confere(res.estado === "insuficiente", rotulo + " " + id + " \"" + nome + "\": sem leite deveria ficar insuficiente (veio " + res.estado + ")");
    } else if (ref === "I") {
      if (res.estado === "evitar") r.cautela.push(id + " [" + res.termo + "]");
      else if (!confere(res.estado === "insuficiente", rotulo + " " + id + " \"" + nome + "\": deveria ser insuficiente (veio " + res.estado + ")")) r.indevido.push(id);
    }
  });
  var limiteFp = Math.floor(r.S * 0.2);
  confere(r.fp.length <= limiteFp, rotulo + ": falsos positivos acima de 20% (" + r.fp.length + " de " + r.S + ")", false);
  return r;
}
var rAud = bateria(casos.auditoria, "auditoria");
var rCtl = bateria(casos.controle, "controle");

/* 2. Conferência de rótulo */
function conf(nome, dias) {
  var d = new Date(Date.UTC(2026, 10, 18 - (dias || 0)));
  var s = d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
  return D.conferir({ nome: nome }, "Teste", s);
}
casos.auditoria.concat(casos.controle).forEach(function (c) {
  var nome = c[1], ref = c[2], res = aval(nome, { conf: conf(nome, 10) });
  if (ref === "A") confere(res.estado === "evitar", "conferência não pode tirar o alerta: " + c[0] + " \"" + nome + "\" veio " + res.estado);
});
confere(aval("Arroz branco", { conf: conf("Arroz branco", 10) }).estado === "conferido", "conferência recente deveria dar \"conferido\"");
confere(aval("Arroz branco", { conf: conf("Arroz branco", D.VALIDADE_CONFERENCIA_DIAS + 1) }).estado === "insuficiente", "conferência vencida deveria voltar a insuficiente");
confere(aval("Arroz integral", { conf: conf("Arroz branco", 10) }).estado === "insuficiente", "nome mudou depois da conferência: deveria voltar a insuficiente");
["Fórmula infantil", "Fórmula extensamente hidrolisada", "Fórmula de aminoácidos", "Granola a granel", "Frios fatiados na hora"].forEach(function (n) {
  confere(aval(n, { conf: conf(n, 1) }).estado === "insuficiente", "\"" + n + "\" não pode virar conferido");
});
confere(aval("Arroz branco", { conf: conf("Arroz branco", -3) }).estado === "insuficiente", "conferência com data futura deveria ser recusada");

/* 3. A lista nova continua pegando tudo o que a antiga pegava */
D.LEGADO_EVITAR.forEach(function (t) { confere(aval(t).estado === "evitar", "regressão: termo antigo \"" + t + "\" deixou de alertar"); });
D.LEGADO_PODE.forEach(function (t) { confere(aval(t).estado !== "evitar", "regressão: exceção antiga \"" + t + "\" virou alerta"); });

/* 4. Situações sem avaliação */
confere(D.avaliar("Leite", D.dietaVazia()).estado === "desligada", "dieta vazia não deveria avaliar");
var desligada = dieta(); desligada.ativa = false;
confere(D.avaliar("Leite", desligada).estado === "desligada", "dieta desligada não deveria avaliar");
confere(D.avaliar({ nome: "Sabão em pó", cat: "Limpeza e casa" }, dieta()).estado === "nao_alimento", "limpeza não deveria ser avaliada");
var propria = { ativa: true, nome: "Sem soja", modelo: null, evitar: ["soja*"], pode: ["molho de soja light"], cuidados: [] };
confere(D.avaliar("Óleo de soja", propria).estado === "evitar", "lista própria: termo da pessoa deveria alertar");
confere(D.avaliar("Leite", propria).estado === "insuficiente", "lista própria sem modelo não deveria usar a lista do leite");
var comExtra = dieta(); comExtra.evitar = ["soja"];
confere(D.avaliar("Leite de soja", comExtra).estado === "evitar" && D.avaliar("Proteína de soja", comExtra).estado === "evitar", "modelo + termo extra deveria alertar nos dois");

/* 5. Migração da dieta salva pela versão anterior */
var antiga = { ativa: true, nome: "Dieta de teste", evitar: D.LEGADO_EVITAR.slice(), pode: D.LEGADO_PODE.slice(),
  cuidados: ["Zero lactose e sem lactose não servem: ainda têm a proteína do leite."], obs: "Orientação de teste", revisao: "2026-12-01" };
var m1 = D.migrar(JSON.parse(JSON.stringify(antiga)));
confere(m1.modelo === "sem-leite" && m1.evitar.length === 0 && m1.pode.length === 0, "migração: dieta padrão antiga deveria virar o modelo sem extras");
confere(m1.ativa === true && m1.nome === antiga.nome && m1.obs === antiga.obs && m1.revisao === antiga.revisao, "migração: nome, orientação e revisão deveriam ser mantidos");
confere(JSON.stringify(m1.anterior) === JSON.stringify(antiga), "migração: a dieta antiga deveria ficar guardada para voltar atrás");
var comSoja = JSON.parse(JSON.stringify(antiga)); comSoja.evitar.push("Soja");
var m2 = D.migrar(comSoja);
confere(m2.modelo === "sem-leite" && m2.evitar.length === 1 && m2.evitar[0] === "Soja", "migração: termo que a pessoa acrescentou deveria virar extra");
var semManteiga = JSON.parse(JSON.stringify(antiga)); semManteiga.evitar = semManteiga.evitar.filter(function (t) { return t !== "Manteiga"; });
var m3 = D.migrar(semManteiga);
confere(m3.modelo === null && m3.evitar.length === 32 && m3.sugerirModelo === true, "migração: se a pessoa tirou um termo, a lista dela fica como está");
confere(D.migrar(m1) === m1, "migração: dieta já convertida não deveria mudar");
confere(D.migrar(null).ativa === false && D.migrar(null).modelo === null, "migração: sem dieta, deveria começar vazia e desligada");
var desl = JSON.parse(JSON.stringify(antiga)); desl.ativa = false;
confere(D.migrar(desl).ativa === false, "migração: dieta desligada deveria continuar desligada");
/* Depois da migração, o que alertava continua alertando */
casos.auditoria.forEach(function (c) {
  var antes = D.avaliar(c[1], m1, { hoje: HOJE }).estado, novo = D.avaliar(c[1], dieta(), { hoje: HOJE }).estado;
  confere(antes === novo, "migração: " + c[0] + " deu " + antes + " na dieta migrada e " + novo + " no modelo");
});

/* 6. Privacidade nos arquivos do repositório */
function arquivos() {
  try {
    return cp.execSync("git ls-files", { cwd: RAIZ, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch (e) {
    return ["index.html", "dieta.js", "sw.js", "manifest.webmanifest", "README.md", "ofertas.json"];
  }
}
var termosPrivados = [];
if (process.env.PRIVACIDADE_TERMOS) termosPrivados = process.env.PRIVACIDADE_TERMOS.split(",");
/* A lista de termos privados fica FORA do repositório (variável PRIVACIDADE_TERMOS ou
   arquivo indicado em PRIVACIDADE_ARQUIVO). Nunca dentro da pasta do projeto. */
var arqFora = process.env.PRIVACIDADE_ARQUIVO;
if (arqFora && path.resolve(arqFora).indexOf(path.resolve(RAIZ) + path.sep) === 0) {
  confere(false, "privacidade: a lista de termos privados não pode ficar dentro do repositório");
} else if (arqFora && fs.existsSync(arqFora)) termosPrivados = termosPrivados.concat(fs.readFileSync(arqFora, "utf8").split(/\r?\n/));
var rastreados = arquivos();
confere(!rastreados.some(function (f) { return /(^|\/)\.privacidade-local$/.test(f); }), "privacidade: .privacidade-local está no git");
confere(!fs.existsSync(path.join(RAIZ, ".privacidade-local")), "privacidade: existe .privacidade-local dentro do repositório; mova para fora", true);
/* Aceita linhas no formato do git-filter-repo (literal:X==>Y, regex:X==>Y) ou termo puro. */
var regexPrivadas = [];
termosPrivados = termosPrivados.map(function (s) { return s.replace(/==>.*$/, "").trim(); }).filter(Boolean).filter(function (s) {
  if (/^regex:/.test(s)) { regexPrivadas.push(new RegExp(s.slice(6), "i")); return false; }
  return true;
}).map(function (s) { return s.replace(/^literal:/, ""); });
var lidos = 0;
arquivos().forEach(function (f) {
  if (/^vendor\//.test(f) || /\.(png|jpg|jpeg|gif|ico|webp|woff2?)$/i.test(f)) return;
  var p = path.join(RAIZ, f); if (!fs.existsSync(p)) return;
  var txt = fs.readFileSync(p, "utf8"); lidos++;
  if (/\.svg$/i.test(f)) return; /* desenho vetorial: só números de coordenadas */
  confere(!/(^|[^0-9])[0-9]{44}([^0-9]|$)/.test(txt), "privacidade: " + f + " tem uma sequência de 44 dígitos (chave de nota fiscal)");
  confere(!/[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}/.test(txt), "privacidade: " + f + " tem algo com formato de CPF");
  var baixo = D.normalizar(txt);
  termosPrivados.forEach(function (t, i) {
    confere(baixo.indexOf(D.normalizar(t)) < 0, "privacidade: " + f + " tem o termo privado nº " + (i + 1));
  });
  regexPrivadas.forEach(function (r, i) {
    confere(!r.test(txt), "privacidade: " + f + " bate com o padrão privado nº " + (i + 1));
  });
});

/* 7. Firebase desligado e homologação separada */
var html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
confere(/var FB_CONFIG = null;/.test(html), "Firebase: FB_CONFIG de produção deveria continuar null");
confere(/var FB_CONFIG_HML = null;/.test(html), "Firebase: FB_CONFIG_HML deveria existir e estar null");
var chamadas = html.match(/localStorage\.(getItem|setItem|removeItem)\(\s*([A-Za-z_]+)/g) || [];
chamadas.forEach(function (c) {
  var v = c.replace(/.*\(\s*/, "");
  confere(["KEY", "FOTO_KEY", "OF_KEY", "CASA_KEY", "BK_ANTES", "BK_ULTIMO"].indexOf(v) >= 0, "homologação: chave de armazenamento fora do padrão (" + v + ")");
});
["KEY", "FOTO_KEY", "OF_KEY", "CASA_KEY"].forEach(function (k) {
  confere(new RegExp("\\b" + k + " = PFX \\+ \"").test(html), "homologação: " + k + " deveria usar o prefixo de ambiente");
});
confere(/<script src="dieta\.js"><\/script>/.test(html), "o app deveria carregar dieta.js");
var sw = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
confere(/"\.\/dieta\.js"/.test(sw), "service worker deveria guardar dieta.js para uso offline");

confere(aval("Requeijão cremoso").termo === "Requeijão", "o alerta deveria mostrar a palavra como foi escrita (Requeijão)");
confere(aval("Pão de queijo congelado").termo === "queijo" && aval("LEITE-EM-PO").termo === "LEITE", "o alerta deveria mostrar o trecho original do nome");

confere(/var BK_ANTES = PFX \+ "[a-z-]+", BK_ULTIMO = PFX \+ "[a-z-]+"/.test(html), "chaves do backup deveriam usar o prefixo da homologação");

/* 8. Textos: deixar claro que o app só olha o nome e nunca chamar produto de seguro */
confere(/não lê os ingredientes/.test(D.AVISO_FIXO), "o aviso fixo deveria dizer que o app não lê os ingredientes");
var proibidas = /(é seguro para|seguro para aplv|pode consumir|liberado para|sem risco|100% seguro)/i;
[html, fs.readFileSync(path.join(RAIZ, "dieta.js"), "utf8")].forEach(function (t, i) {
  confere(!proibidas.test(t), "texto que apresenta produto como seguro em " + (i ? "dieta.js" : "index.html"));
});

/* 9. P1: exceções que anulariam um aviso inteiro são ignoradas */
var dx = D.dietaDoModelo("sem-leite", { pode: ["leite", "Queijo", "requeij*", "leite de coco", "pão"] });
var vx = D.validarExcecoes(dx);
confere(vx.ignoradas.length === 3, "exceções 'leite', 'Queijo' e 'requeij*' deveriam ser ignoradas (foram " + vx.ignoradas.length + ")");
confere(vx.validas.indexOf("leite de coco") >= 0 && vx.validas.indexOf("pão") >= 0, "exceções específicas deveriam continuar valendo");
["Leite integral", "Queijo prato", "Requeijão cremoso", "Leite em pó"].forEach(function (n) {
  confere(D.avaliar(n, dx, { hoje: HOJE }).estado === "evitar", "exceção perigosa não pode apagar o aviso de " + n);
});
confere(D.avaliar("Leite de coco", dx, { hoje: HOJE }).estado === "insuficiente", "exceção 'leite de coco' deveria continuar funcionando");
confere(dx.pode.length === 5, "exceções ignoradas ficam guardadas, não são apagadas");
var dp = { ativa: true, nome: "Sem soja", modelo: null, evitar: ["soja*"], pode: ["soja", "molho de soja light"], cuidados: [] };
confere(D.avaliar("Soja em grão", dp, { hoje: HOJE }).estado === "evitar", "dieta própria: exceção igual ao termo não pode anular o aviso");
confere(D.avaliar("Molho de soja light", dp, { hoje: HOJE }).estado === "insuficiente", "dieta própria: exceção específica continua valendo");

/* 10. P1: trocar o nome não apaga o aviso */
var dr = dieta(), itR = { nome: "Leite condensado" };
itR.ev = D.marcaEvitar(itR, dr);
confere(itR.ev && itR.ev.t === "Leite", "item com 'evitar' deveria ganhar a marca");
itR.nome = "Doce de arroz";
var rR = D.avaliar(itR, dr, { hoje: HOJE });
confere(rR.estado === "insuficiente" && rR.avisoAnterior && rR.avisoAnterior.termo === "Leite", "depois de trocar o nome o aviso anterior deveria aparecer");
itR.ev = D.marcaEvitar(itR, dr);
confere(!!itR.ev, "a marca não pode sumir só porque o nome mudou");
itR.conf = D.conferir(itR, "", HOJE);
confere(D.avaliar(itR, dr, { hoje: HOJE }).estado !== "conferido", "com nome trocado, conferência antiga não pode virar 'conferido' sem tirar a marca");
delete itR.ev;
confere(D.avaliar(itR, dr, { hoje: HOJE }).estado === "conferido", "depois de ler o rótulo, segue a regra normal");
var itS = { nome: "Leite integral" }; itS.ev = D.marcaEvitar(itS, dr);
var drx = dieta(); drx.ativa = true; drx.modelo = null;
confere(D.marcaEvitar(itS, drx) === undefined, "se a dieta mudou e o mesmo nome deixou de ser 'evitar', a marca sai");
confere(/delete it\[k\]; \}\); for\(var k in o\) it\[k\] = o\[k\]; if\(!it\.ev && evLocal\) it\.ev = evLocal;/.test(html), "sincronização deveria manter a marca local quando o outro celular não manda");
confere(/marcas\[x\.id\]/.test(html), "restaurar backup deveria manter as marcas por id");
confere(/function save\(\)\{\s*atualizarMarcas\(\);/.test(html), "save deveria atualizar as marcas");

/* 11. P1: service worker só apaga caches do próprio app e ambiente */
(function () {
  var m = sw.match(/const meu = \(k\) => (.+?);\n/);
  confere(!!m, "service worker deveria filtrar os caches pelo prefixo do app");
  if (!m) return;
  var corpo = m[1];
  function filtro(producao) { return new Function("PRODUCAO", "return (k) => " + corpo)(producao); }
  var chaves = ["despensa-v6", "despensa-v7", "despensa-hml-v6", "despensa-hml-v7", "outro-app-v1", "workbox-precache-v2", "despensa-fotos"];
  var p = filtro(true), h = filtro(false);
  var apagaP = chaves.filter(function (k) { return k !== "despensa-v7" && p(k); });
  var apagaH = chaves.filter(function (k) { return k !== "despensa-hml-v7" && h(k); });
  confere(JSON.stringify(apagaP) === '["despensa-v6"]', "produção deveria apagar só despensa-v6 (apagou " + JSON.stringify(apagaP) + ")");
  confere(JSON.stringify(apagaH) === '["despensa-hml-v6"]', "homologação deveria apagar só despensa-hml-v6 (apagou " + JSON.stringify(apagaH) + ")");
})();

/* 12. P1: contraste e área de toque */
confere(/--good:#2A7550;/.test(html), "verde do tema claro deveria ter contraste 4,5:1 no fundo claro (#2A7550)");
confere(/--muted:#5F6C66;/.test(html) && /--warn:#A94E18;/.test(html), "cores do tema claro deveriam ter contraste 4,5:1 (muted #5F6C66, warn #A94E18)");
confere(/\.link\{[^}]*min-height:44px/.test(html) && /\.tip \.x\{[^}]*min-height:44px/.test(html), "links pequenos deveriam ter 44px de área de toque");

/* 13. Backup: arquivo completo, prévia antes de trocar, cópia para desfazer, sem WhatsApp */
(function () {
  var ini = html.indexOf("function sheetBackup()"), fim = html.indexOf("function novoPreview()");
  var bk = html.slice(ini, fim);
  confere(ini > 0 && fim > ini, "bloco de backup encontrado");
  confere(!/wa\.me/.test(bk), "backup não pode oferecer envio pelo WhatsApp");
  confere(/formato: "elida-backup"/.test(html) && /fotos: fotos/.test(html), "arquivo de backup deveria levar estado e fotos");
  confere(/function previaRestaurar/.test(html) && /data-act="aplicar-restaurar"/.test(html), "restauração deveria mostrar o conteúdo antes de trocar");
  confere(/BK_ANTES/.test(html) && /function desfazerRestauracao/.test(html), "restauração deveria guardar cópia para desfazer");
  confere(/não mande em grupo/.test(bk), "tela de backup deveria avisar que o arquivo não tem senha");
  confere(/case "hml-dados":\s*if\(!HML\) break;/.test(html), "dados de teste só podem existir na homologação");
})();

/* 14. Fontes no próprio site e área de toque */
confere(!/fonts\.(googleapis|gstatic)\.com/.test(html) && !/fonts\.(googleapis|gstatic)\.com/.test(sw), "o app não pode pedir fontes ao Google");
confere(/"\.\/fonts\/fraunces\.woff2", "\.\/fonts\/onest\.woff2"/.test(sw), "service worker deveria guardar as fontes para uso offline");
["fonts/fraunces.woff2", "fonts/onest.woff2", "fonts/LICENCA-Fraunces-OFL.txt", "fonts/LICENCA-Onest-OFL.txt"].forEach(function (f) {
  confere(fs.existsSync(path.join(RAIZ, f)), "falta " + f);
});
confere(/\.check\{width:44px;height:44px;margin:-8px;/.test(html) && /\.stepper button::after\{content:"";position:absolute;inset:-8px\}/.test(html), "check e botões +/− deveriam ter área de toque de 44px");

/* Relatório */
function linha(r, nome) {
  return nome + ": " + r.total + " casos (A " + r.A + ", S " + r.S + ", I " + r.I + ") · falsos negativos " + r.fn.length +
    " · falsos positivos " + r.fp.length + (r.fp.length ? " " + JSON.stringify(r.fp) : "") +
    " · insuficiente indevido " + r.indevido.length + " · alerta por cautela em I " + r.cautela.length + (r.cautela.length ? " " + JSON.stringify(r.cautela) : "");
}
console.log("Referência: " + casos.status + ".");
console.log(linha(rAud, "Bateria da auditoria"));
console.log(linha(rCtl, "Conjunto de controle"));
console.log("Arquivos verificados para privacidade: " + lidos + (termosPrivados.length ? " · termos privados: " + termosPrivados.length + " · padrões: " + regexPrivadas.length : " · sem lista de termos privados (defina PRIVACIDADE_TERMOS ou .privacidade-local)"));
console.log("Verificações que passaram: " + ok);
avisos.forEach(function (a) { console.log("AVISO  " + a); });
falhas.forEach(function (f) { console.log("FALHA  " + f); });
console.log(falhas.length ? "Resultado: " + falhas.length + " falha(s) crítica(s)." : "Resultado: nenhuma falha crítica.");
process.exit(falhas.length ? 1 : 0);
