/* Elida Web: configuração PÚBLICA obtida do Firebase Console.
   Não é conta de serviço nem segredo administrativo.
   Login disponível somente em HOMOLOGAÇÃO: não modifica produção.
   Firestore, App Check e sincronização familiar seguem DESATIVADOS.
   Não carregar Firebase Analytics, nem coletar dados de saúde ou compras. */
(function(root){
  "use strict";
  var host = (root.location && root.location.hostname || "").toLowerCase();
  var permitido = host === "elida-homologacao.pages.dev"
    || host.endsWith(".elida-homologacao.pages.dev")
    || host === "localhost" || host === "127.0.0.1";
  // Informe apenas a chave pública reCAPTCHA Enterprise aprovada no Firebase App Check.
  // Sem ela, a aprovação fica indisponível (falha fechada). Nunca usar chave secreta.
  root.__ELIDA_APP_CHECK_SITE_KEY__ = null;
  root.__ELIDA_FIREBASE_CONFIG__ = permitido ? Object.freeze({
    apiKey: "AIzaSyBIPtpWQ1fmsNTL9GZ2OiXO8D5x2DX8xu8",
    authDomain: "projeto-elida-aplv.firebaseapp.com",
    projectId: "projeto-elida-aplv",
    appId: "1:90562321638:web:5959134668dcb4f0a42f27"
  }) : null;
})(window);
