/* Elida: autorização administrada pelo Firebase, nunca por localStorage.
   Sem chave App Check aprovada não chama Functions e não concede acesso. */
(function(root){
  "use strict";
  var funcoes=null,operacoes=null,carregando=null,erro=null;
  function disponivel(){
    var k=root.__ELIDA_APPCHECK_SITE_KEY__;
    return typeof k==="string"&&k.length>20&&/^[A-Za-z0-9_-]+$/.test(k);
  }
  function iniciar(app){
    if(funcoes)return Promise.resolve();
    if(carregando)return carregando;
    if(!disponivel())return Promise.reject(new Error("App Check ainda não foi configurado. Conta permanece bloqueada."));
    carregando=Promise.all([
      import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app-check.js"),
      import("https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js")
    ]).then(function(m){
      var AC=m[0], FN=m[1];
      AC.initializeAppCheck(app,{
        provider:new AC.ReCaptchaV3Provider(root.__ELIDA_APPCHECK_SITE_KEY__),
        isTokenAutoRefreshEnabled:true
      });
      funcoes=FN.getFunctions(app,"southamerica-east1");
      operacoes=FN;
    }).catch(function(e){carregando=null;erro=e;throw e;});
    return carregando;
  }
  async function chamada(nome,dados){
    if(!funcoes || !operacoes)throw new Error("App Check indisponível. Nenhum acesso foi liberado.");
    if(!["consultarMeuAcesso","solicitarAcesso","listarSolicitacoes","decidirAcesso"].includes(nome))throw new Error("Operação não permitida");
    var resposta=await operacoes.httpsCallable(funcoes,nome)(dados||{});
    return resposta.data;
  }
  root.ElidaAprovacao=Object.freeze({
    iniciar:iniciar,
    disponivel:disponivel,
    chamada:chamada,
    erro:function(){return erro;}
  });
})(window);
