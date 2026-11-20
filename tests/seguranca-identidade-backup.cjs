"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
assert.ok(globalThis.crypto && globalThis.crypto.subtle, "Node WebCrypto indisponível");
const Backup=require("../elida-backup-seguro.js");
const authSource=fs.readFileSync("elida-conta.js","utf8");
const appSource=fs.readFileSync("elida-app.js","utf8");
const htmlSource=fs.readFileSync("index.html","utf8");
const cfg=fs.readFileSync("elida-firebase-config.js","utf8");
const headers=fs.readFileSync("_headers","utf8");
let pass=0;
async function test(title,fn){
 try{await fn();console.log("OK "+title);pass++;}
 catch(e){console.error("FALHA "+title+": "+e.stack);process.exitCode=1;}
}
async function executar(){
 await test("Javascript principal e código de login possuem sintaxe válida",async()=>{
   new vm.Script(appSource,{filename:"elida-app.js"});
   new vm.Script(authSource,{filename:"elida-conta.js"});
   assert.match(htmlSource,/<script src="elida-app\.js"><\/script>/);
   assert.doesNotMatch(htmlSource,/<script>\s*[(]/);
 });
 await test("CSP impede JavaScript inline e somente permite scripts confiáveis",()=>{
   assert.match(headers,/script-src 'self' https:\/\/www\.gstatic\.com 'wasm-unsafe-eval';/);
   assert.doesNotMatch(headers,/script-src[^;]*'unsafe-inline'/);
   assert.match(headers,/Cross-Origin-Opener-Policy: same-origin-allow-popups/);
   assert.match(headers,/frame-ancestors 'none'/);
   assert.match(headers,/X-Content-Type-Options: nosniff/);
 });
 await test("configuração Web pública só existe na homologação",()=>{
   const execute=host=>{const w={location:{hostname:host}};vm.runInNewContext(cfg,{window:w});return w.__ELIDA_FIREBASE_CONFIG__;};
   const c=execute("elida-homologacao.pages.dev");
   assert.equal(c.projectId,"projeto-elida-aplv");
   assert.equal(c.authDomain,"projeto-elida-aplv.firebaseapp.com");
   assert.equal(c.appId,"1:90562321638:web:5959134668dcb4f0a42f27");
   assert.ok(execute("localhost"));
   assert.equal(execute("kaleb-nunes.github.io"),null);
   assert.equal(execute("fake-elida-homologacao.pages.dev.example"),null);
   assert.doesNotMatch(cfg,/private_key\s*:/);
   assert.doesNotMatch(cfg,/serviceAccount\s*:/);
   assert.match(authSource,/projectId==="projeto-elida-aplv"/);
 });
 await test("backup cifrado permite restaurar campos de compras e perfis",async()=>{
   const original={formato:"elida-backup",versao:2,estado:{items:[{nome:"AVEIA",preco:9.5}],meses:{"2026-11":{orc:500,gastos:[]}}},perfis:{perfis:[{apelido:"Criança de teste",restricoes:[{tipo:"LEITE"}]}]}};
   const env=await Backup.criar(original,"Minha senha única e longa #2026!");
   assert.equal(env.versao,3);
   assert.equal(env.algoritmo,"AES-256-GCM");
   assert.equal(env.iteracoes,600000);
   const plain=await Backup.abrir(env,"Minha senha única e longa #2026!");
   assert.deepEqual(plain,original);
   assert.ok(!JSON.stringify(env).includes("AVEIA"));
   assert.ok(!JSON.stringify(env).includes("Criança de teste"));
 });
 await test("mesmo conteúdo usa sal e IV aleatórios independentes",async()=>{
   const a=await Backup.criar({teste:"segredo"},"Senha comprida única @2026");
   const b=await Backup.criar({teste:"segredo"},"Senha comprida única @2026");
   assert.notEqual(a.sal,b.sal);
   assert.notEqual(a.iv,b.iv);
   assert.notEqual(a.dados,b.dados);
 });
 await test("senha incorreta não abre o backup",async()=>{
   const env=await Backup.criar({segredo:"confidencial"},"Senha enorme correta 2026");
   await assert.rejects(()=>Backup.abrir(env,"Senha enorme ERRADA 2026"));
 });
 await test("adulteração do arquivo é detectada por autenticação AES-GCM",async()=>{
   const env=await Backup.criar({segredo:"confidencial"},"Senha enorme correta 2026");
   const mod={...env,dados:env.dados.slice(0,10)+(env.dados[10]==="A"?"B":"A")+env.dados.slice(11)};
   await assert.rejects(()=>Backup.abrir(mod,"Senha enorme correta 2026"));
   await assert.rejects(()=>Backup.abrir({...env,iv:"AAAA"},"Senha enorme correta 2026"));
 });
 await test("não aceita senha curta nem formatos/algoritmos desconhecidos",async()=>{
   await assert.rejects(()=>Backup.criar({data:1},"12345678901"));
   const env=await Backup.criar({data:1},"Senha exclusiva de teste 2026");
   await assert.rejects(()=>Backup.abrir({...env,versao:100},"Senha exclusiva de teste 2026"));
   await assert.rejects(()=>Backup.abrir({...env,iteracoes:1},"Senha exclusiva de teste 2026"));
 });
 await test("modo visitante inicializa offline sem Firebase e não mistura contas",async()=>{
   const dados=new Map();
   const localStorage={getItem:k=>dados.has(k)?dados.get(k):null,setItem:(k,v)=>dados.set(k,String(v)),removeItem:k=>dados.delete(k)};
   const document={
     documentElement:{setAttribute(){}},
     createElement(){return {id:"",type:"",textContent:"",setAttribute(){},addEventListener(){}};},
     body:{appendChild(){}}
   };
   const ctx={window:{__ELIDA_FIREBASE_CONFIG__:null},document,localStorage,setTimeout(){},console};
   vm.createContext(ctx);
   vm.runInContext(authSource,ctx);
   await ctx.window.ElidaConta.bootstrap();
   assert.equal(ctx.window.ElidaConta.sufixo(),"");
   assert.equal(ctx.window.ElidaConta.configurada(),false);
   dados.set("elida-modo-identidade-v1","conta");
   const ctx2={window:{__ELIDA_FIREBASE_CONFIG__:null},document,localStorage,setTimeout(){},console};
   vm.createContext(ctx2);
   vm.runInContext(authSource,ctx2);
   await ctx2.window.ElidaConta.bootstrap();
   assert.equal(ctx2.window.ElidaConta.sufixo(),"conta:bloqueado:");
 });
 console.log("Integração autenticação/backup: "+pass+"/9 testes");
 if(process.exitCode)process.exit(process.exitCode);
}
executar().catch(e=>{console.error(e);process.exitCode=1;});
