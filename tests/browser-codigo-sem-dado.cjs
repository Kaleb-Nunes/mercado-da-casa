"use strict";
/* QA de navegador: código de barras sem dado na base (caso real 7896999099186, Pão Sanduíche Trabulai).
 * 1) a busca diz com todas as letras que a base não tem ingredientes nem alérgicos e nunca sai "nada encontrado";
 * 2) o botão de foto abre a leitura ligada ao código;
 * 3) com FOTO=<recorte do bloco de ingredientes e ALÉRGICOS>, lê a foto, confere e busca de novo com o OFF fora do ar:
 *    o rótulo conferido pela casa responde pelo código e mostra "pode conter ... leite".
 * Só servidor local, visitante, família de demonstração e OFF simulado pela fixture. Não chama a rede.
 * Uso: node tests/browser-codigo-sem-dado.cjs   (FOTO e CHROME_BIN opcionais; SAIDA=pasta para capturas) */
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict");
const pw=require("playwright-core");
const raiz=process.cwd(),FOTO=process.env.FOTO,SAIDA=process.env.SAIDA||require("node:os").tmpdir()+"/elida-codigo";
fs.mkdirSync(SAIDA,{recursive:true});
const tipos={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".woff2":"font/woff2",".wasm":"application/wasm",".gz":"application/gzip"};
const server=http.createServer((req,res)=>{const raw=decodeURIComponent(new URL(req.url,"http://x").pathname);const alvo=path.resolve(raiz,"."+raw.replace(/\/$/,"/index.html"));
  fs.stat(alvo,(e,st)=>{if(e||!st.isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{"Content-Type":tipos[path.extname(alvo)]||"application/octet-stream","Cache-Control":"no-store"});fs.createReadStream(alvo).pipe(res);});});
(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const origem="http://127.0.0.1:"+server.address().port;
  const browser=await pw.chromium.launch({executablePath:process.env.CHROME_BIN||["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser"].find(p=>fs.existsSync(p)),headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const ctx=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,colorScheme:"dark",serviceWorkers:"block"});
  const page=await ctx.newPage();const erros=[];
  page.on("pageerror",e=>erros.push(String(e.message||e)));
  page.on("console",m=>{if(m.type()==="error"&&!/Failed to load resource|net::ERR|favicon/.test(m.text()))erros.push("console: "+m.text());});
  const fixture=fs.readFileSync(path.join(raiz,"tests/fixtures/off/7896999099186.json"),"utf8");
  let chamadasOFF=0;
  await page.route(/openfoodfacts\.org/,r=>{chamadasOFF++;r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:fixture});});
  await page.goto(origem+"/index.html");
  await page.getByRole("button",{name:"Continuar como visitante"}).click();
  await page.locator("#view-inicio.on").waitFor();
  await page.getByRole("button",{name:"Carregar família de demonstração"}).click();
  await page.locator(".radar-alerta").first().waitFor();
  await page.evaluate(()=>{const b=document.createElement("button");b.dataset.act="nav";b.dataset.view="rotulos";b.id="ir-rotulos";document.body.appendChild(b);});
  await page.locator("#ir-rotulos").click();
  await page.locator("#view-rotulos.on").waitFor();
  await page.locator('input[name="fonte-teste"][value="off"]').check();
  /* 1. Busca pelo código: a base não tem dado */
  await page.fill("#f-busca","7896999099186");await page.locator("#form-busca button[type=submit]").click();
  await page.locator(".ia-prod").first().waitFor({timeout:8000});
  const lac=page.locator(".ia-lacuna");await lac.waitFor();
  assert.match(await lac.innerText(),/não tem os ingredientes nem os avisos de alérgicos/);
  assert.match(await lac.innerText(),/Isso não quer dizer que não tenha/);
  const t1=await page.locator("#view-rotulos").innerText();
  assert.doesNotMatch(t1,/Nada encontrado nos dados conferidos/,"sem dado não pode sair verde");
  await page.locator(".ia-prod").first().scrollIntoViewIfNeeded();
  await page.screenshot({path:SAIDA+"/1-sem-dado.png",fullPage:false});
  console.log("1 ok: lacuna explícita; OFF chamado",chamadasOFF,"vez(es)");
  /* 2. Foto ligada ao código */
  await lac.getByRole("button",{name:"Fotografar ingredientes e ALÉRGICOS"}).click();
  const folha=page.locator("#sheet.on");await folha.waitFor();
  assert.match(await folha.innerText(),/Código 7896999099186/);
  await page.screenshot({path:SAIDA+"/2-foto-codigo.png"});
  console.log("2 ok: folha da foto mostra o código");
  if(!FOTO){console.log("Sem FOTO: passos 1 e 2 aprovados; leitura da foto e memória da casa não testadas aqui.");await browser.close();server.close();return;}
  await page.setInputFiles("#ocr-foto",FOTO);
  const t0=Date.now();
  await page.locator("#rd-pode").waitFor({timeout:240000}).catch(async e=>{console.log("OCR status:",await page.locator("#ocr-status").innerText().catch(()=>"?"));throw e;});
  console.log("OCR em",Math.round((Date.now()-t0)/1000),"s");
  const pode=await page.inputValue("#rd-pode"),contem=await page.inputValue("#rd-contem"),ing=await page.inputValue("#rd-ing"),nome=await page.inputValue("#rd-nome");
  console.log("lido · nome:",nome,"\n contém:",contem,"\n pode:",pode,"\n ing:",ing.slice(0,200));
  await page.screenshot({path:SAIDA+"/3-conferir.png"});
  /* A pessoa confere com a embalagem; aqui só completa o que o OCR deixou de fora */
  if(!/LEITE/i.test(pode))await page.fill("#rd-pode","PODE CONTER CASTANHA-DO-PARÁ, CENTEIO, CEVADA, AVEIA, OVO E LEITE");
  if(!/TRIGO E SOJA/i.test(contem))await page.fill("#rd-contem","CONTÉM DERIVADOS DE TRIGO E SOJA");
  if(!nome.trim())await page.fill("#rd-nome","Pão Sanduíche");
  for(const id of ["rd-ok0","rd-ok1","rd-ok2"])await page.check("#"+id);
  await folha.locator('button[type=submit]').click();
  await page.locator("#rd-res .dbox").waitFor({timeout:8000});
  console.log("análise da foto:",(await page.locator("#rd-res").innerText()).slice(0,300).replace(/\n/g," | "));
  await folha.locator('[data-act="fechar"]').last().click();
  /* 3. Mesmo código de novo, agora SEM internet para o OFF: a memória da casa responde */
  await page.unroute(/openfoodfacts\.org/);
  await page.route(/openfoodfacts\.org/,r=>r.abort());
  await page.fill("#f-busca","");await page.fill("#f-busca","7896999099186");await page.locator("#form-busca button[type=submit]").click();
  const casa=page.locator(".ia-casa");await casa.waitFor({timeout:10000});
  const tc=await casa.innerText();console.log("cartão da casa:",tc.replace(/\n/g," | "));
  assert.match(tc,/Conferido por vocês/);assert.match(tc,/Pode conter/i);assert.match(tc,/LEITE/i);
  assert.ok(await casa.locator(".radar-quem").count()>=1,"chips por pessoa");
  await casa.scrollIntoViewIfNeeded();
  await page.screenshot({path:SAIDA+"/4-memoria-casa.png"});
  await page.screenshot({path:SAIDA+"/4b-memoria-casa-full.png",fullPage:true});
  assert.deepEqual(erros,[],"erros de JS: "+erros.join("; "));
  console.log("TUDO OK");
  await browser.close();server.close();
})().catch(async e=>{console.error("FALHOU:",e.message);process.exit(1);});
