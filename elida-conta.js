/* Elida — identidade opcional, isolamento de dados locais e visitante sem telemetria.
   NÃO habilita Firestore/sync; sem config validada o login não é iniciado.
   SDK de autenticação carregado apenas quando um usuário solicita o login.
   Firebase Web SDK oficial, versão 12.4.0; não implementar OAuth manualmente. */
(function(root){
  "use strict";
  var CONFIG=root.__ELIDA_FIREBASE_CONFIG__ || null;
  var CHAVE_MODO="elida-modo-identidade-v1";
  var PREFIXO_CONTA="conta:";
  var modo="visitante", uid="",auth=null, sdk=null, pronta=null, painel=null;
  var iniciarApp=false, appFirebase=null, estadoConta="nao_solicitado", adminAtual=false;
  function modoGuardado(){try{return localStorage.getItem(CHAVE_MODO)==="conta"?"conta":"visitante";}catch(e){return "visitante";}}
  function guardarModo(m){try{localStorage.setItem(CHAVE_MODO,m);}catch(e){}}
  function configValida(){
    return !!CONFIG && CONFIG.projectId==="projeto-elida-aplv"
      && CONFIG.authDomain==="projeto-elida-aplv.firebaseapp.com"
      && typeof CONFIG.apiKey==="string" && CONFIG.apiKey.length>20
      && typeof CONFIG.appId==="string" && CONFIG.appId.length>5;
  }
  function usuarioPermitido(u){
    return !!u && !u.isAnonymous && !!u.email && u.emailVerified===true
      && Array.isArray(u.providerData)
      && u.providerData.some(function(p){return p.providerId==="google.com" || p.providerId==="password";});
  }
  function sufixo(){
    if(modo!=="conta")return "";
    return PREFIXO_CONTA+(uid || "bloqueado")+":";
  }
  function mensagem(m){
    var p=panel().querySelector("[data-elida-msg]");
    p.textContent=String(m || "");
  }
  function campo(id){
    var e=panel().querySelector("[data-elida-"+id+"]");
    return e ? String(e.value || "") : "";
  }
  function limpar(){
    ["email","password"].forEach(function(n){var e=panel().querySelector("[data-elida-"+n+"]");if(e)e.value="";});
  }
  function panel(){
    if(painel)return painel;
    var fundo=document.createElement("div");
    fundo.id="elida-conta-painel";
    fundo.setAttribute("role","dialog");fundo.setAttribute("aria-modal","true");
    fundo.setAttribute("aria-label","Conta Elida");
    /* Todo o HTML é estático; nenhum valor de usuário será interpolado. */
    fundo.innerHTML='<div class="elida-account-card"><h2>Conta Elida</h2>'+
      '<p data-elida-estado>Entre com Google ou e-mail. Sem login, o modo visitante funciona no próprio aparelho.</p>'+
      '<p data-elida-msg role="status" aria-live="polite"></p>'+
      '<p data-elida-permissao role="status" aria-live="polite">Usuários novos precisam de aprovação do administrador.</p>'+
      '<label>E-mail<input type="email" autocomplete="email" data-elida-email maxlength="254"></label>'+
      '<label>Senha<input type="password" autocomplete="current-password" data-elida-password maxlength="256"></label>'+
      '<div class="elida-account-actions">'+
      '<button type="button" data-elida-action="google">Entrar com Google</button>'+
      '<button type="button" data-elida-action="login">Entrar por e-mail</button>'+
      '<button type="button" data-elida-action="cadastro">Criar conta</button>'+
      '<button type="button" data-elida-action="recuperar">Recuperar senha</button>'+
      '<button type="button" data-elida-action="solicitar" hidden>Solicitar aprovação</button>'+
      '<button type="button" data-elida-action="verificar" hidden>Consultar minha solicitação</button>'+
      '<button type="button" data-elida-action="lista" hidden>Gerenciar solicitações</button>'+
      '<div data-elida-lista role="region" aria-label="Solicitações de usuários"></div>'+
      '<button type="button" data-elida-action="sair" hidden>Sair da conta</button>'+
      '<button type="button" data-elida-action="visitante">Continuar como visitante</button>'+
      '<button type="button" data-elida-action="fechar">Fechar</button></div></div>';
    fundo.addEventListener("click",function(ev){
      var b=ev.target.closest("[data-elida-action]");
      if(!b)return;
      var a=b.getAttribute("data-elida-action");
      if(a==="fechar" && (modo!=="conta" || uid)) {fundo.hidden=true;return;}
      b.disabled=true;
      Promise.resolve(acao(a,b.dataset.uid || "")).catch(function(e){
        if(a!=="recuperar")mensagem("Não foi possível concluir. Verifique os dados, a conexão e as configurações de acesso.");
      }).finally(function(){b.disabled=false;});
    });
    document.body.appendChild(fundo);
    painel=fundo;fundo.hidden=true;
    return fundo;
  }
  function mostrar(){
    var e=panel(), rotulo=e.querySelector("[data-elida-estado]");
    var u=auth && auth.currentUser;
    rotulo.textContent=u && modo==="conta" ? "Conta: "+(u.email || "autenticada")+" — dados locais separados do visitante. A sincronização familiar permanece desativada." : "Use uma conta Google ou e-mail verificado. Sem login, dados ficam no modo visitante local.";
    e.querySelector('[data-elida-action="sair"]').hidden=!(u && modo==="conta");
    if(!configValida())mensagem("Login aguardando configuração do Firebase Web.");
    else if(!root.ElidaAprovacao || !root.ElidaAprovacao.disponivel())
      mensagem("Aprovação de contas ainda não ativada: App Check pendente. Acesso protegido bloqueado.");
    else mensagem("");
    atualizarPainel();
    if(u && usuarioPermitido(u) && root.ElidaAprovacao && root.ElidaAprovacao.disponivel()){
      atualizarStatus().then(atualizarPainel,function(){
        mensagem("Não foi possível verificar a autorização no servidor. Acesso protegido bloqueado.");
      });
    }
    e.hidden=false;
    e.querySelector('[data-elida-action="visitante"]').focus();
  }
  async function carregarSDK(){
    if(!configValida())throw new Error("Firebase Web não configurado");
    if(pronta)return pronta;
    pronta=(async function(){
      var m=await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js")
      ]);
      sdk=Object.assign({},m[1]);
      var app=m[0].getApps().filter(x=>x.name==="elida-identidade")[0] ||
        m[0].initializeApp(CONFIG,"elida-identidade");
      appFirebase=app;
      auth=sdk.getAuth(app);
      await sdk.setPersistence(auth,sdk.browserSessionPersistence);
      await new Promise(function(resolve,reject){
        var encerrou=false;
        var cancelar=sdk.onAuthStateChanged(auth,function(){
          if(encerrou)return;encerrou=true;cancelar();resolve();
        },function(err){if(encerrou)return;encerrou=true;cancelar();reject(err);});
      });
      return auth;
    })().catch(function(e){pronta=null;throw e;});
    return pronta;
  }
  async function bootstrap(){
    if(iniciarApp)return;iniciarApp=true;
    modo=modoGuardado();
    if(modo==="conta"){
      try{
        await carregarSDK();
        if(auth && usuarioPermitido(auth.currentUser)){
          try {
            var resultado=await atualizarStatus();
            uid=resultado.status==="aprovado" ? auth.currentUser.uid : "";
          } catch(e){ uid=""; }
        }else{uid="";}
      }catch(e){uid="";}
    }
    /* Botão criado antes da aplicação, sem iniciar rede no modo visitante. */
    var botao=document.createElement("button");
    botao.id="elida-conta-botao";botao.type="button";
    botao.textContent="Conta";
    botao.setAttribute("aria-label","Abrir conta Elida");
    botao.addEventListener("click",mostrar);
    document.body.appendChild(botao);
    if(modo==="conta" && !uid){
      document.documentElement.setAttribute("data-elida-bloqueada","true");
      setTimeout(mostrar,0);
    }
  }
  async function servidor(nome,dados){
    await carregarSDK();
    if(!appFirebase || !root.ElidaAprovacao || !root.ElidaAprovacao.disponivel())
      throw new Error("App Check não foi ativado");
    await root.ElidaAprovacao.iniciar(appFirebase);
    return root.ElidaAprovacao.chamada(nome,dados || {});
  }
  async function atualizarStatus(){
    if(!auth || !usuarioPermitido(auth.currentUser))throw new Error("Faça login com e-mail verificado");
    var resposta=await servidor("consultarMeuAcesso");
    estadoConta=resposta.status || "nao_solicitado";
    adminAtual=resposta.administrador===true;
    return resposta;
  }
  function atualizarPainel(){
    if(!painel)return;
    var u=auth && auth.currentUser;
    var autenticado=!!(u && usuarioPermitido(u));
    var rotulo=painel.querySelector("[data-elida-permissao]");
    var texto={
      aprovado: adminAtual ? "Superadministrador autorizado" : "Cadastro aprovado",
      pendente:"Solicitação pendente de aprovação do superadministrador",
      rejeitado:"Solicitação rejeitada. Contate o administrador.",
      suspenso:"Conta suspensa pelo administrador",
      nao_solicitado:"Entre com uma conta verificada para solicitar acesso"
    };
    rotulo.textContent=texto[estadoConta] || texto.nao_solicitado;
    painel.querySelector('[data-elida-action="solicitar"]').hidden=!autenticado || estadoConta!=="nao_solicitado";
    painel.querySelector('[data-elida-action="verificar"]').hidden=!autenticado;
    painel.querySelector('[data-elida-action="lista"]').hidden=!adminAtual;
  }
  function renderSolicitacoes(usuarios){
    if(!painel)return;
    var destino=painel.querySelector("[data-elida-lista]");
    destino.replaceChildren();
    var titulo=document.createElement("h3");titulo.textContent="Solicitações de acesso";destino.appendChild(titulo);
    if(!Array.isArray(usuarios)||!usuarios.length){
      var vazio=document.createElement("p");vazio.textContent="Nenhuma solicitação recebida";destino.appendChild(vazio);return;
    }
    usuarios.forEach(function(u){
      if(!u || typeof u.uid!=="string")return;
      var linha=document.createElement("div");linha.className="elida-solicitacao";
      var p=document.createElement("p");
      p.textContent=(u.email || "Conta") + " — " + (u.status || "sem status");
      linha.appendChild(p);
      var op={pendente:[["aprovar","Aprovar"],["rejeitar","Rejeitar"]],
        aprovado:[["suspender","Suspender"]],
        suspenso:[["reativar","Reativar"]],
        rejeitado:[["aprovar","Aprovar"]]};
      (op[u.status]||[]).forEach(function(x){
        var btn=document.createElement("button");btn.type="button";
        btn.textContent=x[1];btn.dataset.elidaAction=x[0];btn.dataset.uid=u.uid;
        linha.appendChild(btn);
      });
      destino.appendChild(linha);
    });
  }
  async function acao(a,alvo){
    if(a==="visitante"){
      limpar();guardarModo("visitante");
      if(auth)await sdk.signOut(auth);
      location.reload();return;
    }
    if(a==="fechar"){if(modo!=="conta" || uid)panel().hidden=true;return;}
    if(a==="sair"){
      if(auth)await sdk.signOut(auth);
      limpar();guardarModo("visitante");location.reload();return;
    }
    if(a==="solicitar"){
      if(!auth || !usuarioPermitido(auth.currentUser)){mensagem("Entre com conta verificada primeiro.");return;}
      var pedido=await servidor("solicitarAcesso");
      estadoConta=pedido.status;adminAtual=pedido.administrador===true;
      atualizarPainel();mensagem("Solicitação registrada. Aguarde aprovação.");return;
    }
    if(a==="verificar"){
      var status=await atualizarStatus();atualizarPainel();
      if(status.status==="aprovado"){guardarModo("conta");location.reload();return;}
      mensagem("Situação atual: "+status.status);return;
    }
    if(a==="lista"){
      if(!adminAtual)throw new Error("Acesso administrativo não autorizado");
      var lista=await servidor("listarSolicitacoes");
      renderSolicitacoes(lista.usuarios);return;
    }
    if(["aprovar","rejeitar","suspender","reativar"].includes(a)){
      if(!adminAtual)throw new Error("Operação administrativa negada");
      await servidor("decidirAcesso",{uid:alvo,acao:a});
      var novos=await servidor("listarSolicitacoes");
      renderSolicitacoes(novos.usuarios);
      mensagem("Decisão registrada no servidor.");return;
    }
    await carregarSDK();
    var email=campo("email").trim(),senha=campo("password");
    if(a==="recuperar"){
      if(!email){mensagem("Informe seu e-mail.");return;}
      try{await sdk.sendPasswordResetEmail(auth,email);}catch(e){}
      mensagem("Se a conta existir, você receberá instruções por e-mail.");return;
    }
    if(a==="google"){
      var provider=new sdk.GoogleAuthProvider();
      await sdk.signInWithPopup(auth,provider);
    }else if(a==="cadastro"){
      if(senha.length<12){mensagem("Escolha uma senha com pelo menos 12 caracteres.");return;}
      var u=await sdk.createUserWithEmailAndPassword(auth,email,senha);
      await sdk.sendEmailVerification(u.user);
      await sdk.signOut(auth);limpar();
      mensagem("Enviamos uma mensagem para verificar seu e-mail. Confirme antes de entrar.");return;
    }else if(a==="login"){
      var cred=await sdk.signInWithEmailAndPassword(auth,email,senha);
      if(!cred.user.emailVerified){
        await sdk.signOut(auth);limpar();
        mensagem("Verifique seu e-mail antes de acessar a conta.");return;
      }
    }else return;
    if(!usuarioPermitido(auth.currentUser)){ await sdk.signOut(auth); throw new Error("Conta não verificada ou provedor não permitido"); }
    var situacao=await atualizarStatus();
    atualizarPainel();
    if(situacao.status==="aprovado"){
      limpar();uid=auth.currentUser.uid;guardarModo("conta");location.reload();return;
    }
    limpar();
    painel=panel();
    painel.hidden=false;
    mensagem(situacao.status==="nao_solicitado"?
      "Login válido. Clique em Solicitar aprovação para obter acesso.":
      "Login válido, mas seu acesso aguarda autorização: "+situacao.status);
  }
  root.ElidaConta=Object.freeze({bootstrap:bootstrap,sufixo:sufixo,abrir:mostrar,configurada:configValida});
})(typeof window!=="undefined"?window:this);
