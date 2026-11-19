/* Ambiente do Elida: produção ou homologação, decidido por uma configuração explícita.
   Regra de segurança: HOMOLOGAÇÃO só quando o endereço está na lista de homologação abaixo.
   Qualquer outro endereço (GitHub Pages, domínio próprio, endereço desconhecido, erro de
   configuração) é PRODUÇÃO: sem catálogo fictício, sem faixa de teste e sem dados de teste.
   Usado pelo app (index.html) e pelo service worker (importScripts), com a mesma decisão. */
(function (raiz, fabrica) {
  "use strict";
  var api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ElidaAmbiente = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CONFIG = Object.freeze({
    versao: 1,
    homologacao: Object.freeze({
      /* Nome exato ou "*.dominio" (só subdomínios desse domínio, nunca o sufixo solto). */
      hosts: Object.freeze(["elida-homologacao.pages.dev", "*.elida-homologacao.pages.dev", "localhost", "127.0.0.1"])
    }),
    /* Endereços de homologação que precisam se comportar como produção (teste de atualização). */
    forcarProducao: Object.freeze(["teste-atualizacao.elida-homologacao.pages.dev"])
  });

  function hostConfere(host, padrao) {
    if (typeof padrao !== "string" || !padrao) return false;
    if (padrao.indexOf("*.") === 0) { var base = padrao.slice(2); return host.length > base.length + 1 && host.slice(-(base.length + 1)) === "." + base; }
    return host === padrao;
  }
  /* local: { protocol, hostname } (window.location ou self.location). */
  function resolver(local, config) {
    config = config || CONFIG;
    var host = String(local && local.hostname || "").toLowerCase().replace(/\.$/, "");
    var proto = String(local && local.protocol || "");
    var hml = false;
    try {
      var lista = config.homologacao && config.homologacao.hosts;
      var forcar = config.forcarProducao || [];
      var seguro = proto === "https:" || host === "localhost" || host === "127.0.0.1";
      hml = !!host && seguro && Array.isArray(lista) && lista.some(function (p) { return hostConfere(host, p); }) &&
        !(Array.isArray(forcar) && forcar.some(function (p) { return hostConfere(host, p); }));
    } catch (e) { hml = false; }
    return Object.freeze({
      nome: hml ? "homologacao" : "producao",
      producao: !hml,
      homologacao: hml,
      prefixoDados: hml ? "hml:" : "",
      prefixoCache: hml ? "despensa-hml" : "despensa",
      catalogoFicticio: hml,
      dadosDeTeste: hml,
      host: host
    });
  }

  return Object.freeze({ CONFIG: CONFIG, resolver: resolver, hostConfere: hostConfere });
});
