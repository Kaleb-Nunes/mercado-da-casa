/* Identidade Supabase e aprovação no servidor. Dados do visitante permanecem locais. */
(function(root){
  "use strict";
  var CONFIG=root.ELIDA_SUPABASE || null;
  var CHAVE_MODO="elida-modo-supabase-v1";
  var PREFIXO_CONTA="supabase:";
  var modo="visitante", uid="",cliente=null, usuario=null, painel=null, recuperando=false;
  var acesso={status:"nao_solicitado",papel:"usuario"};
  var iniciarApp=false;
  function modoGuardado(){try{return localStorage.getItem(CHAVE_MODO)==="conta"?"conta":"visitante";}catch(e){return "visitante";}}
  function guardarModo(m){try{localStorage.setItem(CHAVE_MODO,m);}catch(e){}}
  function configValida(){
    return CONFIG && CONFIG.origem===location.origin && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(CONFIG.url)
      && /^sb_publishable_[A-Za-z0-9_-]+$/.test(CONFIG.chavePublicavel);
  }
  function obterCliente(){
    if(!configValida())throw Error("Configuração Supabase pendente");
    if(!cliente)cliente=root.supabase.createClient(CONFIG.url,CONFIG.chavePublicavel,{
      auth:{flowType:"pkce",storage:sessionStorage,detectSessionInUrl:false}
    });
    return cliente;
  }
  function usuarioPermitido(u){return !!(u && u.email_confirmed_at && !u.is_anonymous);}
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
  function erroLegivel(e){
    if(!configValida())return "A homologação aguarda a configuração pública do Supabase.";
    if(e && e.code==="invalid_credentials")return "Confira o e-mail e a senha.";
    return "Não foi possível concluir. Confira a conexão e tente novamente.";
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
      '<button type="button" data-elida-action="nova-senha" hidden>Salvar nova senha</button>'+
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
      if(a==="fechar" && (modo!=="conta" || (uid && acesso.status==="aprovado"))) {
        fundo.hidden=true;return;
      }
      if(b.disabled)return;
      b.disabled=true;
      var textoAntes=b.textContent;
      b.setAttribute("aria-busy","true");
      b.textContent="Aguarde…";
      Promise.resolve(acao(a, b.dataset.uid)).catch(function(e){
        mensagem(erroLegivel(e));
      }).finally(function(){
        b.disabled=false;
        b.removeAttribute("aria-busy");
        b.textContent=textoAntes;
      });
    });
    document.body.appendChild(fundo);
    painel=fundo;fundo.hidden=true;
    return fundo;
  }
  function mostrar(){
    var e=panel(), rotulo=e.querySelector("[data-elida-estado]");
    var u=usuario, valido=usuarioPermitido(u) && modo==="conta";
    var aprovado=valido && acesso.status==="aprovado";
    var pendente=valido && acesso.status!=="aprovado";
    var cadastro=e.querySelectorAll('[data-elida-action="google"],[data-elida-action="login"],[data-elida-action="cadastro"],[data-elida-action="recuperar"]');
    cadastro.forEach(function(b){b.hidden=!!valido;});
    e.querySelectorAll('label').forEach(function(lbl){lbl.hidden=!!valido;});
    e.querySelector('[data-elida-action="sair"]').hidden=!valido;
    /* Não oferecer Fechar se a conta ainda não foi aprovada e a interface está isolada. */
    e.querySelector('[data-elida-action="fechar"]').hidden=!!(modo==="conta" && !aprovado);
    e.querySelector('[data-elida-action="visitante"]').hidden=false;
    e.querySelector('[data-elida-action="solicitar"]').hidden=!(pendente && acesso.status==="nao_solicitado");
    e.querySelector('[data-elida-action="atualizar-status"]').hidden=!pendente;
    e.querySelector('[data-elida-admin]').hidden=!(aprovado && acesso.papel==="superadmin");
    e.querySelector('[data-elida-action="nova-senha"]').hidden=!recuperando;
    if(recuperando)e.querySelector('[data-elida-password]').closest('label').hidden=false;
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
    if(!configValida())mensagem("Login aguardando configuração do Supabase. O modo visitante permanece disponível.");
    else if(pendente && acesso.status==="indisponivel")
      mensagem("Aprovação indisponível: verifique a conexão, o serviço de permissões. Conta não liberada.");
    else mensagem(recuperando?"Digite uma nova senha de pelo menos 12 caracteres.":"");
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
  async function bootstrap(){
    if(iniciarApp)return;
    iniciarApp=true;
    modo=modoGuardado();
    const retorno=new URL(location.href);
    const codigo=retorno.searchParams.get("code");
    if(codigo || modo==="conta"){
      try{
        const clienteAuth=obterCliente().auth;
        if(codigo){
          retorno.searchParams.delete("code");
          recuperando=retorno.searchParams.get("recuperar")==="1";
          retorno.searchParams.delete("recuperar");
          history.replaceState(null,"",retorno.pathname+retorno.search+retorno.hash);
          const troca=await clienteAuth.exchangeCodeForSession(codigo);
          if(troca.error)throw troca.error;
          guardarModo("conta");
          modo="conta";
        }
        const resultado=await clienteAuth.getUser();
        if(resultado.error)throw resultado.error;
        usuario=resultado.data.user;
        if(usuarioPermitido(usuario)){
          acesso=await root.ElidaAprovacao.verificar();
          uid=acesso.status==="aprovado" ? usuario.id : "";
        }
      }catch(e){uid=""; acesso={status:"indisponivel",papel:"usuario"};}
    }
    /* Botão criado antes da aplicação, sem iniciar rede no modo visitante. */
    var botao=document.createElement("button");
    botao.id="elida-conta-botao";botao.type="button";
    botao.textContent="Conta";
    botao.setAttribute("aria-label","Abrir conta Elida");
    botao.addEventListener("click",mostrar);
    document.body.appendChild(botao);
    if(recuperando && uid)setTimeout(mostrar,0);
    if(modo==="conta" && !uid){
      document.documentElement.setAttribute("data-elida-bloqueada","true");
      setTimeout(mostrar,0);
    }
  }
  async function acao(a, alvoUid){
    if(a==="visitante"){
      limpar();guardarModo("visitante");
      if(cliente){const res=await cliente.auth.signOut({scope:"local"});if(res.error)throw res.error;}
      location.reload();return;
    }
    if(a==="fechar"){
      if(modo!=="conta" || (uid && acesso.status==="aprovado")) panel().hidden=true;
      else mensagem("Acesso à conta pendente. Escolha Continuar como visitante ou Sair da conta.");
      return;
    }
    if(a==="sair"){
      if(cliente){const res=await cliente.auth.signOut({scope:"local"});if(res.error)throw res.error;}
      limpar();guardarModo("visitante");location.reload();return;
    }
    const auth=obterCliente().auth;
    if(a==="atualizar-status"){
      if(!usuarioPermitido(usuario))throw Error("É necessário entrar e verificar e-mail");
      acesso=await root.ElidaAprovacao.verificar();
      if(acesso.status==="aprovado"){location.reload();return;}
      mostrar();return;
    }
    if(a==="solicitar"){
      if(!usuarioPermitido(usuario))throw Error("É necessário entrar e verificar e-mail");
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
    const retorno=location.origin+location.pathname;
    if(a==="recuperar"){
      if(!email){mensagem("Informe seu e-mail.");return;}
      await auth.resetPasswordForEmail(email,{redirectTo:retorno+"?recuperar=1"});
      mensagem("Se a conta existir, confira as instruções no seu e-mail.");return;
    }
    if(a==="nova-senha"){
      if(!recuperando || senha.length<12){mensagem("Use pelo menos 12 caracteres.");return;}
      const res=await auth.updateUser({password:senha});
      if(res.error)throw res.error;
      limpar();location.reload();return;
    }
    if(a==="google"){
      const res=await auth.signInWithOAuth({provider:"google",options:{redirectTo:retorno,queryParams:{prompt:"select_account"}}});
      if(res.error)throw res.error;
      return;
    }
    if(a==="cadastro"){
      if(senha.length<12){mensagem("Escolha uma senha com pelo menos 12 caracteres.");return;}
      const res=await auth.signUp({email,password:senha,options:{emailRedirectTo:retorno}});
      if(res.error)throw res.error;
      limpar();mensagem("Verifique seu e-mail para concluir o cadastro.");return;
    }
    if(a==="login"){
      const res=await auth.signInWithPassword({email,password:senha});
      if(res.error)throw res.error;
      limpar();guardarModo("conta");location.reload();
    }
  }
  root.ElidaConta=Object.freeze({cliente:obterCliente,bootstrap:bootstrap,sufixo:sufixo,abrir:mostrar,configurada:configValida});
})(typeof window!=="undefined"?window:this);

