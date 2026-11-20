"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
assert.ok(globalThis.crypto && globalThis.crypto.subtle, "Web Crypto indisponível no Node");
const c=require("../elida-backup-seguro.js");
const markup=fs.readFileSync("index.html","utf8");
const app=fs.readFileSync("elida-app.js","utf8");
const html=markup+"\n"+app;
const conta=fs.readFileSync("elida-conta.js","utf8");
const aprovacao=fs.readFileSync("elida-aprovacao.js","utf8");
const config=fs.readFileSync("elida-supabase-config.js","utf8");
const headers=fs.readFileSync("_headers","utf8");
const sw=fs.readFileSync("sw.js","utf8");
let ok=0;
async function teste(nome,fn){try{await fn();ok++;console.log("OK "+nome);}catch(e){console.error("FALHA "+nome+": "+e.message);process.exitCode=1;}}
(async()=>{
await teste("Sintaxe JS de autenticação, criptografia e app integrado",()=>{
 new vm.Script(conta);
 new vm.Script(aprovacao);
 assert.match(markup, /<script src="elida-aprovacao\.js"><\/script>/);
 new vm.Script(fs.readFileSync("elida-backup-seguro.js","utf8"));
 assert.match(markup, /<script src="elida-app\.js"><\/script>/);
 assert.doesNotMatch(markup, /<script>\s*\(async function/);
 new vm.Script(app,{filename:"elida-app.js"});
});
await teste("SDK local e configuração Supabase da prévia",()=>{
 new vm.Script(config);
 assert.ok(markup.includes('src="vendor/supabase/sdk.js"'));
 assert.ok(markup.includes('src="elida-supabase-config.js"'));
 assert.ok(!markup.includes('src="elida-firebase-config.js"'));
});
await teste("Login em sessão, OAuth com PKCE e aprovação no servidor",()=>{
 assert.ok(conta.includes('flowType:"pkce"'));
 assert.ok(conta.includes('signInWithOAuth'));
 assert.ok(conta.includes('signInWithPassword'));
 assert.ok(conta.includes('ElidaAprovacao.verificar'));
 assert.ok(aprovacao.includes('elida_meu_acesso'));
 assert.match(html,/SYNC_FAMILIAR_ACL_HOMOLOGADA = false/);
 assert.match(html,/PFX = AMB\.prefixoDados \+ \(window\.ElidaConta/);
});
await teste("Modo visitante tem prefixo legado e conta tem prefixo próprio",()=>{
 const win={ELIDA_SUPABASE:null,localStorage:{getItem:()=>null}};
 vm.runInNewContext(conta,{window:win,console});
 assert.equal(win.ElidaConta.sufixo(),"");
 assert.equal(win.ElidaConta.configurada(),false);
});
await teste("Tela de backup não oferece exportação de texto puro",()=>{
 assert.match(html,/Cr(i|í)ar backup criptografado/);
 assert.match(html,/ElidaBackupSeguro\.criar\(pacoteBackup\(\),senha\)/);
 assert.match(html,/ElidaBackupSeguro\.abrir\(env,senha\)/);
 assert.doesNotMatch(html,/data-act="copiar-backup">Copiar/);
});
await teste("Cifra pacote completo com fotos e dados de saúde, sem texto claro",async()=>{
 const pacote={formato:"elida-backup",versao:2,estado:{items:[{nome:"Feijão"}],meses:{}},fotos:{a:"data:image/jpeg;base64,AAAA"},perfis:{perfis:[{apelido:"Dado de saúde"}]}};
 const env=await c.criar(pacote,"Frase Segura e Exclusiva #2026");
 assert.equal(env.formato,"elida-backup-criptografado");
 assert.equal(env.versao,3);
 assert.equal(env.algoritmo,"AES-256-GCM");
 assert.equal(env.kdf,"PBKDF2-SHA256");
 assert.equal(env.iteracoes,600000);
 assert.equal(env.iv.length,16);
 assert.ok(!JSON.stringify(env).includes("Dado de saúde"));
 assert.ok(!JSON.stringify(env).includes("Feijão"));
 assert.deepEqual(await c.abrir(env,"Frase Segura e Exclusiva #2026"),pacote);
 globalThis.__elidaTeste=env;
});
await teste("Senha incorreta e arquivo modificado são rejeitados",async()=>{
 const env=globalThis.__elidaTeste;
 await assert.rejects(()=>c.abrir(env,"Senha diferente e longa 2026"),/Senha incorreta/);
 const alterado={...env,dados:(env.dados[0]==="A"?"B":"A")+env.dados.slice(1)};
 await assert.rejects(()=>c.abrir(alterado,"Frase Segura e Exclusiva #2026"),/Senha incorreta/);
});
await teste("Não aceita senhas fracas ou cabeçalho de KDF reduzido",async()=>{
 const env=globalThis.__elidaTeste;
 await assert.rejects(()=>c.criar({x:1},"123"),/pelo menos 12/);
 await assert.rejects(()=>c.abrir({...env,iteracoes:1},"Frase Segura e Exclusiva #2026"),/Formato cifrado desconhecido/);
 await assert.rejects(()=>c.abrir({...env,algoritmo:"none"},"Frase Segura e Exclusiva #2026"),/Formato cifrado desconhecido/);
});
await teste("IV e sal são aleatórios por backup",async()=>{
 const a=globalThis.__elidaTeste,b=await c.criar({x:1},"Frase Segura e Exclusiva #2026");
 assert.notEqual(a.iv,b.iv);assert.notEqual(a.sal,b.sal);
});
await teste("Cabeçalhos de Cloudflare têm CSP, antiframing e CSP de login Google",()=>{
 assert.match(headers,/Content-Security-Policy:/);
 assert.match(headers,/frame-ancestors 'none'/);
 assert.match(headers,/script-src-attr 'none'/);
 assert.match(headers,/X-Frame-Options: DENY/);
 assert.match(headers,/same-origin-allow-popups/);
 assert.doesNotMatch(headers,/identitytoolkit\.googleapis\.com/);
 assert.match(headers,/connect-src 'self'/);
 assert.match(headers,/GitHub Pages IGNORA/);
});
await teste("PWA faz cache dos módulos públicos sem guardar dados privados",()=>{
 for(const file of ["vendor/supabase/sdk.js","elida-backup-seguro.js","elida-supabase-config.js","elida-conta.js","elida-aprovacao.js"])assert.ok(sw.includes('"./'+file+'"'));
 assert.match(sw,/if \(url\.origin !== self\.location\.origin \|\| url\.search\) return;/);
});
console.log("Segurança Elida IA integrada: "+ok+"/11 testes");
if(process.exitCode)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

