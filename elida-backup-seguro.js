/* Elida — backup cifrado local, Web Crypto, sem enviar dados ou senhas à rede.
   Formato v3, AES-256-GCM + PBKDF2-HMAC-SHA256 (600.000 iterações), salt/IV únicos.
   A senha não é salva no aparelho, nem enviada ao Firebase ou a serviços externos. */
(function(root, fabrica){
  "use strict";
  var api=fabrica();
  if(typeof module==="object" && module.exports) module.exports=api;
  else root.ElidaBackupSeguro=api;
})(typeof self!=="undefined"?self:this,function(){
  "use strict";
  var ITERACOES=600000, VERSAO=3, MAX_BYTES=20*1024*1024;
  var FORMATO="elida-backup-criptografado";
  function getCrypto(){
    var c=typeof globalThis!=="undefined" ? globalThis.crypto : null;
    if(!c || !c.subtle || !c.getRandomValues) throw new Error("Este navegador não oferece criptografia segura");
    return c;
  }
  function b64(bytes){
    var a=new Uint8Array(bytes), s="";
    for(var i=0;i<a.length;i+=8192) s+=String.fromCharCode.apply(null,a.slice(i,i+8192));
    return btoa(s);
  }
  function fromB64(s,maxLen){
    if(typeof s!=="string" || s.length>maxLen || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)) throw new Error("Arquivo inválido");
    var dec=atob(s), out=new Uint8Array(dec.length);
    for(var i=0;i<dec.length;i++)out[i]=dec.charCodeAt(i);
    return out;
  }
  function validarSenha(s){
    if(typeof s!=="string" || s.length<12 || s.length>512) throw new Error("Use uma senha exclusiva com pelo menos 12 caracteres");
    return s;
  }
  async function chave(crypto, senha, salt){
    var base=await crypto.subtle.importKey("raw",new TextEncoder().encode(senha),{name:"PBKDF2"},false,["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:ITERACOES,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  }
  function dadosAssociados(){return new TextEncoder().encode("Elida|Backup|3");}
  function identificar(o){return !!o && typeof o==="object" && o.formato===FORMATO;}
  async function criar(obj,senha){
    validarSenha(senha);
    if(!obj || typeof obj!=="object") throw new Error("Dados do backup inválidos");
    var crypto=getCrypto(),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    var texto=JSON.stringify(obj);
    if(!texto) throw new Error("Backup vazio");
    var plain=new TextEncoder().encode(texto);
    if(plain.byteLength>MAX_BYTES) throw new Error("Backup acima do limite de 20 MB");
    var key=await chave(crypto,senha,salt);
    var dados=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:dadosAssociados(),tagLength:128},key,plain);
    plain.fill(0);
    return {formato:FORMATO,versao:VERSAO,kdf:"PBKDF2-SHA256",iteracoes:ITERACOES,sal:b64(salt),algoritmo:"AES-256-GCM",iv:b64(iv),dados:b64(dados)};
  }
  async function abrir(env,senha){
    validarSenha(senha);
    if(!identificar(env)||env.versao!==VERSAO||env.kdf!=="PBKDF2-SHA256"||env.iteracoes!==ITERACOES||
       env.algoritmo!=="AES-256-GCM") throw new Error("Formato cifrado desconhecido");
    var salt=fromB64(env.sal,64),iv=fromB64(env.iv,48),dados=fromB64(env.dados,Math.ceil(MAX_BYTES*4/3)+1000);
    if(salt.length!==16||iv.length!==12||dados.length<16||dados.length>MAX_BYTES+16)throw new Error("Arquivo cifrado inválido");
    var crypto=getCrypto(),key=await chave(crypto,senha,salt);
    var plain;
    try{plain=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:dadosAssociados(),tagLength:128},key,dados);}
    catch(e){throw new Error("Senha incorreta ou arquivo adulterado");}
    try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(plain));}
    catch(e){throw new Error("Conteúdo descriptografado inválido");}
  }
  return Object.freeze({VERSAO:VERSAO,identificar:identificar,criar:criar,abrir:abrir});
});
