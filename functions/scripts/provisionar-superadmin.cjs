"use strict";
/* Provisionamento MANUAL de superadministrador via credenciais ADC de operador autorizado.
   Nunca executar automaticamente no CI nem subir um JSON de conta de serviço ao Git.
   Uso: node functions/scripts/provisionar-superadmin.cjs projeto-elida-aplv <FirebaseAuthUID>
   Exige autenticação Google ADC com IAM apropriado + confirmação interativa.
*/
const {initializeApp,applicationDefault}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const readline=require("node:readline/promises");
const {stdin,stdout}=require("node:process");

async function main(){
  const [projeto,uid]=process.argv.slice(2);
  if(projeto!=="projeto-elida-aplv" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid||"")){
    throw new Error("Uso: node functions/scripts/provisionar-superadmin.cjs projeto-elida-aplv <UID_REAL_FIREBASE>");
  }
  if(process.env.CI || process.env.GITHUB_ACTIONS)throw new Error("Bootstrap administrativo não pode executar no CI");
  initializeApp({credential:applicationDefault(),projectId:projeto});
  const user=await getAuth().getUser(uid);
  const prods=user.providerData.map(p=>p.providerId);
  if(user.disabled || !user.emailVerified || !prods.some(p=>p==="google.com"||p==="password"))
    throw new Error("A conta deve estar ativa e com e-mail verificado via Google ou senha");
  const ref=getFirestore().collection("configuracoesSeguranca").doc("superadmin");
  const atual=await ref.get();
  if(atual.exists && atual.data().uid!==uid)
    throw new Error("Já existe outro superadministrador. Operação bloqueada; requer procedimento explícito de troca com auditoria");
  const rl=readline.createInterface({input:stdin,output:stdout});
  const esperado="AUTORIZO "+uid;
  let resposta;
  try{
    console.log("Projeto:",projeto,"UID:",uid,"E-mail verificado:",true);
    console.log("Somente continue após confirmar que o UID exibido é da conta proprietária.");
    resposta=await rl.question('Digite exatamente "'+esperado+'" para autorizar: ');
  }finally{rl.close();}
  if(resposta!==esperado)throw new Error("Provisionamento cancelado");
  await getFirestore().runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(snap.exists && snap.data().uid!==uid)throw new Error("Configuração alterada em concorrência; parar");
    tx.set(ref,{uid,ativo:true,atualizadoEm:FieldValue.serverTimestamp(),versao:1}, {merge:false});
  });
  console.log("Provisionamento confirmado. Configure MFA na conta proprietária e audite IAM.");
}
main().catch(e=>{console.error("BLOQUEADO:",e.message);process.exitCode=1;});
