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
  const foto=entrada.locator(".entrada-foto");
  assert.equal(await foto.evaluate(el=>getComputedStyle(el,"::after").animationPlayState),"paused");
  await page.emulateMedia({reducedMotion:"reduce"});
  assert.equal(await foto.evaluate(el=>getComputedStyle(el,"::after").animationName),"none");
  await page.emulateMedia({reducedMotion:"no-preference"});
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
  const nota=page.locator("#top-note");
  await nota.evaluate(el=>{el.textContent="Sem leite (proteína do leite de vaca)";});
  for(const width of [320,360,390,430]){
    await page.setViewportSize({width,height:844});
    const [marca,perfil,conta]=await Promise.all([".top .brand","#top-note","#elida-conta-botao"].map(sel=>page.locator(sel).boundingBox()));
    assert.ok(marca.x+marca.width<=perfil.x+1 && perfil.x+perfil.width<=conta.x+1 && conta.x+conta.width<=width);
  }
  await page.setViewportSize({width:390,height:844});
  const atalho=page.locator("#view-inicio .inicio-rotulo");
  await atalho.locator("img").evaluate(img=>img.decode());
  await atalho.click();
  await page.getByRole("heading",{name:"Ler rótulo por foto"}).waitFor();
  await page.locator('#sheet [data-act="fechar"]').first().click();
  await atalho.click();
  assert.equal(await page.locator("#elida-conta-botao").isVisible(),false);
  await page.locator("#ocr-foto").setInputFiles(path.join(raiz,"tests/ocr/rotulo-sintetico.png"));
  await page.locator("#imagem-conferida canvas").waitFor({timeout:75000});
  assert.ok(await page.locator("#imagem-conferida canvas").evaluate(c=>c.width>0));
  await page.getByText("Ver transcrição da foto").click();
  assert.match(await page.locator(".ocr-texto p").innerText(),/leite/i);
  assert.equal(await page.locator("#rd-ok0").isChecked(),false);
  assert.deepEqual(await page.locator("#form-rd legend").allTextContents(),["Produto e ingredientes","Avisos da embalagem","Conferência final"]);
  assert.equal(await page.locator("#rd-ing").evaluate(el=>getComputedStyle(el).fontSize),"16px");
  assert.equal(await page.locator("#elida-conta-botao").isVisible(),false);
  await page.locator('#sheet [data-act="fechar"]').first().click();
  resultado.push("OCR de imagem sintética real, foto para comparação e revisão obrigatória");
  resultado.push("foto no início, movimento reduzido e atalho para o leitor");

  const familia=await browser.newContext({viewport:{width:390,height:844},locale:"pt-BR",hasTouch:true});
  const jantar=await familia.newPage();
  jantar.on("pageerror",e=>errors.push(String(e.message||e)));
  await jantar.goto(origem);
  await jantar.getByRole("button",{name:"Planejar meu jantar sem conta"}).click();
  const folha=jantar.locator("#sheet.on");
  await folha.getByRole("heading",{name:"Arroz com feijão e abóbora assada"}).waitFor();
  await folha.getByRole("button",{name:"Usar minha própria refeição"}).click();
  await folha.getByLabel("Nome do prato").fill("Jantar de domingo");
  await folha.getByLabel("Ingredientes, um por linha").fill("Cenoura\nTomate\ntomate");
  await folha.getByRole("button",{name:"Salvar e conferir a despensa"}).click();
  assert.equal(await folha.getByRole("checkbox").count(),2);
  await folha.getByLabel("Cenoura").check();
  await folha.getByRole("button",{name:"Levar à lista · 1 ingrediente",exact:true}).click();
  const lista=jantar.locator("#view-lista.on");
  await lista.getByText("Tomate",{exact:true}).first().waitFor();
  assert.equal(await lista.getByText("Cenoura",{exact:true}).count(),0);
  await lista.getByRole("button",{name:"Comprar para alguém"}).click();
  const pedido=folha.getByLabel("Mensagem para quem vai ao mercado");
  assert.match(await pedido.inputValue(),/Tomate/);
  assert.doesNotMatch(await pedido.inputValue(),/domingo|Cenoura/);
  await folha.getByRole("button",{name:"Incluir nome da refeição salva"}).click();
  assert.match(await pedido.inputValue(),/Jantar de domingo/);
  await folha.locator('[data-act="fechar"]').first().click();
  await lista.getByRole("button",{name:"Comparar custo da receita"}).click();
  for(const [campo,valor] of Object.entries({precoA:"10",pesoA:"500",usoA:"100",precoB:"6",pesoB:"200",usoB:"100"}))
    await folha.locator('[name="'+campo+'"]').fill(valor);
  await folha.getByRole("button",{name:"Calcular custos"}).click();
  assert.match(await folha.locator("#custos").innerText(),/2,00 na receita.*10,00 em pacotes/);
  assert.match(await folha.locator("#custos").innerText(),/3,00 na receita.*6,00 em pacotes/);
  await folha.locator('[data-act="fechar"]').first().click();
  resultado.push("revisão da compra delegada e comparação do preço usado e do desembolso");
  await jantar.reload();
  await jantar.locator("#tab-inicio").click();
  await jantar.getByRole("button",{name:"Planejar meu jantar",exact:true}).click();
  await folha.getByRole("heading",{name:"Jantar de domingo"}).waitFor();
  await folha.getByLabel("Cenoura").check();
  await folha.getByRole("button",{name:"Levar à lista · 1 ingrediente",exact:true}).click();
  assert.equal(await lista.getByText("Tomate",{exact:true}).count(),1);
  await jantar.locator("#tab-inicio").click();
  await jantar.getByRole("button",{name:"Planejar meu jantar",exact:true}).click();
  await folha.getByLabel("Cenoura").check(); await folha.getByLabel("Tomate").check();
  await folha.getByRole("button",{name:"Concluir · já tenho tudo"}).click();
  assert.equal(await jantar.locator("#view-inicio.on").count(),1);
  await jantar.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await familia.setOffline(true);
  await jantar.reload({waitUntil:"domcontentloaded"});
  await jantar.getByRole("button",{name:"Planejar meu jantar",exact:true}).click();
  await folha.getByRole("heading",{name:"Jantar de domingo"}).waitFor();
  await folha.getByLabel("Tomate").check();
  await folha.getByRole("button",{name:"Levar à lista · 1 ingrediente",exact:true}).click();
  await lista.getByText("Cenoura",{exact:true}).waitFor();
  await lista.getByRole("button",{name:"Registrar dificuldade para a consulta"}).click();
  await folha.getByLabel("Produto ou refeição").fill("Pão de teste");
  await folha.getByLabel("Dificuldade",{exact:true}).selectOption("preco");
  assert.match(await folha.getByLabel("Pergunta para a consulta").inputValue(),/orçamento/);
  await folha.getByLabel("Pergunta para a consulta").fill("O que procurar na próxima compra?");
  await folha.getByRole("button",{name:"Guardar neste aparelho"}).click();
  await folha.getByRole("button",{name:"Revisar mensagem para a consulta"}).click();
  assert.match(await folha.getByLabel("Revise antes de compartilhar").inputValue(),/Pão de teste/);
  await folha.getByRole("button",{name:"Voltar à anotação"}).click();
  await folha.getByLabel("O que combinamos").fill("Levar a embalagem no próximo retorno.");
  await folha.getByRole("button",{name:"Guardar combinado"}).click();
  await folha.getByText("Ficou caro · Combinado anotado").waitFor();
  await jantar.reload();
  await jantar.locator("#tab-inicio").click();
  await jantar.locator(".inicio-consulta").click();
  await folha.getByRole("button",{name:/Pão de teste/}).click();
  assert.match(await folha.getByLabel("O que combinamos").inputValue(),/embalagem/);
  await folha.getByRole("button",{name:"Excluir anotação"}).click();
  await folha.getByRole("button",{name:"Toque novamente para excluir"}).click();
  await folha.getByText("Ver exemplo de uma família").waitFor();
  resultado.push("da dificuldade no mercado ao combinado da consulta, inclusive persistência offline e exclusão");
  await familia.close();
  resultado.push("reabrir o app e atualizar a lista de visitante offline após a primeira carga");
  resultado.push("jantar sem cadastro, prato próprio persistido e compras apenas do que falta, sem duplicatas");

  const login=await browser.newContext({serviceWorkers:"block"});
  const social=await login.newPage();
  const mockAuth="https://elidateste.supabase.co";
  await login.route("**/elida-supabase-config.js",r=>r.fulfill({contentType:"application/javascript",
    body:"window.ELIDA_SUPABASE="+JSON.stringify({origem,url:mockAuth,chavePublicavel:"sb_publishable_teste"})}));
  let ativos={google:true,apple:false,facebook:false};
  await login.route(mockAuth+"/auth/v1/settings",r=>r.fulfill({json:{external:ativos}}));
  await login.route(mockAuth+"/auth/v1/authorize?**",r=>r.fulfill({contentType:"text/html",body:"Autorização simulada"}));
  for(const provedor of ["google","apple","facebook"]){
    await social.goto(origem);
    await social.locator('#entrada [data-tela="login"]').click();
    const botao=social.locator('[data-provedor="'+provedor+'"]');
    await botao.waitFor({state:"visible"});
    await botao.locator("img").evaluate(img=>img.decode());
    if(provedor==="google")assert.equal(await social.locator("#entrada [data-provedor]:visible").count(),1);
    await Promise.all([social.waitForURL(mockAuth+"/auth/v1/authorize?**"),botao.click()]);
    const url=new URL(social.url());
    assert.equal(url.searchParams.get("provider"),provedor);
    assert.equal(url.searchParams.get("redirect_to"),origem+"/");
    assert.ok(url.searchParams.get("code_challenge"));
    ativos={google:true,apple:true,facebook:true};
  }
  await login.close();
  resultado.push("marcas, disponibilidade e rota de autorização PKCE dos três provedores com serviço simulado");

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
