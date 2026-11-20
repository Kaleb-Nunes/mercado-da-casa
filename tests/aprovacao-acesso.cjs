"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const test=require("node:test");
const approval=fs.readFileSync("elida-aprovacao.js","utf8");
const auth=fs.readFileSync("elida-conta.js","utf8");
const functions=fs.readFileSync("functions/index.js","utf8");
const rules=fs.readFileSync("firestore.rules","utf8");
const html=fs.readFileSync("index.html","utf8");
const sw=fs.readFileSync("sw.js","utf8");
const cfg=fs.readFileSync("elida-firebase-config.js","utf8");

test("Módulos de aprovação possuem sintaxe válida e estão instalados no PWA",()=>{
 new vm.Script(approval,{filename:"elida-aprovacao.js"});
 new vm.Script(auth,{filename:"elida-conta.js"});
 assert.ok(html.indexOf('src="elida-aprovacao.js"') < html.indexOf('src="elida-conta.js"'));
 assert.ok(html.indexOf('src="elida-conta.js"') < html.indexOf('src="elida-app.js"'));
 assert.match(sw,/"\.\/elida-aprovacao\.js"/);
});
test("Sem chave App Check o módulo deve falhar fechado sem enviar dados para a rede",async()=>{
 const win={__ELIDA_APP_CHECK_SITE_KEY__:null};
 const ctx=vm.createContext({window:win,console});
 vm.runInContext(approval,ctx);
 await assert.rejects(()=>win.ElidaAprovacao.configurar({},{currentUser:{uid:"qualquer"}}),/App Check/);
 assert.equal(typeof win.ElidaAprovacao.decidir,"function");
 assert.match(cfg,/__ELIDA_APP_CHECK_SITE_KEY__ = null/);
});
test("Login só expõe namespace de conta quando servidor aprova",()=>{
 assert.match(auth,/acesso=await root\.ElidaAprovacao\.verificar\(firebaseApp,auth\)/);
 assert.match(auth,/uid=acesso\.status==="aprovado"/);
 assert.match(auth,/data-elida-bloqueada/);
 assert.match(auth,/data-elida-action="solicitar"/);
 assert.match(auth,/data-elida-admin/);
 assert.match(auth,/decidir\(alvoUid,a\)/);
 assert.doesNotMatch(auth,/signInAnonymously\(/);
});
test("Backend nunca usa e-mail configurado no frontend como prova de ser administrador",()=>{
 assert.match(functions,/const SUPERADMIN_UID = String\(process\.env\.ELIDA_SUPERADMIN_UID/);
 assert.match(functions,/req\.auth\.uid === SUPERADMIN_UID/);
 assert.match(functions,/if \(!proprietario\(req\)\) semPermissao\(\)/);
 assert.match(functions,/exports\.meuAcesso = onCall\(OPCOES/);
 assert.match(functions,/exports\.solicitarAcesso = onCall\(OPCOES/);
 assert.match(functions,/exports\.listarSolicitacoes = onCall\(OPCOES/);
 assert.match(functions,/exports\.decidirAcesso = onCall\(OPCOES/);
 for(const fn of ["criarCasa","criarConvite","aceitarConvite","revogarMembro"]){
  assert.match(functions,new RegExp("exports\\."+fn+" = onCall\\(OPCOES, async \\(req\\) => \\{\\s*const u = await exigirAprovado\\(req\\)"));
 }
 assert.match(functions,/enforceAppCheck: true/);
});
test("Firestore exige aprovação e mantém a fila privada",()=>{
 assert.match(rules,/function acessoAprovado\(\)/);
 assert.match(rules,/data\.status == 'aprovado'/);
 assert.match(rules,/function membroAtivo\(casaId\) \{\s*return acessoAprovado\(\)/);
 assert.match(rules,/match \/solicitacoesAcesso\/\{uid\} \{\s*allow read, write: if false;/);
 assert.match(rules,/match \/acessos\/\{uid\}/);
 assert.match(rules,/allow list, create, update, delete: if false;/);
});
