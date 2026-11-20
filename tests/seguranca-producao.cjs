"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
const sw=fs.readFileSync("sw.js","utf8");
const rules=fs.readFileSync("firestore.rules","utf8");
let aprovados=0;
async function teste(nome,fn){
  try {await fn();++aprovados;console.log("OK "+nome);}
  catch(e){console.error("FALHA "+nome+": "+e.message);process.exitCode=1;}
}
function trecho(a,b){
  const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,"trecho não encontrado: "+a);
  return html.slice(i,j);
}
const ctx={URL,console};
vm.createContext(ctx);
vm.runInContext(trecho("  function esc(s){","  function uid(){")+"\n"+
  "var fotos = {}; function autoIcon(){return '🛒';}\n"+
  trecho("  function thumb(it, cls, icon, foto){","  function fileToThumb("),ctx);
function swSimulado(){
 const eventos={};
 const apagados=[];
 const nomes=["despensa-v6","despensa-v5","despensa-hml-v10","outro-app-v1","despensa-v7"];
 const cache={match:async()=>null,put:async()=>undefined,addAll:async()=>undefined};
 const caches={open:async()=>cache,match:async()=>null,keys:async()=>nomes,delete:async(key)=>{apagados.push(key);return true;}};
 const self={
   location:new URL("https://kaleb-nunes.github.io/mercado-da-casa/sw.js"),
   skipWaiting:()=>Promise.resolve(),clients:{claim:()=>Promise.resolve()},
   addEventListener:(nome,handler)=>eventos[nome]=handler
 };
 const context={self,caches,console,URL,Set,Promise,fetch:async()=>({
   ok:true,status:200,type:"basic",headers:new Map(),clone(){return this;}
 })};
 vm.runInNewContext(sw,context,{filename:"sw.js"});
 return {eventos,apagados};
}
function intercepta(h,url,mode="cors"){
 let capturado=false;
 h.fetch({request:{method:"GET",url,mode},respondWith(p){capturado=true;if(p?.catch)p.catch(()=>{});},waitUntil(){}});
 return capturado;
}
async function run(){
 await teste("sintaxe do JavaScript inline em produção",()=>{
   const codigo=trecho("<script>","</script>").slice("<script>".length);
   new vm.Script(codigo,{filename:"script-index.html"});
 });
 await teste("mantém chaves e funções de produção sem mudar estrutura",()=>{
   assert.match(html,/var KEY = "mercado-casa-v1";/);
   assert.match(html,/var FB_CONFIG = null;/);
   assert.match(html,/function sheetBackup\(/);
   assert.match(html,/function sheetRestaurar\(/);
   assert.match(html,/function renderLista\(/);
   assert.match(html,/function renderOfertas\(/);
   assert.match(html,/function seedState\(/);
 });
 await teste("sincronização familiar legada desligada mesmo se Firebase injetado",()=>{
   assert.match(html,/SYNC_FAMILIAR_ACL_HOMOLOGADA = false/);
   assert.match(html,/return SYNC_FAMILIAR_ACL_HOMOLOGADA && !!fbCfg\(\)/);
 });
 await teste("texto e HTML malicioso de backup ficam escapados",()=>{
   const entrada='</span><img src=x onerror=alert(1)>';
   const h=ctx.thumb({id:"x",nome:"x",cat:"Mercearia",icon:entrada});
   assert.ok(!h.includes("<img "));
   assert.ok(h.includes("&lt;/span&gt;"));
 });
 await teste("foto maliciosa não vira elemento de script/evento",()=>{
   ctx.fotos.x='data:image/jpeg;base64,AAAA" onerror="alert(1)';
   const h=ctx.thumb({id:"x",nome:"x",cat:"Mercearia",icon:"🍎"});
   assert.ok(!h.includes("<img "));
   assert.ok(!h.includes(" onerror="));
 });
 await teste("miniatura base64 JPEG permitida e SVG remoto rejeitado",()=>{
   assert.equal(ctx.miniaturaSegura("data:image/jpeg;base64,AAAA"),"data:image/jpeg;base64,AAAA");
   for(const f of ["data:image/svg+xml;base64,AAAA","javascript:alert(1)","https://site.test/x.png"])assert.equal(ctx.miniaturaSegura(f),"");
 });
 await teste("URL externa só HTTPS sem credencial",()=>{
   assert.equal(ctx.urlExternaSegura("https://site.test/oferta"),"https://site.test/oferta");
   for(const u of ["javascript:alert(1)","http://site.test/x","https://u:p@site.test/x","data:text/html,abc","//site.test"])assert.equal(ctx.urlExternaSegura(u),"");
   assert.ok(html.includes("esc(urlExternaSegura(e.url))"));
   assert.ok(html.includes("esc(urlExternaSegura(a.fonte.url))"));
 });
 await teste("ícones remotos em HTML são escapados",()=>{
   assert.ok(html.includes("esc(l[0])"));
   assert.ok(html.includes("esc(r.icone || '🏷️')"));
 });
 await teste("Firestore exige membro ativo e impede clientes de mudar ACL",()=>{
   assert.match(rules,/membroAtivo\(casaId\)/);
   assert.match(rules,/\.data\.ativo == true/);
   assert.match(rules,/match \/membros\/\{uid\}/);
   assert.match(rules,/allow create, update, delete: if false;/);
 });
 await teste("SW não intercepta APIs, terceiros e páginas desconhecidas",()=>{
   const h=swSimulado().eventos;
   const base="https://kaleb-nunes.github.io/mercado-da-casa/";
   assert.equal(intercepta(h,base+"api/contas"),false);
   assert.equal(intercepta(h,base+"dados-pessoais.json"),false);
   assert.equal(intercepta(h,base+"index.html?codigo=privado"),false);
   assert.equal(intercepta(h,"https://kaleb-nunes.github.io/outro-app/index.html"),false);
   assert.equal(intercepta(h,"https://site.test/mercado-da-casa/index.html"),false);
   assert.equal(intercepta(h,base+"index.html"),true);
   assert.equal(intercepta(h,base+"?utm=test","navigate"),true);
 });
 await teste("SW ativa apagando somente caches legados da Despensa",async()=>{
   const a=swSimulado(),ev=a.eventos;
   let pending;
   ev.activate({waitUntil(p){pending=p;}});
   await pending;
   assert.deepEqual(a.apagados.sort(),["despensa-v5","despensa-v6"]);
 });
 console.log("Hotfix produção: "+aprovados+"/11 testes");
 if(process.exitCode)process.exit(process.exitCode);
}
run().catch(e=>{console.error(e);process.exitCode=1});
