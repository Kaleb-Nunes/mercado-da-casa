/* Ambiente: produção x homologação por configuração explícita (ambiente.js).
   Garante que domínio próprio ou desconhecido nunca vire homologação nem mostre catálogo fictício.
   Uso: node tests/rodar-ambiente.js */
"use strict";
var assert = require("node:assert/strict");
var fs = require("fs"), path = require("path"), vm = require("vm");
var RAIZ = path.join(__dirname, "..");
var A = require(path.join(RAIZ, "ambiente.js"));
var ok = 0, falhas = [];
function t(nome, fn) { try { fn(); ok++; } catch (e) { falhas.push(nome + ": " + e.message.split("\n")[0]); } }
function amb(host, proto) { return A.resolver({ hostname: host, protocol: proto || "https:" }); }

[["kaleb-nunes.github.io", "produção atual (GitHub Pages)"], ["elida.com.br", "domínio próprio futuro"], ["app.elida.com.br", "subdomínio do domínio próprio"],
 ["evil-elida-homologacao.pages.dev", "sufixo parecido sem ponto"], ["elida-homologacao.pages.dev.evil.com", "homologação como prefixo de outro domínio"],
 ["pages.dev", "domínio da Cloudflare sozinho"], ["", "endereço vazio (file://)"], ["teste-atualizacao.elida-homologacao.pages.dev", "teste de atualização forçado como produção"]
].forEach(function (c) {
  t("produção: " + c[1], function () { var a = amb(c[0]); assert.equal(a.nome, "producao"); assert.equal(a.catalogoFicticio, false); assert.equal(a.dadosDeTeste, false); assert.equal(a.prefixoDados, ""); });
});
[["elida-homologacao.pages.dev", "homologação principal"], ["feature-perfis-inteligentes.elida-homologacao.pages.dev", "prévia de branch"], ["ELIDA-HOMOLOGACAO.PAGES.DEV.", "maiúsculas e ponto final"],
 ["localhost", "desenvolvimento local"], ["127.0.0.1", "desenvolvimento local por IP"]
].forEach(function (c) {
  t("homologação: " + c[1], function () { var a = amb(c[0], /^(localhost|127)/.test(c[0]) ? "http:" : "https:"); assert.equal(a.nome, "homologacao"); assert.equal(a.prefixoDados, "hml:"); assert.equal(a.catalogoFicticio, true); });
});
t("homologação sem https (fora de localhost) cai para produção", function () { assert.equal(amb("elida-homologacao.pages.dev", "http:").nome, "producao"); });
t("configuração quebrada cai para produção", function () {
  assert.equal(A.resolver({ hostname: "elida-homologacao.pages.dev", protocol: "https:" }, {}).nome, "producao");
  assert.equal(A.resolver({ hostname: "elida-homologacao.pages.dev", protocol: "https:" }, { homologacao: { hosts: "x" } }).nome, "producao");
  assert.equal(A.resolver(null).nome, "producao");
});
t("a configuração não pode ser alterada em tempo de execução", function () { assert.ok(Object.isFrozen(A.CONFIG) && Object.isFrozen(A.CONFIG.homologacao.hosts)); });
t("o resultado é congelado", function () { var a = amb("elida-homologacao.pages.dev"); assert.ok(Object.isFrozen(a)); });

/* O app e o service worker usam a mesma configuração, sem detecção por domínio escrita à mão */
/* O código do app mora em elida-app.js; o index.html guarda a ordem dos scripts. Os testes olham os dois. */
var htmlIndex = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
var html = htmlIndex + "\n" + fs.readFileSync(path.join(RAIZ, "elida-app.js"), "utf8"), sw = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
t("index.html carrega ambiente.js antes do app e não tem domínio fixo", function () {
  assert.ok(htmlIndex.indexOf('<script src="ambiente.js"></script>') > 0 && htmlIndex.indexOf('<script src="ambiente.js"></script>') < htmlIndex.indexOf('<script src="dieta.js"></script>'));
  assert.ok(!/hostname\s*===\s*"[a-z]/.test(html), "detecção de domínio escrita à mão no index.html");
  assert.ok(/ElidaAmbiente\.resolver\(location\)/.test(html));
});
t("se ambiente.js não carregar, o app assume produção", function () { assert.ok(/: \{ producao: true, homologacao: false, prefixoDados: "", catalogoFicticio: false, dadosDeTeste: false \}/.test(html)); });
t("catálogo fictício e dados de teste dependem só do ambiente", function () {
  assert.ok(/function criarProvedorIA\(\)\{\s*if\(!AMB\.homologacao\) return null;/.test(html));
  assert.ok(/return AMB\.catalogoFicticio \? BUS\.provedorFicticio\(\) : null;/.test(html));
  assert.ok(/if\(!AMB\.dadosDeTeste\) break;/.test(html));
});
function rodarSW(host) {
  var ctx = { self: { location: { hostname: host, protocol: "https:", href: "https://" + host + "/sw.js", origin: "https://" + host }, addEventListener: function () {}, clients: {} }, caches: {}, fetch: function () {}, URL: URL, Promise: Promise };
  ctx.importScripts = function (f) { vm.runInContext(fs.readFileSync(path.join(RAIZ, f.replace(/^\.\//, "")), "utf8"), ctx); };
  vm.createContext(ctx); ctx.self.self = ctx.self;
  vm.runInContext("var self = this.self;", ctx);
  vm.runInContext(sw, ctx);
  return vm.runInContext("({ cache: CACHE, producao: PRODUCAO, core: CORE })", ctx);
}
t("service worker: produção atual usa cache de produção", function () { var r = rodarSW("kaleb-nunes.github.io"); assert.equal(r.producao, true); assert.match(r.cache, /^despensa-v\d+$/); });
t("service worker: domínio próprio usa cache de produção", function () { assert.match(rodarSW("elida.com.br").cache, /^despensa-v\d+$/); });
t("service worker: homologação usa cache separado", function () { assert.match(rodarSW("elida-homologacao.pages.dev").cache, /^despensa-hml-v\d+$/); });
t("service worker: guarda ambiente.js para uso offline", function () { assert.ok(rodarSW("kaleb-nunes.github.io").core.indexOf("./ambiente.js") >= 0); });
t("service worker: sem domínio escrito à mão", function () { assert.ok(!/hostname\s*===\s*"[a-z]/.test(sw)); });

console.log("Elida · ambiente: " + ok + " testes passaram, " + falhas.length + " falharam.");
falhas.forEach(function (f) { console.log("FALHA " + f); });
process.exit(falhas.length ? 1 : 0);
