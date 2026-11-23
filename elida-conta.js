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
    return !!CONFIG && CONFIG.origem===location.origin && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(CONFIG.url)
      && /^sb_publishable_[A-Za-z0-9_-]+$/.test(CONFIG.chavePublicavel);
  }
  /* Prévia de teste: a configuração existe, mas vale só para o endereço oficial. Devolve esse endereço para a tela de entrada. */
  function enderecoOficial(){
    if(!CONFIG || configValida() || typeof CONFIG.origem!=="string" || !/^https:\/\/[a-z0-9.-]+$/.test(CONFIG.origem))return "";
    return CONFIG.origem+"/";
  }
  function obterCliente(){
    if(!configValida())throw Error("Configuração Supabase pendente");
    if(!cliente){
      // Links de e-mail podem retornar em outra aba. Somente o verificador PKCE
      // é compartilhado entre abas; os tokens da sessão ficam na aba atual.
      const armazenamento=(chave)=>chave.endsWith("-code-verifier")?localStorage:sessionStorage;
      const storage={
        getItem:(chave)=>armazenamento(chave).getItem(chave),
        setItem:(chave,valor)=>armazenamento(chave).setItem(chave,valor),
        removeItem:(chave)=>armazenamento(chave).removeItem(chave)
      };
      cliente=root.supabase.createClient(CONFIG.url,CONFIG.chavePublicavel,{
        auth:{flowType:"pkce",storage,detectSessionInUrl:false}
      });
    }
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
    if(!configValida())return enderecoOficial()
      ? "Este é um endereço de teste: aqui não dá para entrar com Google nem com e-mail. Use o endereço oficial ou continue como visitante."
      : "A entrada com conta ainda não está disponível neste endereço. Continue como visitante.";
    if(e && e.code==="weak_password")return "Escolha uma senha com pelo menos 12 caracteres.";
    if(e && e.code==="missing_email")return "Informe seu e-mail.";
    if(e && e.code==="email_not_confirmed")return "Confirme seu e-mail antes de entrar.";
    if(e && e.code==="over_email_send_rate_limit")return "Aguarde alguns minutos antes de pedir outro e-mail.";
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
  async function provedores(){
    if(!configValida())throw Error("Configuração Supabase pendente");
    const controle=new AbortController();
    const limite=setTimeout(()=>controle.abort(),7000);
    try{
      const resposta=await fetch(CONFIG.url+"/auth/v1/settings",{
        headers:{apikey:CONFIG.chavePublicavel}, credentials:"omit", cache:"no-store", signal:controle.signal
      });
      if(!resposta.ok)throw Error("Configurações indisponíveis");
      const dados=await resposta.json();
      if(!dados.external)throw Error("Provedores indisponíveis");
      return dados.external;
    }finally{clearTimeout(limite);}
  }
  function abrirEntrada(aviso){
    root.ElidaEntrada.abrir({provedores,autenticar,erroLegivel,enderecoOficial,visitar:async function(){
      if(modo==="conta"){await acao("visitante");return;}
      guardarModo("visitante");
    }},aviso);
  }
  function mostrar(){
    if(root.ElidaEntrada && !usuarioPermitido(usuario) && !recuperando){
      abrirEntrada();return;
    }
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
    // O link do aviso só abre a fila. A decisão exige a sessão master e a RPC.
    const chaveRevisao="elida-revisar-acessos";
    let revisar=retorno.searchParams.get("revisar")==="acessos";
    try{
      if(revisar)sessionStorage.setItem(chaveRevisao,"1");
      else revisar=sessionStorage.getItem(chaveRevisao)==="1";
    }catch(e){}
    const codigo=retorno.searchParams.get("code");
    const fragmento=new URL(retorno.origin+"/?"+retorno.hash.slice(1)).searchParams;
    const erroRetorno=retorno.searchParams.has("error") || fragmento.has("error");
    let aviso="";
    if(erroRetorno){
      ["error","error_code","error_description"].forEach(k=>retorno.searchParams.delete(k));
      if(fragmento.has("error"))retorno.hash="";
      history.replaceState(null,"",retorno.pathname+retorno.search+retorno.hash);
      aviso="A entrada foi cancelada ou não pôde ser concluída. Tente novamente.";
    }
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
      }catch(e){uid=""; acesso={status:"indisponivel",papel:"usuario"};
        if(codigo || !usuario)aviso="Sua sessão não pôde ser confirmada. Entre novamente.";
      }
    }
    /* Botão criado antes da aplicação, sem iniciar rede no modo visitante. */
    var botao=document.createElement("button");
    botao.id="elida-conta-botao";botao.type="button";
    botao.textContent="Conta";
    botao.setAttribute("aria-label","Abrir conta Elida");
    botao.addEventListener("click",mostrar);
    document.querySelector(".top").appendChild(botao);
    if(root.ElidaEntrada && !usuarioPermitido(usuario)){
      let primeiraVisita=true;
      try{primeiraVisita=!localStorage.getItem(CHAVE_MODO);}catch(e){}
      if(primeiraVisita || modo==="conta" || aviso || revisar){
        if(modo==="conta")document.documentElement.setAttribute("data-elida-bloqueada","true");
        abrirEntrada(aviso || (revisar?"Entre com a conta administradora para revisar os pedidos.":""));return;
      }
    }
    if(revisar && !recuperando && usuarioPermitido(usuario)){
      try{sessionStorage.removeItem(chaveRevisao);}catch(e){}
      retorno.searchParams.delete("revisar");
      history.replaceState(null,"",retorno.pathname+retorno.search+retorno.hash);
      if(!uid)document.documentElement.setAttribute("data-elida-bloqueada","true");
      mostrar();
      if(acesso.status==="aprovado" && acesso.papel==="superadmin"){
        listarAdmin("pedidos").catch(()=>mensagem("A lista não carregou. Toque em Ver solicitações pendentes para tentar novamente."));
      }else if(acesso.status!=="indisponivel"){
        mensagem("Esta conta não tem acesso à fila. Para revisar pedidos, entre com a conta administradora.");
      }
      return;
    }
    if(recuperando && uid)setTimeout(mostrar,0);
    if(modo==="conta" && !uid){
      document.documentElement.setAttribute("data-elida-bloqueada","true");
      setTimeout(mostrar,0);
    }
  }
  async function acao(a, alvoUid){
    if(a==="visitante"){
      limpar();
      if(cliente){const res=await cliente.auth.signOut({scope:"local"});if(res.error)throw res.error;}
      guardarModo("visitante");location.reload();return;
    }
    if(a==="fechar"){
      if(modo!=="conta" || (uid && acesso.status==="aprovado")) panel().hidden=true;
      else mensagem("Acesso à conta pendente. Escolha Continuar como visitante ou Sair da conta.");
      return;
    }
    if(a==="sair"){
      if(cliente){const res=await cliente.auth.signOut({scope:"local"});if(res.error)throw res.error;}
      limpar();try{localStorage.removeItem(CHAVE_MODO);}catch(e){} location.reload();return;
    }
    const auth=obterCliente().auth;
    if(a==="atualizar-status"){
      if(!usuarioPermitido(usuario))throw Error("É necessário entrar e verificar e-mail");
      mensagem("Consultando sua solicitação…");
      try{acesso=await root.ElidaAprovacao.verificar();}
      catch(e){mensagem("A consulta falhou. Confira a conexão e tente novamente.");return;}
      if(acesso.status==="aprovado"){location.reload();return;}
      mostrar();
      if(acesso.status==="pendente")mensagem("Consulta concluída. Seu pedido continua aguardando aprovação.");
      return;
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
    if(a==="nova-senha"){
      const senha=campo("password");
      if(!recuperando || senha.length<12){mensagem("Use pelo menos 12 caracteres.");return;}
      const res=await auth.updateUser({password:senha});
      if(res.error)throw res.error;
      limpar();location.reload();return;
    }
    const texto=await autenticar(a,campo("email").trim(),campo("password"));
    if(texto){limpar();mensagem(texto);}
  }
  async function autenticar(a,email,senha){
    const auth=obterCliente().auth;
    const retorno=location.origin+location.pathname;
    if(a==="google" || a==="facebook" || a==="apple"){
      const options={redirectTo:retorno};
      if(a==="google")options.queryParams={prompt:"select_account"};
      if(a==="facebook")options.scopes="email";
      const res=await auth.signInWithOAuth({provider:a,options});
      if(res.error)throw res.error;
      return;
    }
    if(!email)throw Object.assign(Error("E-mail obrigatório"),{code:"missing_email"});
    if(a==="recuperar"){
      const res=await auth.resetPasswordForEmail(email,{redirectTo:retorno+"?recuperar=1"});
      if(res.error)throw res.error;
      return "Se a conta existir, confira as instruções no seu e-mail.";
    }
    if(a==="cadastro"){
      if(senha.length<12)throw Object.assign(Error("Senha curta"),{code:"weak_password"});
      const res=await auth.signUp({email,password:senha,options:{emailRedirectTo:retorno}});
      if(res.error)throw res.error;
      if(!res.data.session)return "Verifique seu e-mail para concluir o cadastro.";
    }else if(a==="login"){
      const res=await auth.signInWithPassword({email,password:senha});
      if(res.error)throw res.error;
    }else throw Error("Método de entrada desconhecido");
    guardarModo("conta");location.reload();
  }
  root.ElidaConta=Object.freeze({cliente:obterCliente,bootstrap:bootstrap,sufixo:sufixo,abrir:mostrar,configurada:configValida});
})(typeof window!=="undefined"?window:this);


