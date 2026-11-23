"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
const script=fs.readFileSync("elida-app.js","utf8");
const account=fs.readFileSync("elida-conta.js","utf8");
const approval=fs.readFileSync("elida-aprovacao.js","utf8");

test("todos os botões da interface principal possuem uma ação reconhecida",()=>{
  const actions=[...new Set([...((html+"\n"+script).matchAll(/data-act=["']([a-z0-9-]+)["']/g))].map(m=>m[1]))];
  assert.ok(actions.length>=55,"Número de ações inesperadamente baixo: "+actions.length);
  for(const a of actions){
    assert.ok(script.includes('case "'+a+'":'),"Botão sem tratamento no JavaScript: "+a);
  }
});
test("abas de navegação correspondem a telas existentes",()=>{
  const views=script.match(/var VIEWS = \[([^\]]+)\]/);
  assert.ok(views,"Lista de navegação ausente");
  const nomes=[...views[1].matchAll(/"([a-z]+)"/g)].map(m=>m[1]);
  assert.ok(nomes.length>=7);
  for(const v of nomes){
    assert.ok(html.includes('id="view-'+v+'"'),"Tela não encontrada: "+v);
    assert.ok(script.includes('"'+v+'"'),"Navegação sem tratamento: "+v);
  }
});
test("todos os botões do painel de conta têm ação de clique",()=>{
  const labels=[...new Set([...account.matchAll(/data-elida-action=["']([a-z-]+)["']/g)].map(m=>m[1]))];
  assert.ok(labels.length>=11, "Esperava no mínimo 11 ações de conta, recebeu "+labels.length);
  for(const a of labels){
    assert.ok(account.includes('a==="'+a+'"') || account.includes('a==="aprovar"||a==="rejeitar"||a==="bloquear"') && ["rejeitar","bloquear"].includes(a),
      "Ação sem tratamento: "+a);
  }
  assert.match(account,/a==="fechar" && \(modo!=="conta" \|\| \(uid && acesso\.status==="aprovado"\)\)/);
});

function criarAmbiente(modoGuardado){
  const dados=new Map();
  if(modoGuardado)dados.set("elida-modo-supabase-v1",modoGuardado);
  const elems=[];
  const mk=()=>({
    events:Object.create(null),attrs:Object.create(null),dataset:{},hidden:false,disabled:false,
    textContent:"",innerHTML:"",children:[],focusCount:0,
    setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},
    getAttribute(k){return k==="data-elida-action"?this.dataset.action:this.attrs[k];},
    addEventListener(n,fn){this.events[n]=fn;},focus(){this.focusCount++;},
    appendChild(child){this.children.push(child);},
    removeChild(child){this.children=this.children.filter(x=>x!==child);},
    get firstChild(){return this.children[0]||null;},
    closest(){return this;},
    querySelector(sel){
      this._elements ||=new Map();
      if(!this._elements.has(sel))this._elements.set(sel,mk());
      return this._elements.get(sel);
    },
    querySelectorAll(sel){
      if(sel==="label")return [this.querySelector("label1"),this.querySelector("label2")];
      if(sel.startsWith("[data-elida-action"))return [this.querySelector("google"),this.querySelector("login")];
      return [];
    }
  });
  const document={
    querySelector(sel){return sel === ".top" ? this.body : null;},
    body:{appendChild(el){elems.push(el);}},
    documentElement:{attrs:{},setAttribute(k,v){this.attrs[k]=v;}},
    createElement:mk,
  };
  const store={
    getItem(k){return dados.get(k)??null;},
    setItem(k,v){dados.set(k,String(v));}
  };
  let reloads=0;
  const window={ELIDA_SUPABASE:null};
  const ctx=vm.createContext({window,document,localStorage:store,console,URL,
    location:{href:'https://teste.example/',reload(){reloads++;}},setTimeout(fn){fn();}});
  new vm.Script(account).runInContext(ctx);
  return {document,window,elems,store,dados,get reloads(){return reloads;}};
}
function botao(dialogo,action){
  const el=dialogo.querySelector('[data-elida-action="'+action+'"]');
  el.dataset.action=action;
  return el;
}
async function clicar(dialogo,action){
  const b=botao(dialogo,action);
  dialogo.events.click({target:b});
  await new Promise(r=>setImmediate(r));
  return b;
}
test("modo visitante abre e fecha painel com clique real no evento",async()=>{
  const env=criarAmbiente(null);
  await env.window.ElidaConta.bootstrap();
  const topo=env.elems[0];
  assert.equal(topo.id,"elida-conta-botao");
  assert.equal(typeof topo.events.click,"function");
  topo.events.click();
  const dialogo=env.elems[1];
  assert.equal(dialogo.hidden,false);
  assert.equal(botao(dialogo,"fechar").hidden,false);
  await clicar(dialogo,"fechar");
  assert.equal(dialogo.hidden,true,"Fechar deveria encerrar modal para visitante");
});
test("conta sem aprovação não prende usuário no app; visitante sempre disponível",async()=>{
  const env=criarAmbiente("conta");
  await env.window.ElidaConta.bootstrap();
  assert.equal(env.document.documentElement.attrs["data-elida-bloqueada"],"true");
  const dialogo=env.elems[1];
  assert.equal(dialogo.hidden,false);
  assert.equal(botao(dialogo,"fechar").hidden,true,"Não mostrar Fechar que deixaria a conta bloqueada");
  const guest=await clicar(dialogo,"visitante");
  assert.equal(guest.disabled,false,"O botão visitante precisa voltar ao estado ativo");
  assert.equal(env.dados.get("elida-modo-supabase-v1"),"visitante");
  assert.equal(env.reloads,1,"Alternar para visitante precisa recarregar o app");
});
test("erro no login mostra causa e devolve capacidade de clicar",async()=>{
  const env=criarAmbiente(null);
  await env.window.ElidaConta.bootstrap();
  env.elems[0].events.click();
  const dialogo=env.elems[1];
  const login=await clicar(dialogo,"google");
  const status=dialogo.querySelector("[data-elida-msg]").textContent;
  assert.match(status,/entrada com conta ainda não está disponível neste endereço/i);
  assert.equal(login.disabled,false);
  assert.equal(login.textContent,"", "Botão recupera texto original após falha (mock sem conteúdo inicial)");
});
test("aprovação depende da resposta da RPC autenticada",async()=>{
  assert.match(approval,/if\(error\)throw error/);
  assert.match(account,/acesso=await root\.ElidaAprovacao\.verificar/);
  assert.match(account,/uid=acesso\.status==="aprovado"/);
  assert.match(approval,/rpc\("elida_meu_acesso"\)/);
});
