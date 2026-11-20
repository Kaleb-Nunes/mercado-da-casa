"use strict";
/* Exploração controlada de entradas não confiáveis (sem rede).
 * Confirma que conteúdo restaurado de backup não vira HTML executável. */
const fs=require("node:fs"),assert=require("node:assert/strict"),vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
function trecho(inicio,fim){
 const i=html.indexOf(inicio),j=html.indexOf(fim,i+inicio.length);
 assert.ok(i>=0&&j>i, "trecho não localizado: "+inicio);
 return html.slice(i,j);
}
const ctx={URL,console};
vm.createContext(ctx);
vm.runInContext(trecho("  function esc(s){","  function uid(){")+"\n"+
  "var fotos = {}; function autoIcon(){return '🛒';}\n"+
  trecho("  function thumb(it, cls, icon, foto){","  function fileToThumb("),ctx);
let count=0;
function teste(nome,fn){fn();count++;console.log("OK "+nome)}
teste("escapa texto e atributos HTML",()=>{
  const result=ctx.esc("<img src=\"x\" onerror=\"a()\"> &");
  assert.ok(result.includes("&lt;img"));
  assert.ok(result.includes("&quot;"));
  assert.ok(!result.includes("<img"));
});
teste("URLs externas são apenas HTTPS sem credenciais",()=>{
  assert.equal(ctx.urlExternaSegura("javascript:alert(1)"),"");
  assert.equal(ctx.urlExternaSegura("data:text/html,%3Csvg%3E"),"");
  assert.equal(ctx.urlExternaSegura("https://user:pass@site.test/a"),"");
  assert.equal(ctx.urlExternaSegura("//site.test/a"),"");
  assert.equal(ctx.urlExternaSegura("http://site.test/a"),"");
  assert.equal(ctx.urlExternaSegura("https://site.test/a"),"https://site.test/a");
});
teste("miniatura remota, SVG ou atributo injetado são descartados",()=>{
  assert.equal(ctx.miniaturaSegura('data:image/svg+xml;base64,AAAA'),"");
  assert.equal(ctx.miniaturaSegura('https://site.test/tracker.png'),"");
  assert.equal(ctx.miniaturaSegura('data:image/jpeg;base64,AAAA" onerror="alert(1)'),"");
  assert.equal(ctx.miniaturaSegura("data:image/jpeg;base64,AAAA"),"data:image/jpeg;base64,AAAA");
});
teste("ícone de item vindo de backup não executa HTML",()=>{
  const out=ctx.thumb({id:"teste",nome:"ABC",cat:"Mercearia",icon:'</span><img src=x onerror=alert(1)>'});
  assert.ok(out.includes("&lt;/span&gt;"));
  assert.ok(!out.includes("<img "));
  assert.ok(out.includes("&lt;img"));
});
teste("foto vinda de backup não pode injetar onerror no src",()=>{
  ctx.fotos.teste='data:image/jpeg;base64,AAAA" onerror="alert(1)';
  const out=ctx.thumb({id:"teste",nome:"ABC",cat:"Mercearia",icon:"🍎"});
  assert.ok(!out.includes("<img "));
  assert.ok(!out.includes(" onerror="));
});
teste("foto base64 válida é preservada",()=>{
  ctx.fotos.teste="data:image/jpeg;base64,AAAA";
  const out=ctx.thumb({id:"teste",nome:"ABC",cat:"Mercearia",icon:"🍎"});
  assert.ok(out.includes('<img src="data:image/jpeg;base64,AAAA"'));
});
teste("todos os links de origem de ofertas passam por filtro HTTPS",()=>{
  assert.ok(html.includes("esc(urlExternaSegura(a.fonte.url))"));
  assert.ok(html.includes("esc(urlExternaSegura(e.url))"));
  assert.ok(html.includes("esc(urlExternaSegura(f.urlProduto) ||"));
  assert.ok(!html.includes("esc(a.fonte.url)"));
  assert.ok(!html.includes("esc(e.url)"));
});
console.log("Entradas não confiáveis: "+count+"/7 aprovados");
