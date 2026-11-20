"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const a=require("../lib/acesso.cjs");
const u={uid:"uid_4-ABC",email:"conta@teste.example"};

test("papel superadmin exige UID exato e provisionamento privilegiado",()=>{
  assert.equal(a.ehSuperadmin({uid:u.uid,ativo:true},u.uid),true);
  assert.equal(a.ehSuperadmin({uid:u.uid,ativo:false},u.uid),false);
  assert.equal(a.ehSuperadmin({uid:"outro",ativo:true},u.uid),false);
  assert.equal(a.ehSuperadmin({uid:u.uid,ativo:true},""),false);
  assert.equal(a.ehSuperadmin(null,u.uid),false);
  assert.equal(a.ehSuperadmin({email:"admin@teste.example",ativo:true},u.uid),false);
});
test("usuário novo fica pendente, nunca aprovado por padrão",()=>{
  assert.deepEqual(a.novaSolicitacao(u),{uid:u.uid,email:u.email,status:"pendente"});
  assert.equal(a.estadoSolicitacao(null),"nao_solicitado");
  assert.equal(a.acessoAprovado(a.novaSolicitacao(u),u),false);
});
test("somente documento aprovado e ligado ao mesmo UID libera acesso",()=>{
  assert.equal(a.acessoAprovado({uid:u.uid,status:"aprovado"},u),true);
  assert.equal(a.acessoAprovado({uid:u.uid,status:"suspenso"},u),false);
  assert.equal(a.acessoAprovado({uid:u.uid,status:"rejeitado"},u),false);
  assert.equal(a.acessoAprovado({uid:"outro",status:"aprovado"},u),false);
});
test("transições de aprovação, suspensão, reativação e rejeição",()=>{
  assert.equal(a.proximoEstado("aprovar","pendente"),"aprovado");
  assert.equal(a.proximoEstado("rejeitar","pendente"),"rejeitado");
  assert.equal(a.proximoEstado("suspender","aprovado"),"suspenso");
  assert.equal(a.proximoEstado("reativar","suspenso"),"aprovado");
  assert.equal(a.proximoEstado("aprovar","rejeitado"),"aprovado");
  assert.throws(()=>a.proximoEstado("reativar","pendente"));
  assert.throws(()=>a.proximoEstado("suspender","pendente"));
  assert.throws(()=>a.proximoEstado("rejeitar","aprovado"));
  assert.throws(()=>a.proximoEstado("aprovar","aprovado"));
});
test("não pode administrar próprio UID nem contas malformadas",()=>{
  assert.equal(a.validarAcao("aprovar","outro_uid",u.uid),"aprovar");
  assert.throws(()=>a.validarAcao("aprovar",u.uid,u.uid));
  assert.throws(()=>a.validarAcao("promover-superadmin","outro",u.uid));
  assert.throws(()=>a.validarAcao("aprovar","../../superadmin",u.uid));
});
