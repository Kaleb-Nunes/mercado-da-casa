"use strict";
/* Elida: bloqueador de segredos e rastros no Git.
   Nunca imprimir tokens/chaves reais em logs CI. */
const fs=require("node:fs");
const cp=require("node:child_process");
const path=require("node:path");
const patterns=[
  ["private-key",/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED |DSA )?PRIVATE KEY-----/],
  ["google-oauth-secret",/GOCSPX-[A-Za-z0-9_-]{14,}/],
  ["github-token",/(?:gh[pousr]_[A-Za-z0-9_]{24,}|github_pat_[A-Za-z0-9_]{30,})/],
  ["aws-access-key",/AKIA[0-9A-Z]{16}/],
  ["openai-private-key",/sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}/],
  ["stripe-secret",/sk_(?:live|test)_[a-zA-Z0-9]{20,}/],
  ["slack-token",/xox[baprs]-[0-9A-Za-z-]{20,}/],
  ["service-account",/"type"\s*:\s*"service_account"/]
];
function nomeSensivel(nome) {
  const s=nome.toLowerCase();
  return /(?:^|\/)(?:\.env(?:\.[^/]+)?|[^/]*(?:service[-_]?account|firebase-adminsdk|credentials[-_]?private)[^/]*\.json|[^/]*\.(?:pem|p12|pfx|key|jks|keystore))$/.test(s)
    && !s.endsWith(".env.example");
}
function comando(args){return cp.execFileSync("git",args,{encoding:"utf8",maxBuffer:20*1024*1024});}
let problemas=[];
const tracked=comando(["ls-files","-z"]).split("\0").filter(Boolean);
for(const arquivo of tracked){
  if(nomeSensivel(arquivo))problemas.push({tipo:"arquivo-sensivel-rastreado",arquivo});
  const ext=path.extname(arquivo).toLowerCase();
  if(![".js",".cjs",".mjs",".ts",".json",".yml",".yaml",".html",".md",".txt",".sh",".toml",".properties",".env",".xml"].includes(ext))continue;
  if(arquivo.startsWith("vendor/") || arquivo.startsWith("tests/fixtures/") || arquivo.startsWith("tests/ocr/"))continue;
  let data;
  try{data=fs.readFileSync(arquivo,"utf8");}catch(e){continue}
  if(data.length>1_000_000)continue;
  for(const [tipo,re] of patterns){
    // Analisar somente linhas NÃO comentadas? Não: chaves reais vazam também em comentários.
    if(re.test(data))problemas.push({tipo,arquivo});
  }
}
// Procurar nomes sensíveis em TODAS as versões do Git, mesmo se o arquivo já foi removido.
// Conteúdo completo do histórico exige auditoria adicional com Gitleaks/TruffleHog.
try{
  const objetos=comando(["rev-list","--objects","--all"]).split("\n");
  for(const linha of objetos){
    const nome=linha.slice(lineaSeparacao(linha));
    if(nome && nomeSensivel(nome))problemas.push({tipo:"historico-com-arquivo-sensivel",arquivo:nome});
  }
}catch(e){
  console.error("Falha na varredura dos nomes do histórico: "+e.message.slice(0,140));
  process.exitCode=1;
}
function lineaSeparacao(s){const i=s.indexOf(" ");return i===-1?s.length:i+1;}
const seen=new Set();
for(const issue of problemas){
  const label=issue.tipo+"|"+issue.arquivo;
  if(seen.has(label))continue;
  seen.add(label);
  console.error("RISCO ["+issue.tipo+"]: "+issue.arquivo+" (valor nunca exibido)");
}
console.log("Auditoria de segredos: "+tracked.length+" arquivos rastreados, "+seen.size+" alertas. Firebase Web API key identificadora NÃO é um segredo.");
if(seen.size)process.exitCode=1;
