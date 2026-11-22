/* A abertura só consulta o Supabase quando a pessoa escolhe entrar ou cadastrar. */
window.ElidaEntrada = (function () {
  "use strict";
  const dialogo = document.getElementById("entrada");
  const buscar = seletor => dialogo.querySelector(seletor);
  const form = buscar("form");
  const titulo = buscar("h1");
  const status = buscar(".entrada-status");
  const social = buscar(".entrada-social");
  const botoes = Array.from(social.querySelectorAll("[data-provedor]"));
  const nomes = {login:"Entre na sua conta", cadastro:"Crie sua conta", recuperar:"Recupere sua senha"};
  let servicos, tela, ocupado = false, disponibilidade, consulta;

  function atualizarBotoes() {
    botoes.forEach(botao => {
      botao.hidden = disponibilidade?.[botao.dataset.provedor] !== true;
      botao.disabled = ocupado || botao.hidden;
    });
    buscar(".entrada-separador").hidden = botoes.every(botao => botao.hidden);
  }
  async function verificarProvedores() {
    if (consulta) return;
    disponibilidade = null;
    atualizarBotoes();
    const nota = buscar(".entrada-provedores");
    nota.textContent = "Consultando opções de entrada…";
    consulta = servicos.provedores();
    try {
      disponibilidade = await consulta;
      nota.textContent = "";
    } catch {
      nota.textContent = "Sem conexão com o login social. Volte e tente novamente.";
    } finally {
      consulta = null;
      atualizarBotoes();
    }
  }
  function exibir(destino) {
    tela = destino;
    const inicio = tela === "inicio", cadastro = tela === "cadastro", recuperar = tela === "recuperar";
    titulo.textContent = nomes[tela] || "O que vamos levar para casa?";
    dialogo.toggleAttribute("data-formulario", !inicio);
    buscar(".entrada-inicio").hidden = !inicio;
    buscar(".entrada-voltar").hidden = inicio;
    form.hidden = inicio;
    for (const campo of [form.senha, form.confirmacao]) campo.value = "";
    form.senha.disabled = recuperar;
    form.senha.closest("label").hidden = recuperar;
    form.senha.autocomplete = cadastro ? "new-password" : "current-password";
    form.senha.minLength = cadastro ? 12 : 1;
    form.confirmacao.closest("label").hidden = !cadastro;
    form.confirmacao.disabled = !cadastro;
    form.confirmacao.required = cadastro;
    form.confirmacao.setCustomValidity("");
    buscar('[data-tela="recuperar"]').hidden = tela !== "login";
    buscar('[type="submit"]').textContent = cadastro ? "Criar conta" : recuperar ? "Enviar instruções" : "Entrar por e-mail";
    social.hidden = inicio || recuperar;
    const alternar = social.querySelector("[data-tela]");
    alternar.dataset.tela = cadastro ? "login" : "cadastro";
    alternar.textContent = cadastro ? "Já tenho uma conta" : "Ainda não tem conta? Cadastre-se";
    status.textContent = "";
    dialogo.scrollTop = 0;
    titulo.focus({preventScroll:true});
    if (!social.hidden) verificarProvedores();
  }
  async function executar(operacao) {
    if (ocupado) return;
    ocupado = true;
    dialogo.setAttribute("aria-busy","true");
    atualizarBotoes();
    status.textContent = "Aguarde…";
    try {
      status.textContent = await operacao() || "";
    } catch (erro) {
      status.textContent = servicos.erroLegivel(erro);
    } finally {
      ocupado = false;
      dialogo.removeAttribute("aria-busy");
      atualizarBotoes();
    }
  }
  dialogo.addEventListener("cancel", evento => {
    evento.preventDefault();
    if (!ocupado && tela !== "inicio") exibir(tela === "recuperar" ? "login" : "inicio");
  });
  dialogo.addEventListener("click", evento => {
    const botao = evento.target.closest("button");
    if (!botao || botao.disabled || ocupado) return;
    if (botao.matches(".entrada-pausa")) {
      const pausado = dialogo.toggleAttribute("data-pausado");
      botao.textContent = pausado ? "▶" : "Ⅱ";
      botao.setAttribute("aria-pressed", String(pausado));
      botao.setAttribute("aria-label", pausado ? "Retomar animação do fundo" : "Pausar animação do fundo");
    } else if (botao.dataset.tela) exibir(botao.dataset.tela);
    else if (botao.matches(".entrada-voltar")) exibir(tela === "recuperar" ? "login" : "inicio");
    else if (botao.dataset.provedor) executar(() => servicos.autenticar(botao.dataset.provedor));
    else if (botao.matches(".entrada-visitante, [data-jantar], [data-ler-foto]")) executar(async () => {
      await servicos.visitar();
      form.reset();
      dialogo.close();
      if (botao.hasAttribute("data-jantar")) location.hash = "jantar";
      if (botao.hasAttribute("data-ler-foto")) location.hash = "ler-foto";
    });
  });
  form.addEventListener("input", () => form.confirmacao.setCustomValidity(""));
  form.addEventListener("submit", evento => {
    evento.preventDefault();
    if (tela === "cadastro" && form.senha.value !== form.confirmacao.value) {
      form.confirmacao.setCustomValidity("As senhas precisam ser iguais.");
      form.confirmacao.reportValidity();
      return;
    }
    executar(async () => {
      const resultado = await servicos.autenticar(tela, form.email.value.trim(), form.senha.value);
      if (tela === "cadastro" || tela === "recuperar") exibir("login");
      return resultado;
    });
  });
  return Object.freeze({
    abrir(deps, aviso) {
      servicos = deps;
      if (!dialogo.open) dialogo.showModal();
      exibir("inicio");
      if (aviso) status.textContent = aviso;
    }
  });
})();
