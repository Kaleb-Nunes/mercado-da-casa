"use strict";
/* Auditoria HTTP passiva: não envia credenciais nem dados privados.
   HEAD/GET apenas na prévia Elida autorizada. */
const fs=require("node:fs");
const base="https://feature-elida-aprovacao-admi.elida-homologacao.pages.dev/";
const origem="https://origem-auditada-invalida.example";
const alvos=["","index.html","elida-firebase-config.js","elida-conta.js","manifest.webmanifest"];
const output={base,date:new Date().toISOString(),scope:"5 HEAD e 1 GET não autenticados",resultados:[]};
const falhas=[];
async function pedir(path,method){
 const response=await fetch(new URL(path,base),{method,redirect:"manual",signal:AbortSignal.timeout(10000),
   headers:{Origin:origem,Accept:"text/html", "User-Agent":"Elida-Security-Authorized-Audit/1.0"}});
 return response;
}
async function main(){
 for(const path of alvos){
  const r=await pedir(path,"HEAD");
  const h={};
  for(const k of ["content-security-policy","cache-control","access-control-allow-origin",
     "access-control-allow-credentials","x-content-type-options","cross-origin-opener-policy","x-frame-options"]){
     h[k]=r.headers.get(k)||"";
  }
  output.resultados.push({path,status:r.status,headers:h});
  const acao=h["access-control-allow-origin"],acac=h["access-control-allow-credentials"];
  if(acac.toLowerCase()==="true" && (acao==="*"||acao===origem)) falhas.push(path+": CORS permite credenciais para origem não confiável");
  if(path==="" && !h["content-security-policy"].includes("object-src 'none'"))falhas.push("CSP obrigatória ausente");
  if(path==="elida-firebase-config.js" && !h["cache-control"].includes("no-store"))falhas.push("Cache-control no-store ausente na configuração pública");
  if(r.status!==200)falhas.push(path+": HTTP "+r.status);
 }
 const r=await pedir("index.html","GET");
 if(r.ok){
  const t=(await r.text()).slice(0,150000);
  if(!t.includes('elida-aprovacao.js'))falhas.push("HTML de aprovação não corresponde ao deploy");
 }
 fs.mkdirSync("auditoria-seguranca",{recursive:true});
 fs.writeFileSync("auditoria-seguranca/cors-cache-homologacao.json",JSON.stringify({...output,achados:falhas},null,2));
 console.log("CORS/CSP/cache auditados: "+alvos.length+" recursos. Falhas críticas: "+falhas.length);
 for(const f of falhas) console.error("FALHA HTTP "+f);
 if(falhas.length)process.exitCode=1;
}
main().catch(e=>{console.error("Auditoria inconclusiva:",e.message);process.exitCode=1});
