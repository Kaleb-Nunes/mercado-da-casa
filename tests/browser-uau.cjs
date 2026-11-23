"use strict";
/* QA de navegador da camada "Radar da casa": simulação antes do cadastro, Radar de mudança de fórmula,
 * Família, scanner por código (catálogo fictício), relatório e navegação em 4 destinos.
 * Só servidor local, usuário visitante e dados fictícios. Não faz login, não chama API paga.
 * Uso: node tests/browser-uau.cjs   (CHROME_BIN opcional; WEBKIT=1 usa o WebKit do Playwright quando instalado) */
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const assert=require("node:assert/strict");
const pw=require("playwright-core");
const raiz=process.cwd();
const tipos={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json",".svg":"image/svg+xml",
  ".png":"image/png",".woff2":"font/woff2",".wasm":"application/wasm",".gz":"application/gzip"};
const server=http.createServer((req,res)=>{
  let raw;
  try{raw=decodeURIComponent(new URL(req.url,"http://localhost").pathname);}catch(e){res.writeHead(400);res.end();return;}
  const alvo=path.resolve(raiz,"."+raw.replace(/\/$/,"/index.html"));
  if(alvo!==raiz&&!alvo.startsWith(raiz+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(alvo,(e,st)=>{
    if(e||!st.isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{"Content-Type":tipos[path.extname(alvo)]||"application/octet-stream","Cache-Control":"no-store"});
    fs.createReadStream(alvo).pipe(res);
  });
});
const frasesSeguro=async(texto,onde)=>{
  for(const f of String(texto).split(/(?<=[.!?])\s+/))
    if(/\bseguro\b/i.test(f))assert.match(f,/\b(nunca|não)\b/i,onde+": 'seguro' fora de uma negação → "+f);
};
async function testar(){
  const usarWebkit=process.env.WEBKIT==="1";
  const bin=process.env.CHROME_BIN||["/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser"].find(p=>fs.existsSync(p));
  if(!usarWebkit&&!bin)throw Error("Google Chrome/Chromium não instalado no executor");
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const origem="http://127.0.0.1:"+server.address().port;
  const browser=usarWebkit?await pw.webkit.launch():await pw.chromium.launch({executablePath:bin,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const erros=[],resultado=[];
  const ver=p=>{p.on("pageerror",e=>erros.push(String(e.message||e)));p.on("console",m=>{if(m.type()==="error"&&!/Failed to load resource|net::ERR|favicon/.test(m.text()))erros.push("console: "+m.text());});};
  let page;
  try{
    /* 1. Primeiro fold no celular: simulação real, sem cadastro, com o CTA à vista */
    const mov=await browser.newContext({viewport:{width:390,height:844},locale:"pt-BR",hasTouch:true,isMobile:!usarWebkit,acceptDownloads:true});
    page=await mov.newPage();ver(page);
    await page.goto(origem,{waitUntil:"domcontentloaded"});
    const entrada=page.locator("#entrada");await entrada.waitFor({state:"visible"});
    const sim=entrada.locator("#uau-sim-landing");
    const casa=sim.locator(".uau-casa");
    await casa.waitFor({state:"visible",timeout:8000});
    const cx=await casa.boundingBox();
    assert.ok(cx.y+60<844,"veredito da casa abaixo da primeira tela (y="+cx.y+")");
    assert.match(await casa.innerText(),/evitar/i);
    const cta=entrada.locator(".entrada-cta").getByRole("button",{name:"Criar conta",exact:true});
    const bx=await cta.boundingBox();
    assert.ok(bx&&bx.y+bx.height<=844,"Criar conta fora da primeira tela");
    assert.ok(bx.height>=44,"alvo de toque do CTA menor que 44px: "+bx.height);
    assert.ok(await entrada.evaluate(el=>el.scrollWidth<=el.clientWidth+1),"rolagem horizontal na landing");
    resultado.push("landing 390px: simulação lê o rótulo e mostra o veredito da casa no primeiro fold, CTA com alvo ≥44px");

    /* 2. Interação: trocar produto, antes/agora, ligar e desligar pessoas, ver o nome disfarçado */
    await sim.locator('[data-uau-prod="pao"]').click();
    await sim.locator(".uau-resultado").waitFor({state:"visible",timeout:8000});
    assert.equal(await sim.locator('[data-uau-prod="pao"]').getAttribute("aria-pressed"),"true");
    assert.match(await sim.innerText(),/caseinato/i,"o pão novo precisa mostrar o caseinato");
    await sim.locator('[data-uau-prod="biscoito"]').click();
    await sim.locator(".uau-resultado").waitFor({state:"visible",timeout:8000});
    const antes=await sim.locator(".uau-casa h3, .uau-casa h4, .uau-casa-titulo").first().innerText().catch(()=>"");
    await sim.locator('[data-uau-ver="anterior"]').click();
    const tituloAntes=await sim.locator(".uau-casa").innerText();
    await sim.locator('[data-uau-ver="atual"]').click();
    const tituloAgora=await sim.locator(".uau-casa").innerText();
    assert.notEqual(tituloAntes,tituloAgora,"antes e agora precisam dar vereditos diferentes");
    await sim.locator('[data-uau-pessoa="demo-theo"]').click();
    assert.equal(await sim.locator('[data-uau-pessoa="demo-theo"]').getAttribute("aria-pressed"),"false");
    assert.doesNotMatch(await sim.locator(".uau-casa").innerText(),/Théo/,"pessoa desligada some do veredito");
    await sim.locator('[data-uau-pessoa="demo-theo"]').click();
    await frasesSeguro(await sim.innerText(),"simulação");
    resultado.push("simulação: troca de produto, antes/agora, pessoas ligadas e desligadas, nunca 'seguro'");

    /* 3. Visitante entra no app: Radar vazio, 4 destinos, demonstração só em homologação (local conta como tal) */
    await entrada.getByRole("button",{name:"Continuar como visitante"}).click();
    await entrada.waitFor({state:"hidden"});
    await page.locator("#view-inicio.on").waitFor();
    const abas=await page.locator("nav.tabs .tab").evaluateAll(els=>els.map(e=>e.id));
    assert.deepEqual(abas,["tab-inicio","tab-perfis","tab-lista","tab-rotulo"],"quatro destinos de navegação");
    assert.equal(await page.locator("button.fab").count(),1,"botão central de escanear");
    assert.match(await page.locator("#view-inicio").innerText(),/Nenhuma pessoa na casa ainda/);
    await page.getByRole("button",{name:"Carregar família de demonstração"}).click();
    await page.locator(".radar-alerta").first().waitFor();
    assert.equal(await page.locator(".radar-alerta").count(),3,"três alertas de fórmula mudada");
    const tons=await page.locator(".radar-alerta").evaluateAll(els=>els.map(e=>e.getAttribute("data-tom")));
    assert.deepEqual(tons,["risco","risco","atencao"],"alertas do mais grave ao menos grave");
    await frasesSeguro(await page.locator("#view-inicio").innerText(),"radar");
    resultado.push("Radar: quatro destinos, família de demonstração, três alertas ordenados por gravidade");

    /* 4. Alerta: folha com o veredito da casa, o que mudou e a pergunta para a consulta */
    await page.locator(".radar-alerta").first().getByRole("button",{name:"Ver o que mudou"}).click();
    const folha=page.locator("#sheet.on");await folha.waitFor();
    assert.match(await folha.innerText(),/precisa evitar|precisam evitar/i);
    assert.match(await folha.innerText(),/soro de leite/i);
    await folha.locator('.sh-close, [data-act="fechar"]').first().click();
    await page.locator(".radar-alerta").first().getByRole("button",{name:"Levar à consulta"}).click();
    const pergunta=folha.getByLabel("Pergunta para a consulta");
    await pergunta.waitFor();
    assert.match(await pergunta.inputValue(),/Biscoito recheado/);
    assert.ok((await pergunta.inputValue()).length<=340);
    await folha.locator('.sh-close, [data-act="fechar"]').first().click();
    resultado.push("alerta: veredito da casa, o que mudou e pergunta pronta para a nutricionista");

    /* 5. Família: perfis com nível de cuidado, sem texto de diagnóstico */
    await page.locator("#tab-perfis").click();
    await page.locator("#view-perfis.on").waitFor();
    const fam=await page.locator("#view-perfis").innerText();
    ["Ana","Théo","Caio","Vovó Vera"].forEach(n=>assert.match(fam,new RegExp(n)));
    assert.match(fam,/Alergia ou doença/);assert.match(fam,/Preferência/);
    resultado.push("Família: quatro perfis, gravidades diferentes");

    /* 6. Scanner por código com o catálogo fictício e veredito de cada pessoa */
    await page.locator("#tab-inicio").click();
    await page.locator("button.fab").click();
    await page.locator('.scan-modo[data-modo="codigo"]').click();
    await page.locator('[data-act="scan-exemplo"][data-cod="2000000000039"]').click();
    await page.locator(".ia-prod").first().waitFor({timeout:8000});
    assert.ok(await page.locator(".ia-prod .radar-quem").count()>=1,"chips com o resultado de cada pessoa");
    const vista=page.locator(".view.on");
    assert.match(await vista.innerText(),/fictício/i);
    await frasesSeguro(await vista.innerText(),"scanner");
    resultado.push("scanner por código (catálogo fictício): resultado por pessoa, marcado como fictício");

    /* 7. Relatório: seções ligáveis, baixar HTML sem script, impressão só no aparelho */
    await page.locator("#tab-rotulo").click();
    await page.locator("#view-rotulo.on").waitFor();
    await page.getByRole("button",{name:/Exportar relatório/}).click();
    const previa=page.locator("#dossie-previa");await previa.waitFor();
    assert.match(await previa.innerText(),/laudo, prescrição ou garantia/);
    await page.locator('[data-dossie-sec="lista"]').uncheck();
    assert.doesNotMatch(await previa.innerText(),/Itens da lista de compras/);
    await page.locator('[data-dossie-sec="lista"]').check();
    const [dl]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Baixar arquivo"}).click()]);
    assert.match(dl.suggestedFilename(),/^elida-relatorio-\d{4}-\d{2}-\d{2}\.html$/);
    const arq=fs.readFileSync(await dl.path(),"utf8");
    assert.match(arq,/^<!doctype html>/i);assert.ok(!/<script/i.test(arq),"relatório baixado não pode ter script");
    await frasesSeguro(arq.replace(/<[^>]+>/g," "),"relatório");
    await page.locator('#sheet [data-act="fechar"], #sheet .sh-close').first().click();
    resultado.push("relatório: seções ligáveis, arquivo autônomo sem script, texto de não-laudo");

    /* 8. Dados de demonstração saem sem tocar em perfil real */
    await page.locator("#tab-inicio").click();
    await page.getByRole("button",{name:"Remover"}).click();
    await page.getByText("Nenhuma pessoa na casa ainda").waitFor();
    resultado.push("remover demonstração devolve o Radar ao estado vazio");

    /* 9. Economia reúne Lista, Preços, Ofertas e Gastos */
    await page.locator("#tab-lista").click();
    for(const v of ["precos","ofertas","gastos","lista"]){
      await page.locator('.eco-seg [data-view="'+v+'"]:visible').first().click();
      assert.equal(await page.locator("#view-"+v).evaluate(el=>el.classList.contains("on")),true,"Economia: "+v);
    }
    resultado.push("Economia: Lista, Preços, Ofertas e Gastos no mesmo destino");
    await mov.close();

    /* 10. Desktop: duas colunas, sem rolagem horizontal */
    const desk=await browser.newContext({viewport:{width:1280,height:800},locale:"pt-BR"});
    const d=await desk.newPage();ver(d);
    await d.goto(origem,{waitUntil:"domcontentloaded"});
    await d.locator("#entrada #uau-sim-landing .uau-casa").waitFor({state:"visible",timeout:8000});
    assert.ok(await d.locator("#entrada").evaluate(el=>el.scrollWidth<=el.clientWidth+1),"rolagem horizontal no desktop");
    const g=await d.locator("#entrada .entrada-inicio").evaluate(el=>getComputedStyle(el).display);
    assert.equal(g,"grid","landing em duas colunas no desktop");
    await desk.close();
    resultado.push("desktop 1280px: duas colunas, sem rolagem horizontal");

    /* 11. Movimento reduzido: a simulação lê sem animação e o resultado aparece */
    const red=await browser.newContext({viewport:{width:390,height:844},locale:"pt-BR",reducedMotion:"reduce"});
    const r=await red.newPage();ver(r);
    await r.goto(origem,{waitUntil:"domcontentloaded"});
    await r.locator("#entrada #uau-sim-landing .uau-casa").waitFor({state:"visible",timeout:8000});
    assert.equal(await r.locator("#entrada #uau-sim-landing [data-lendo]").count(),0,"sem estado de leitura animado");
    await red.close();
    resultado.push("movimento reduzido: resultado direto, sem animação de leitura");

    assert.deepEqual(erros,[],"erros de JavaScript: "+erros.join(" | "));
    fs.mkdirSync("qa-resultados",{recursive:true});
    fs.writeFileSync("qa-resultados/relatorio-uau.json",JSON.stringify({ambiente:usarWebkit?"WebKit":"Chromium",testes:resultado,erros},null,2));
    console.log("QA Radar da casa ("+(usarWebkit?"WebKit":"Chromium")+"): "+resultado.length+"/"+resultado.length+" verificações aprovadas");
    resultado.forEach(x=>console.log("PASSOU: "+x));
  }catch(e){
    fs.mkdirSync("qa-resultados",{recursive:true});
    fs.writeFileSync("qa-resultados/relatorio-uau.json",JSON.stringify({testes:resultado,erros,falha:String(e.stack||e)},null,2));
    try{if(page)await page.screenshot({path:"qa-resultados/falha-uau.png",fullPage:true});}catch(x){}
    throw e;
  }finally{
    await browser.close();
    await new Promise(r=>server.close(r));
  }
}
testar().catch(e=>{console.error(e.stack||e);process.exitCode=1});
