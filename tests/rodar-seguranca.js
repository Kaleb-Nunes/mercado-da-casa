/* Segurança Elida: invariantes de ACL, sincronização e service worker.
   Sem acesso a dados reais e sem credenciais. Os testes de regras por emulator
   ainda são obrigatórios antes de ativar sincronização. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const ler = (p) => fs.readFileSync(path.join(root, p), "utf8");
const rules = ler("firestore.rules");
const html = ler("index.html");
const sw = ler("sw.js");
const headers = ler("_headers");
let ok = 0;
function t(nome, teste) {
  try { teste(); ++ok; console.log("OK " + nome); }
  catch (e) { console.error("FALHA " + nome + ": " + e.message); process.exitCode = 1; }
}
t("Firestore exige pertencimento ativo e UID autenticado", () => {
  assert.match(rules, /request\.auth\s*!=\s*null/);
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rules, /membroAtivo\(casaId\)/);
  assert.match(rules, /membros\/\$\(request\.auth\.uid\)/);
  assert.match(rules, /\.data\.ativo\s*==\s*true/);
});
t("Firestore não permite cliente criar/alterar casas ou ACL", () => {
  assert.match(rules, /match \/casas\/\{casaId\}/);
  assert.match(rules, /allow create, update, delete:\s*if false;/);
  assert.match(rules, /match \/membros\/\{uid\}/);
  assert.match(rules, /allow create, update, delete:\s*if false;/);
  assert.doesNotMatch(rules, /allow (?:read|write|create|update|delete|get|list)[^;]*:\s*if\s+request\.auth\s*!=\s*null\s*(?:;|&&\s*casaId\.size)/);
});
t("Firestore proíbe listar casas e limita coleções compartilhadas", () => {
  assert.match(rules, /allow list:\s*if false;/);
  for (const col of ["itens", "gastos", "meses", "config", "ofertas"]) assert.ok(rules.includes("'" + col + "'"));
  assert.match(rules, /allow read, write:\s*if false;/);
});
t("Sincronização legada permanece bloqueada mesmo com config Firebase injetada", () => {
  assert.match(html, /var SYNC_FAMILIAR_ACL_HOMOLOGADA = false;/);
  assert.match(html, /function syncDisponivel\(\)\{\s*return SYNC_FAMILIAR_ACL_HOMOLOGADA && !!fbCfg\(\);\s*\}/);
  assert.match(html, /if\(!syncDisponivel\(\)\) return;/);
  assert.match(html, /var FB_CONFIG\s*=\s*null;/);
});
t("SW tem allowlist estática e nunca captura endpoints de API", () => {
  assert.match(sw, /CORE_PATHS = new Set/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(sw, /if \(!estatico && !navegacao\) return;/);
  assert.doesNotMatch(sw, /c\.put\(req,\s*res\.clone\(\)\)/);
});
t("JS do service worker tem sintaxe válida", () => {
  new vm.Script(sw, {filename: "sw.js"});
});
function prepararSW() {
  const handlers = {};
  const loc = new URL("https://app.elida.com.br/");
  const self = {location: loc, clients: {claim: () => Promise.resolve()}, addEventListener: (name, fn) => handlers[name] = fn};
  const fakeCache = {match: async () => null, put: async () => undefined};
  const cacheAPI = {open: async () => fakeCache, match: async () => null, keys: async () => [], delete: async () => true};
  const ctx = {self, URL, Set, Promise, console, caches: cacheAPI, fetch: async () => ({ok: true, status: 200, type: "basic", headers: new Map(), clone(){return this;}})};
  vm.createContext(ctx);
  ctx.importScripts = (p) => vm.runInContext(ler(p.replace(/^\.\//, "")), ctx);
  vm.runInContext(sw, ctx);
  return {handlers,ctx};
}
function capturada(h, uri, mode) {
  let chamada = false;
  h.fetch({request:{method:"GET",url:"https://app.elida.com.br/" + uri,mode:mode||"cors"},respondWith(p){chamada=true; if(p && typeof p.catch === "function") p.catch(()=>{});},waitUntil(){}});
  return chamada;
}
t("SW não intercepta dados de API, JSON desconhecido, URLs com query ou outros domínios", () => {
  const h=prepararSW().handlers;
  assert.equal(capturada(h,"api/off/produto/7891234567895"),false);
  assert.equal(capturada(h,"private/pacientes.json"),false);
  assert.equal(capturada(h,"index.html?codigo=privado"),false);
  assert.equal(capturada(h,"index.html"),true);
  assert.equal(capturada(h,"vendor/ocr/worker.min.js"),true);
  assert.equal(capturada(h,"vendor/ocr/segredo.txt"),false);
});
t("Cloudflare exige CSP, antiframing e bloqueio de scripts por atributo", () => {
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /script-src-attr 'none'/);
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Permissions-Policy:/);
});
console.log("Testes de segurança aprovados: " + ok + "/8");
if(process.exitCode) process.exit(process.exitCode);
