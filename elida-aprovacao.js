/* ELIDA IA — aprovação de usuários pelo servidor. Nunca usar só UI para autorizar.
   App Check deve estar registrado no Firebase ANTES de configurar a chave pública.
   A ausência de App Check/Functions bloqueia o acesso a contas, mas preserva visitante. */
(function(root){
  "use strict";
  var app=null, auth=null, fun=null, inicial=null, funcs=null;
  var nomes=Object.freeze(["meuAcesso","solicitarAcesso","listarSolicitacoes","decidirAcesso","listarAcessos"]);
  function siteKey(){
    var v=root.__ELIDA_APP_CHECK_SITE_KEY__;
    return typeof v==="string" && /^[A-Za-z0-9_-]{16,256}$/.test(v) ? v : "";
  }
  async function configurar(firebaseApp, firebaseAuth){
    if(!firebaseApp || !firebaseAuth) throw Error("É necessário entrar na sua conta");
    if(!siteKey()) throw Error("Aprovação segura aguardando configuração do App Check");
    if(inicial)return inicial;
    inicial=(async function(){
      var m=await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-check.js"),
        import("https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js")
      ]);
      m[0].initializeAppCheck(firebaseApp,{
        provider:new m[0].ReCaptchaEnterpriseProvider(siteKey()),
        isTokenAutoRefreshEnabled:true
      });
      funcs=m[1];
      fun=funcs.getFunctions(firebaseApp,"southamerica-east1");
      app=firebaseApp;auth=firebaseAuth;
      return true;
    })().catch(function(err){inicial=null;throw err;});
    return inicial;
  }
  async function chamar(nome,dados){
    if(!fun || !funcs || !auth || !auth.currentUser) throw Error("Serviço de acesso indisponível");
    if(nomes.indexOf(nome)<0)throw Error("Operação não permitida");
    var res=await funcs.httpsCallable(fun,nome,{timeout:15000})(dados||{});
    if(!res || !res.data || typeof res.data!=="object")throw Error("Resposta inválida do servidor");
    return res.data;
  }
  async function verificar(firebaseApp,firebaseAuth){
    await configurar(firebaseApp,firebaseAuth);
    var r=await chamar("meuAcesso",{});
    return {status:["aprovado","pendente","rejeitado","bloqueado","nao_solicitado"].includes(r.status)?r.status:"indisponivel",
      papel:r.papel==="superadmin"?"superadmin":"usuario"};
  }
  async function solicitar(){return chamar("solicitarAcesso",{});}
  async function listarSolicitacoes(){
    var x=await chamar("listarSolicitacoes",{});
    return Array.isArray(x.solicitacoes)?x.solicitacoes:[];
  }
  async function listarAcessos(){
    var x=await chamar("listarAcessos",{});
    return Array.isArray(x.usuarios)?x.usuarios:[];
  }
  async function decidir(uid,decisao){
    if(!/^[A-Za-z0-9_-]{6,128}$/.test(String(uid)) ||
       !["aprovar","rejeitar","bloquear"].includes(decisao))throw Error("Operação inválida");
    return chamar("decidirAcesso",{uid:uid,decisao:decisao});
  }
  root.ElidaAprovacao=Object.freeze({configurar:configurar,verificar:verificar,
    solicitar:solicitar,listarSolicitacoes:listarSolicitacoes,listarAcessos:listarAcessos,
    decidir:decidir});
})(window);
