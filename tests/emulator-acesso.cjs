"use strict";
/* Testes REAIS de autorização no Firestore Emulator.
   Somente projeto 'demo-...': nenhuma credencial ou produção. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const {
  initializeTestEnvironment, assertSucceeds, assertFails
} = require("@firebase/rules-unit-testing");
const {
  doc, collection, setDoc, getDoc, getDocs, updateDoc, deleteDoc
} = require("firebase/firestore");
const casa = "AbC_defGhijkLMNoPQrsTUVwxyz1";
const outraCasa = "Bbc_defGhijkLMNoPQrsTUVwxyz2";
const uDono="dono",uEstranho="estranho",uRemovido="removido",uPendente="pendente";
let feitos=0;
async function devePermitir(nome, promessa) {
  await assertSucceeds(promessa);
  feitos++; console.log("PERMITIDO: "+nome);
}
async function deveNegar(nome, promessa) {
  await assertFails(promessa);
  feitos++; console.log("NEGADO: "+nome);
}
async function main(){
  if(!process.env.FIRESTORE_EMULATOR_HOST) throw Error("Recusado: FIRESTORE_EMULATOR_HOST ausente; teste não executa em produção");
  if(!process.env.GCLOUD_PROJECT?.startsWith("demo-") && !process.env.FIREBASE_PROJECT_ID?.startsWith("demo-"))
    throw Error("Recusado: projeto deve começar com demo-");
  const host = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  const env=await initializeTestEnvironment({
    projectId:"demo-elida-acl",
    firestore:{host:host[0],port:Number(host[1]),rules:fs.readFileSync("firestore.rules","utf8")}
  });
  try {
    await env.withSecurityRulesDisabled(async (ctx)=>{
      const db=ctx.firestore();
      for(const [id,owner] of [[casa,uDono],[outraCasa,uEstranho]]){
        await setDoc(doc(db,"casas",id),{nome:"Casa de teste",criador:owner,v:1});
        await setDoc(doc(db,"casas",id,"membros",owner),{ativo:true,nome:"Titular"});
        await setDoc(doc(db,"casas",id,"itens","item1"),{nome:"Produto inventado"});
      }
      await setDoc(doc(db,"casas",casa,"membros",uRemovido),{ativo:false,nome:"Antigo membro"});
      for(const uid of [uDono,uEstranho,uRemovido]){
        await setDoc(doc(db,"acessos",uid),{uid,status:"aprovado",papel:"usuario"});
      }
      await setDoc(doc(db,"casas",casa,"membros",uPendente),{ativo:true,nome:"Pendente simulado"});
      await setDoc(doc(db,"solicitacoesAcesso",uPendente),{uid:uPendente,status:"pendente",email:"p@exemplo.test"});
      await setDoc(doc(db,"acessos",uPendente),{uid:uPendente,status:"pendente",papel:"usuario"});
    });
    const dono=env.authenticatedContext(uDono,{email_verified:true}).firestore();
    const estranho=env.authenticatedContext(uEstranho,{email_verified:true}).firestore();
    const removido=env.authenticatedContext(uRemovido,{email_verified:true}).firestore();
    const semLogin=env.unauthenticatedContext().firestore();
    const naoVerificado=env.authenticatedContext(uDono,{email_verified:false}).firestore();
    const pendente=env.authenticatedContext(uPendente,{email_verified:true}).firestore();

    await devePermitir("usuário só consulta o próprio status",getDoc(doc(pendente,"acessos",uPendente)));
    await deveNegar("usuário pendente não lê casa mesmo tendo membro ativo",getDoc(doc(pendente,"casas",casa)));
    await deveNegar("usuário pendente não altera dados familiares",setDoc(doc(pendente,"casas",casa,"itens","item1"),{nome:"Injeção"}));
    await deveNegar("usuário pendente não lê cadastro do proprietário",getDoc(doc(pendente,"acessos",uDono)));
    await deveNegar("usuário pendente não se aprova",updateDoc(doc(pendente,"acessos",uPendente),{status:"aprovado"}));
    await deveNegar("usuário pendente não cria permissão para si",setDoc(doc(pendente,"acessos","outra"),{status:"aprovado"}));
    await deveNegar("usuário pendente não lê solicitações administrativas",getDoc(doc(pendente,"solicitacoesAcesso",uPendente)));
    await deveNegar("usuário pendente não lista solicitações",getDocs(collection(pendente,"solicitacoesAcesso")));
    await deveNegar("outro usuário não pode alterar status aprovado",updateDoc(doc(dono,"acessos",uDono),{status:"bloqueado"}));
    await deveNegar("e-mail não verificado não lê casa mesmo sendo dono",getDoc(doc(naoVerificado,"casas",casa)));
    await devePermitir("membro ativo lê sua casa",getDoc(doc(dono,"casas",casa)));
    await devePermitir("membro ativo lê item da própria casa",getDoc(doc(dono,"casas",casa,"itens","item1")));
    await devePermitir("membro ativo escreve item próprio",setDoc(doc(dono,"casas",casa,"itens","item2"),{nome:"Arroz fictício"}));
    await devePermitir("membro ativo lista itens da própria casa",getDocs(collection(dono,"casas",casa,"itens")));
    await deveNegar("outro usuário autenticado não lê a casa",getDoc(doc(estranho,"casas",casa)));
    await deveNegar("outro usuário autenticado não lê item",getDoc(doc(estranho,"casas",casa,"itens","item1")));
    await deveNegar("outro usuário autenticado não altera item",setDoc(doc(estranho,"casas",casa,"itens","invadido"),{nome:"Não deve entrar"}));
    await deveNegar("membro removido não lê",getDoc(doc(removido,"casas",casa,"itens","item1")));
    await deveNegar("usuário sem autenticação não lê",getDoc(doc(semLogin,"casas",casa,"itens","item1")));
    await deveNegar("usuário sem autenticação não escreve",setDoc(doc(semLogin,"casas",casa,"itens","item1"),{nome:"alterado"}));
    await deveNegar("cliente não cria casa",setDoc(doc(dono,"casas","Ccc_defGhijkLMNoPQrsTUVwxyz3"),{nome:"Nova"}));
    await deveNegar("cliente não modifica casa",updateDoc(doc(dono,"casas",casa),{nome:"Ataque"}));
    await deveNegar("cliente não edita autorização de outro membro",setDoc(doc(dono,"casas",casa,"membros",uEstranho),{ativo:true}));
    await deveNegar("cliente não se reativa",updateDoc(doc(removido,"casas",casa,"membros",uRemovido),{ativo:true}));
    await deveNegar("cliente não apaga dono",deleteDoc(doc(dono,"casas",casa,"membros",uDono)));
    await deveNegar("cliente não lista todas as casas",getDocs(collection(dono,"casas")));
    await deveNegar("membro de uma casa não lê outra",getDoc(doc(dono,"casas",outraCasa,"itens","item1")));
    await deveNegar("coleção desconhecida permanece negada",getDoc(doc(dono,"casas",casa,"dadosSaude","segredo")));
    await deveNegar("configuração de dieta não é exposta à família",getDoc(doc(dono,"casas",casa,"config","dieta")));
    await deveNegar("cliente não envia dados de saúde à configuração compartilhada",setDoc(doc(dono,"casas",casa,"config","dieta"),{restricoes:["leite"]}));
    await deveNegar("membro ativo não lê token de convite",getDoc(doc(dono,"casas",casa,"convites","tokenHash")));
    await deveNegar("membro ativo não cria convite no cliente",setDoc(doc(dono,"casas",casa,"convites","tokenHash"),{email:"alvo@example.test"}));
    await deveNegar("membro ativo não lista convites",getDocs(collection(dono,"casas",casa,"convites")));
    assert.equal(feitos,33);
    console.log("FIRESTORE EMULATOR: "+feitos+"/33 cenários de autorização aprovados");
  } finally {await env.cleanup();}
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
