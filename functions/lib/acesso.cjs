"use strict";

// Regras testáveis isoladamente. A autoridade real vem do documento privado
// configuracoesSeguranca/superadmin, criado SOMENTE por operador com Admin SDK.
// Nem e-mail, nome visível, custom claim enviado pelo cliente ou localStorage concedem papel.
const ESTADOS=Object.freeze(["pendente","aprovado","rejeitado","suspenso"]);
const ACOES=Object.freeze(["aprovar","rejeitar","suspender","reativar"]);
const UID=/^[A-Za-z0-9_-]{1,128}$/;

function uidValido(uid){return typeof uid==="string"&&UID.test(uid);}
function ehSuperadmin(config,uid){
  return uidValido(uid)&&!!config&&config.ativo===true&&config.uid===uid;
}
function acessoAprovado(registro,usuario){
  return !!registro && registro.status==="aprovado" &&
    !!usuario && uidValido(usuario.uid) &&
    registro.uid===usuario.uid;
}
function estadoSolicitacao(registro){
  return registro && ESTADOS.includes(registro.status) ? registro.status : "nao_solicitado";
}
function novaSolicitacao(u){
  if(!u || !uidValido(u.uid)||typeof u.email!=="string")throw new TypeError("Usuário inválido");
  return {uid:u.uid,email:u.email,status:"pendente"};
}
function validarAcao(acao,alvo,adminUid){
  if(!ACOES.includes(acao))throw new TypeError("Ação administrativa inválida");
  if(!uidValido(alvo) || alvo===adminUid)throw new TypeError("Conta inválida");
  return acao;
}
function proximoEstado(acao,atual){
  if(!ESTADOS.includes(atual))throw new TypeError("Estado inválido");
  const mapa={aprovar:["pendente","rejeitado","suspenso"],rejeitar:["pendente"],suspender:["aprovado"],reativar:["suspenso"]};
  if(!mapa[acao] || !mapa[acao].includes(atual))throw new TypeError("Transição não autorizada");
  return {aprovar:"aprovado",rejeitar:"rejeitado",suspender:"suspenso",reativar:"aprovado"}[acao];
}
module.exports={ESTADOS,UID,uidValido,ehSuperadmin,acessoAprovado,estadoSolicitacao,novaSolicitacao,validarAcao,proximoEstado};
