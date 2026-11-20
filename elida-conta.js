/* Elida — identidade opcional, isolamento de dados locais e visitante sem telemetria.
   NÃO habilita Firestore/sync; sem config validada o login não é iniciado.
   SDK de autenticação carregado apenas quando um usuário solicita o login.
   Firebase Web SDK oficial, versão 12.4.0; não implementar OAuth manualmente. */
(function(root){
  "use strict";
  var CONFIG=root.__ELIDA_FIREBASE_CONFIG__ || null;
  var CHAVE_MODO="elida-modo-identidade-v1";
  var PREFIXO_CONTA="conta:";
  var modo="visitante", uid="",auth=null, sdk=null, pronta=null, painel=null, firebaseApp=null;
  var acesso={status:"nao_solicitado",papel:"usuario"};
  var iniciarApp=false;
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
      '<label>E-mail<input type="email" autocomplete="email" data-elida-email maxlength="254"></label>'+
      '<label>Senha<input type="password" autocomplete="current-password" data-elida-password maxlength="256"></label>'+
      '<div class="elida-account-actions">'+
      '<button type="button" data-elida-action="google">Entrar com Google</button>'+
      '<button type="button" data-elida-action="login">Entrar por e-mail</button>'+
      '<button type="button" data-elida-action="cadastro">Criar conta</button>'+
      '<button type="button" data-elida-action="recuperar">Recuperar senha</button>'+
      '<button type="button" data-elida-action="solicitar" hidden>Solicitar acesso ao Elida</button>'+
      '<button type="button" data-elida-action="atualizar-status" hidden>Verificar aprovação</button>'+
      '<section data-elida-admin hidden><h3>Administração de acessos</h3>'+
      '<p>Pedidos aguardando sua aprovação. A senha dos usuários nunca é exibida.</p>'+
      '<button type="button" data-elida-action="listar-pedidos">Ver solicitações pendentes</button>'+
      '<button type="button" data-elida-action="listar-contas">Gerenciar usuários cadastrados</button>'+
      '<div data-elida-lista role="region" aria-live="polite" aria-label="Contas e solicitações"></div></section>'+
      '<button type="button" data-elida-action="sair" hidden>Sair da conta</button>'+
      '<button type="button" data-elida-action="visitante">Continuar como visitante</button>'+
      '<button type="button" data-elida-action="fechar">Fechar</button></div></div>';
    fundo.addEventListener("click",function(ev){
      var b=ev.target.closest("[data-elida-action]");
      if(!b)return;
      var a=b.getAttribute("data-elida-action");
      if(a==="fechar" && modo!=="conta") {fundo.hidden=true;return;}
      b.disabled=true;
      Promise.resolve(acao(a, b.dataset.uid)).catch(function(e){
        if(a!=="recuperar")mensagem("Não foi possível concluir. Verifique os dados, a conexão e as configurações de acesso.");
      }).finally(function(){b.disabled=false;});
    });
    document.body.appendChild(fundo);
    painel=fundo;fundo.hidden=true;
    return fundo;
  }
  function mostrar(){
    var e=panel(), rotulo=e.querySelector("[data-elida-estado]");
    var u=auth && auth.currentUser, valido=usuarioPermitido(u) && modo==="conta";
    var aprovado=valido && acesso.status==="aprovado";
    var pendente=valido && acesso.status!=="aprovado";
    var cadastro=e.querySelectorAll('[data-elida-action="google"],[data-elida-action="login"],[data-elida-action="cadastro"],[data-elida-action="recuperar"]');
    cadastro.forEach(function(b){b.hidden=!!valido;});
    e.querySelectorAll('label').forEach(function(lbl){lbl.hidden=!!valido;});
    e.querySelector('[data-elida-action="sair"]').hidden=!valido;
    e.querySelector('[data-elida-action="solicitar"]').hidden=!(pendente && acesso.status==="nao_solicitado");
    e.querySelector('[data-elida-action="atualizar-status"]').hidden=!pendente;
    e.querySelector('[data-elida-admin]').hidden=!(aprovado && acesso.papel==="superadmin");
    if(aprovado){
      rotulo.textContent="Conta aprovada: "+(u.email || "autenticada")+
        (acesso.papel==="superadmin"?" — Superadministrador":" — Usuário")+
        ". Dados pessoais permanecem separados por conta.";
    }else if(pendente){
      var detalhes={
        nao_solicitado:"Sua conta ainda não solicitou a liberação de acesso.",
        pendente:"Cadastro enviado. Aguarde a aprovação do superadministrador.",
        rejeitado:"Esta solicitação não foi aprovada.",
        bloqueado:"O acesso desta conta está bloqueado.",
        indisponivel:"Não foi possível confirmar as permissões com o servidor. Acesso protegido até nova verificação."
      };
      rotulo.textContent="Conta: "+(u.email || "verificada")+". "+(detalhes[acesso.status] || detalhes.indisponivel);
    }else{
      rotulo.textContent="Use uma conta Google ou e-mail verificado. Sem login, seus dados ficam apenas neste aparelho.";
    }
    if(!configValida())mensagem("Login aguardando configuração do aplicativo Web no Firebase. O modo visitante permanece disponível.");
    else if(pendente && acesso.status==="indisponivel")
      mensagem("Aprovação indisponível: verifique a conexão, o App Check e as Functions. Conta não liberada.");
    else mensagem("");
    e.hidden=false;
    var alvo=e.querySelector('[data-elida-action="visitante"]');
    if(alvo)alvo.focus();
  }
  async function listarAdmin(tipo){
    if(acesso.papel!=="superadmin" || acesso.status!=="aprovado")throw Error("Sem autorização");
    var api=root.ElidaAprovacao;
    var dados=tipo==="pedidos" ? await api.listarSolicitacoes() : await api.listarAcessos();
    var area=panel().querySelector("[data-elida-lista]");
    while(area.firstChild)area.removeChild(area.firstChild);
    if(!dados.length){area.textContent="Nenhuma conta nesta lista.";return;}
    dados.forEach(function(d){
      if(!d || typeof d.uid!=="string" || !/^[A-Za-z0-9_-]{6,128}$/.test(d.uid))return;
      var linha=document.createElement("div");linha.className="elida-admin-linha";
      var nome=document.createElement("span");
      nome.textContent=String(d.email || "Usuário sem e-mail")+" · "+String(d.status || "pendente");
      linha.appendChild(nome);
      var decisoes=tipo==="pedidos"?["aprovar","rejeitar"]:["aprovar","bloquear"];
      decisoes.forEach(function(decisao){
        var b=document.createElement("button");b.type="button";b.textContent=decisao==="aprovar"?"Aprovar":decisao==="rejeitar"?"Rejeitar":"Bloquear";
        b.setAttribute("data-elida-action",decisao);b.dataset.uid=d.uid;
        linha.appendChild(b);
      });
      area.appendChild(linha);
    });
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
      firebaseApp=app;
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
          acesso=await root.ElidaAprovacao.verificar(firebaseApp,auth);
          uid=acesso.status==="aprovado" ? auth.currentUser.uid : "";
        }else{uid="";}
      }catch(e){uid="";acesso={status:"indisponivel",papel:"usuario"};}
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
  async function acao(a, alvoUid){
    if(a==="visitante"){
      limpar();guardarModo("visitante");
      if(auth)await sdk.signOut(auth);
      location.reload();return;
    }
    if(a==="fechar"){if(modo!=="conta")panel().hidden=true;return;}
    if(a==="sair"){
      if(auth)await sdk.signOut(auth);
      limpar();guardarModo("visitante");location.reload();return;
    }
    await carregarSDK();
    if(a==="atualizar-status"){
      if(!usuarioPermitido(auth.currentUser))throw Error("É necessário entrar e verificar e-mail");
      acesso=await root.ElidaAprovacao.verificar(firebaseApp,auth);
      if(acesso.status==="aprovado"){location.reload();return;}
      mostrar();return;
    }
    if(a==="solicitar"){
      if(!usuarioPermitido(auth.currentUser))throw Error("É necessário entrar e verificar e-mail");
      await root.ElidaAprovacao.configurar(firebaseApp,auth);
      acesso=await root.ElidaAprovacao.solicitar();
      mostrar();mensagem("Solicitação registrada. Aguarde a análise do administrador.");return;
    }
    if(a==="listar-pedidos"||a==="listar-contas"){
      await listarAdmin(a==="listar-pedidos"?"pedidos":"contas");return;
    }
    if(a==="aprovar"||a==="rejeitar"||a==="bloquear"){
      if(acesso.papel!=="superadmin"||acesso.status!=="aprovado")throw Error("Sem autorização");
      if(typeof alvoUid!=="string"||!/^[A-Za-z0-9_-]{6,128}$/.test(alvoUid))throw Error("Usuário inválido");
      if(!window.confirm("Confirma "+a+" para esta conta?"))return;
      await root.ElidaAprovacao.decidir(alvoUid,a);
      await listarAdmin(a==="bloquear"?"contas":"pedidos");
      mensagem("Permissão atualizada no servidor.");return;
    }
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
    limpar();guardarModo("conta");location.reload();
  }
  root.ElidaConta=Object.freeze({bootstrap:bootstrap,sufixo:sufixo,abrir:mostrar,configurada:configValida});
})(typeof window!=="undefined"?window:this);
