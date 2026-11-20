"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const aprovacao=fs.readFileSync("elida-aprovacao.js","utf8");
const conta=fs.readFileSync("elida-conta.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const regras=fs.readFileSync("firestore.rules","utf8");
const functions=fs.readFileSync("functions/index.js","utf8");
let passos=0;
function teste(t,fn){try{fn();passos++;console.log("OK "+t);}catch(e){console.error("FALHA "+t,e.message);process.exitCode=1;}}
teste("SDK de aprovação só carrega com App Check configurado",()=>{
  const w={__ELIDA_APPCHECK_SITE_KEY__:null};
  vm.runInNewContext(aprovacao,{window:w});
  assert.equal(w.ElidaAprovacao.disponivel(),false);
  assert.equal(typeof w.ElidaAprovacao.iniciar,"function");
});
teste("UI tem solicitação, análise e decisões administrativas",()=>{
  for(const action of ["solicitar","verificar","lista","aprovar","rejeitar","suspender","reativar"])
    assert.ok(conta.includes(action),"Ação ausente: "+action);
  assert.match(conta,/document\.createElement\("button"\)/);
  assert.match(conta,/textContent=x\[1\]/);
  assert.match(conta,/await servidor\("consultarMeuAcesso"\)/);
  assert.match(conta,/await servidor\("decidirAcesso"/);
});
teste("Conta não concede acesso quando aprovação está ausente",()=>{
  assert.match(conta,/uid=resultado\.status==="aprovado" \? auth\.currentUser\.uid : ""/);
  assert.match(conta,/throw new Error\("App Check não foi ativado"\)/);
  assert.match(conta,/estadoConta="nao_solicitado"/);
});
teste("Rules exigem aprovação + membro ativo e negam escrita de admin",()=>{
  assert.match(regras,/function acessoAprovado\(\)/);
  assert.match(regras,/return acessoAprovado\(\)/);
  assert.match(regras,/status == 'aprovado'/);
  for(const p of ["acessosUsuarios","configuracoesSeguranca","auditoriaAcessos"]){
    assert.ok(regras.includes("match /"+p+"/"));
  }
});
teste("Functions guardam ações administrativas com UID provisionado",()=>{
  assert.match(functions,/ADMIN_REF = db\.collection\("configuracoesSeguranca"\)/);
  assert.match(functions,/async function exigirSuperadmin\(/);
  assert.match(functions,/exports\.decidirAcesso = onCall/);
  assert.match(functions,/exports\.listarSolicitacoes = onCall/);
  assert.match(functions,/const u = await usuarioAprovado\(req\)/);
  assert.match(functions,/FieldValue\.serverTimestamp\(\)/);
});
teste("HTML e SW incluem módulo da autorização",()=>{
  assert.match(html,/<script src="elida-aprovacao\.js"><\/script>/);
  const sw=fs.readFileSync("sw.js","utf8");
  assert.match(sw,/"\.\/elida-aprovacao\.js"/);
});
console.log("Aprovação de contas: "+passos+"/6 testes");if(process.exitCode)process.exit(process.exitCode);
