"use strict";
/* Auditoria passiva e LIMITADA a três URLs explicitamente autorizadas.
   Somente HEAD e GET da página inicial, sem crawling e sem exploração de contas. */
const fs=require("node:fs");
const destinos=[
 ["producao","https://kaleb-nunes.github.io/mercado-da-casa/"],
 ["familiar-hml","https://elida-homologacao.pages.dev/"],
 ["ia-hml","https://feature-perfis-inteligentes.elida-homologacao.pages.dev/"]
];
const cabecalhos=["content-security-policy","strict-transport-security","x-frame-options","x-content-type-options","referrer-policy","permissions-policy","cache-control","cross-origin-resource-policy"];
const resultado={geradoEm:new Date().toISOString(),escopo:"somente HEAD + GET de 3 páginas iniciais",ambientes:[]};
const timeout=()=>AbortSignal.timeout(10000);
async function request(url,method){
 const r=await fetch(url,{method,redirect:"manual",signal:timeout(),headers:{Accept:"text/html", "User-Agent":"Elida-Authorized-Passive-Security-Check/1.0 (GitHub CI)"}});
 return r;
}
async function main(){
for(const [nome,url] of destinos){
 let out={nome,url};
 try{
  const head=await request(url,"HEAD");
  out.statusHead=head.status;out.headers={};
  for(const h of cabecalhos)out.headers[h]=head.headers.get(h)||null;
  out.headers["set-cookie"]=head.headers.has("set-cookie")?"presente":"ausente";
  out.avisos=[];
  if(!out.headers["content-security-policy"])out.avisos.push("CSP HTTP ausente");
  if(!out.headers["x-frame-options"]&&!/frame-ancestors/.test(out.headers["content-security-policy"]||""))out.avisos.push("Sem proteção HTTP explícita contra iframe/clickjacking");
  if(!out.headers["x-content-type-options"])out.avisos.push("Sem nosniff");
  if(!out.headers["referrer-policy"])out.avisos.push("Sem política explícita de referer");
  if(!out.headers["strict-transport-security"])out.avisos.push("Sem HSTS");
  const r=await request(url,"GET");
  out.statusGet=r.status;
  out.tipo=r.headers.get("content-type");
  if(r.ok){
    const html=(await r.text()).slice(0,350000);
    out.titulo=(html.match(/<title[^>]*>([^<]*)<\/title>/i)||[])[1]||null;
    out.fbConfigNulo=/\bvar FB_CONFIG\s*=\s*null\s*;/.test(html);
    out.refExternas=[...new Set((html.match(/(?:https?:\/\/)[a-z0-9./?&;#=_%:+-]+/gi)||[]).filter(x=>!x.startsWith("https://kaleb-nunes.github.io")).slice(0,30))].length;
    if(nome==="producao"&&!out.fbConfigNulo)out.avisos.push("ATENÇÃO: FB_CONFIG=null não confirmado no HTML publicado");
    if(/<meta\s+http-equiv=["']Content-Security-Policy/i.test(html))out.avisos.push("Meta CSP encontrada: inferior a CSP por cabeçalho HTTP");
  }
 }catch(e){out.erro=e.message;out.avisos=["Teste HTTP inconclusivo: "+e.message];}
 resultado.ambientes.push(out);
 console.log(nome+": GET "+(out.statusGet||"falhou")+", alertas="+out.avisos.join("; "));
}
fs.mkdirSync("auditoria-seguranca",{recursive:true});
fs.writeFileSync("auditoria-seguranca/auditoria-passiva-publica.json",JSON.stringify(resultado,null,2));
console.log("Auditoria passiva salva. Não foram feitas chamadas a APIs privadas.");

}
main().catch((e)=>{console.error(e.stack||e.message);process.exitCode=1;});
