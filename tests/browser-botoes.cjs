"use strict";
/* QA real de interface em Chromium em GitHub Actions.
 * Somente servidor local e usuário visitante fictício; não faz login no Firebase real.
 */
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const assert=require("node:assert/strict");
const {chromium}=require("playwright-core");
const {execFileSync}=require("node:child_process");
const raiz=process.cwd();
const tipos={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json",
  ".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2",
  ".wasm":"application/wasm",".gz":"application/gzip",".css":"text/css"};
const server=http.createServer((req,res)=>{
  let url;
  try{url=new URL(req.url,"http://localhost");}
  catch(e){res.writeHead(400);res.end();return;}
  let raw;
  try{raw=decodeURIComponent(url.pathname);}
  catch(e){res.writeHead(400);res.end();return;}
  const alvo=path.resolve(raiz,"."+raw.replace(/\/$/,"/index.html"));
  if(alvo!==raiz && !alvo.startsWith(raiz+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(alvo,(e,stat)=>{
    if(e||!stat.isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{"Content-Type":tipos[path.extname(alvo)]||"application/octet-stream",
      "Cache-Control":"no-store"});
    fs.createReadStream(alvo).pipe(res);
  });
});
async function testar(){
 const bin=process.env.CHROME_BIN ||
  ["/usr/bin/google-chrome","/usr/bin/google-chrome-stable",
   "/usr/bin/chromium","/usr/bin/chromium-browser"].find(p=>fs.existsSync(p));
 if(!bin)throw Error("Google Chrome/Chromium não instalado no executor CI");
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const origem="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({executablePath:bin,headless:true,
   args:["--no-sandbox","--disable-dev-shm-usage"]});
 let page;
 const errors=[],resultado=[];
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},
    locale:"pt-BR",isMobile:true,hasTouch:true});
  page=await ctx.newPage();
  page.on("pageerror",e=>errors.push(String(e.message||e)));
  await page.goto(origem,{waitUntil:"domcontentloaded",timeout:20000});
  const entrada=page.locator("#entrada");
  await entrada.waitFor({state:"visible"});
  await entrada.getByRole("button",{name:"Pausar animação do fundo"}).click();
  assert.equal(await entrada.getAttribute("data-pausado"),"");
  await entrada.getByRole("button",{name:"Criar conta",exact:true}).click();
  await entrada.getByLabel("Confirmar senha").waitFor({state:"visible"});
  await entrada.getByLabel("E-mail").fill("familia@example.com");
  await entrada.getByLabel("Senha",{exact:true}).fill("Senha-ficticia-2026");
  await entrada.getByLabel("Confirmar senha").fill("Senha-diferente-2026");
  await entrada.getByRole("button",{name:"Criar conta",exact:true}).click();
  assert.equal(await entrada.getByLabel("Confirmar senha").evaluate(el=>el.validity.customError),true);
  await entrada.getByRole("button",{name:"Já tenho uma conta"}).click();
  assert.equal(await entrada.getByLabel("Senha",{exact:true}).inputValue(),"");
  await entrada.getByRole("button",{name:"Esqueci minha senha"}).click();
  assert.equal(await entrada.getByLabel("Senha",{exact:true}).isVisible(),false);
  await entrada.getByRole("button",{name:"Continuar como visitante"}).click();
  await page.reload();
  assert.equal(await entrada.isHidden(),true);
  resultado.push("abertura, pausa da imagem, cadastro, recuperação e persistência do visitante");
  await page.locator("#view-inicio.on").waitFor({state:"visible",timeout:15000});
  resultado.push("inicialização e renderização no Android 390px");

  if(await page.locator("#welcome").isVisible().catch(()=>false)){
    const close=page.locator('[data-act="fechar-carta"]:visible').first();
    if(await close.count())await close.click();
  }
  // Botão de conta: abrir e fechar o modal deve funcionar no visitante.
  await page.locator("#elida-conta-botao").click();
  await entrada.waitFor({state:"visible"});
  await entrada.getByRole("button",{name:"Continuar como visitante"}).click();
  assert.equal(await entrada.isHidden(),true);
  resultado.push("botões abrir/fechar conta");

  for(const tela of ["precos","lista","rotulo","inicio"]){
    await page.locator("#tab-"+tela).click();
    assert.equal(await page.locator("#view-"+tela).evaluate(el=>el.classList.contains("on")),true,
      "Aba não ativou: "+tela);
  }
  resultado.push("navegação Início, Preços, Lista e Dieta");

  await page.locator("#tab-precos").click();
  await page.locator('[data-act="novo-item"]:visible').first().click();
  await page.locator("#n-nome").waitFor({state:"visible",timeout:4000});
  await page.locator("#n-nome").fill("Produto fictício de teste");
  await page.locator('#sheet [data-act="fechar"]').first().click();
  assert.equal(await page.locator("#sheet").evaluate(el=>el.classList.contains("on")),false);
  resultado.push("abrir/cancelar formulário Novo produto");

  await page.locator("#tab-inicio").click();
  const orc=page.locator('[data-act="orcamento"]:visible').first();
  if(!await orc.count())throw Error("Botão Orçamento não encontrado");
  await orc.click();
  await page.locator("#f-orc").waitFor({state:"visible",timeout:4000});
  await page.locator('#sheet [data-act="fechar"]').first().click();
  resultado.push("abrir/cancelar formulário Orçamento");

  const backup=page.locator('[data-act="backup"]:visible').first();
  if(!await backup.count())throw Error("Botão Backup não encontrado");
  await backup.click();
  await page.locator("#f-senha-backup").waitFor({state:"visible",timeout:4000});
  await page.locator("#f-senha-backup").fill("Senha-ficticia-longa-2026");
  await page.locator("#f-senha-backup-2").fill("Senha-ficticia-longa-2026");
  await page.locator('#sheet [data-act="fechar"]').first().click();
  resultado.push("formulário Backup protegido por senha");

  assert.deepEqual(errors,[],"Exceções de JavaScript: "+errors.join(" | "));
  fs.mkdirSync("qa-resultados",{recursive:true});
  fs.writeFileSync("qa-resultados/relatorio-ui.json",JSON.stringify({
    ambiente:"Chromium local, visitante, viewport 390x844",
    testes:resultado,erros:errors},null,2));
  console.log("QA real de botões: "+resultado.length+"/"+resultado.length+" verificações aprovadas");
  resultado.forEach(x=>console.log("PASSOU: "+x));
 }catch(e){
  fs.mkdirSync("qa-resultados",{recursive:true});
  fs.writeFileSync("qa-resultados/relatorio-ui.json",JSON.stringify({testes:resultado,erros:errors,falha:String(e.stack||e)},null,2));
  try{if(page)await page.screenshot({path:"qa-resultados/falha-interface.png",fullPage:true});}catch(x){}
  throw e;
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
testar().catch(e=>{console.error(e.stack||e);process.exitCode=1});
