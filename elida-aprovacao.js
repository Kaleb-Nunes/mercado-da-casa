(function(root){
  "use strict";
  async function rpc(nome, parametros){
    const {data,error}=await root.ElidaConta.cliente().rpc(nome,parametros);
    if(error)throw error;
    return data;
  }
  root.ElidaAprovacao=Object.freeze({
    verificar:()=>rpc("elida_meu_acesso"),
    solicitar:()=>rpc("elida_solicitar"),
    listarSolicitacoes:()=>rpc("elida_listar",{pendentes:true}),
    listarAcessos:()=>rpc("elida_listar",{pendentes:false}),
    decidir:(alvo,decisao)=>rpc("elida_decidir",{alvo,decisao})
  });
})(window);
